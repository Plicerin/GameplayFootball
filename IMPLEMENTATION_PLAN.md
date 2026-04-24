# Implementation Plan: Learned AI Integration

## Option A — Full GRF Policy Replacement

Replace the HELIOS planner entirely with a pre-trained PPO agent from
[google-research/football](https://github.com/google-research/football).

### Background

Google Research Football (GRF) is an RL training environment built on top of
the same 11versus11 Pixel Soccer Mini engine used in this project. It ships pre-trained
PPO checkpoints (e.g. `11_vs_11_easy_stochastic`) and a Python gym interface.
The approach here is to extract those checkpoints and wire neural network
inference into the existing C++ agent decision loop.

### Phase 1 — Observation Bridge (2–4 days)

Map `RoboCupWorldModel` → GRF's flat observation format.

GRF's default observation includes:
- Ball position (x, y, z), velocity (vx, vy, vz)
- Active player position and direction
- All 22 player positions, velocities, tiredness
- Game mode (one-hot), score, steps remaining

Work required:
- Write a `GRFObservationBuilder` that reads from `RoboCupWorldModel` and
  fills a `float[115]` or structured-multiagent observation array
- Normalize coordinate spaces (GRF uses [-1,1] pitch range; RoboCup uses
  metres with `ServerParam::pitchHalfLength()` as scale)
- Map RoboCup game modes to GRF's game mode enum

Risk: GRF's observation was designed around its own simplified physics. Some
fields (e.g. ball z-velocity, tiredness) have no direct RoboCup equivalent
and will need sensible defaults or learned-away via fine-tuning.

### Phase 2 — Action Bridge (2–3 days)

Map GRF's discrete 19-action set back to `CooperativeAction` commands.

GRF actions:
```
0  idle          7  top_right     14 release_direction
1  left          8  sprint        15 shoot
2  top_left      9  release_sprint 16 keeper_rush
3  top           10 slide tackle  17 dribble
4  top_right     11 dribble       18 release_dribble
5  right         12 release_dribble
6  bottom_right  13 left
```

Work required:
- Write `GRFActionTranslator` that converts a GRF action index into a
  `CooperativeAction` (kick direction/speed, dash power/angle, turn moment)
- Handle timing: GRF issues one action per 100ms; RoboCup ticks at a
  different cadence — buffer or interpolate as needed

### Phase 3 — Model Inference (1 day + TF dependency pain)

Load and run a TF1.15 checkpoint at each decision tick.

Options:
- **TF1 SavedModel** — load via `tensorflow::Session` in C++ or via a Python
  subprocess
- **ONNX export** — convert the TF checkpoint to ONNX, run with
  `onnxruntime` (recommended: avoids TF1 C++ linkage hell)
- **TorchScript** — retrain in PyTorch, export via `torch::jit::script`

Recommended path: ONNX export + onnxruntime, which is header-only friendly
and has no TF dependency at inference time.

### Phase 4 — Decision Loop Integration (1–2 days)

Call the network in place of (or alongside) the HELIOS planner.

In the agent's action-selection method, replace or wrap the call to
`StrictCheckPassGenerator::instance().courses(wm)` and
`ShootGenerator::instance().courses(wm)` with a network forward pass.

Fallback pattern (safer for a prototype):
```cpp
if ( network_confidence > THRESHOLD ) {
    action = grf_policy.act( observation );
} else {
    action = helios_planner.bestAction( wm );
}
```

### Phase 5 — Mismatch Handling (ongoing, high risk)

GRF checkpoints were trained on GRF's simplified rules. Differences that will
cause erratic behaviour:

| Dimension | GRF | RoboCup |
|---|---|---|
| Physics | Simplified | Full rcssserver |
| Timestep | 100ms | Configurable |
| Player types | Homogeneous | Heterogeneous (`PlayerType`) |
| Action space | Discrete 19 | Continuous kick/dash/turn |
| Offside | Simplified | Full rule |

Mitigations:
- Normalise all observations aggressively before feeding the network
- Fine-tune the checkpoint on rollouts from your environment (requires a
  Python training loop wrapping the C++ engine)
- Or: retrain from scratch in GRF's environment and transfer — adds ~2–4
  weeks

### Total Effort Estimate

| Phase | Estimate |
|---|---|
| Observation bridge | 2–4 days |
| Action bridge | 2–3 days |
| Model inference (ONNX path) | 1 day |
| Decision loop integration | 1–2 days |
| Mismatch handling / fine-tuning | 2–4 weeks (variable) |
| **Working prototype** | **~2 weeks** |
| **Competitive with HELIOS tuning** | **4–8 weeks** |

---

## Option B — Lightweight Learned Value Function (Recommended Near-Term)

Rather than replacing the HELIOS planner, keep it as the **move generator**
and add a small neural network that **re-scores its candidates**.

### Concept

The HELIOS generators (`StrictCheckPassGenerator`, `ShootGenerator`) already
produce a ranked list of candidate actions with hand-crafted scores. The idea
is to replace or augment that final scoring step with a learned value function
that has seen real match outcomes.

Current flow:
```
WorldModel → [Generator] → candidate list (hand-scored) → pick best
```

Proposed flow:
```
WorldModel → [Generator] → candidate list → [Value Net] → re-scored list → pick best
```

The value net is small (MLP, ~3 hidden layers, <10k parameters) and trained
on logged match data. It does not need to generate actions — only rank them.

### What the Value Net Learns

Given a candidate action's features, predict the probability it leads to a
goal (or other reward signal) within the next N seconds.

Input features per candidate (example for a pass):
- Receiver position (x, y) normalised
- Receive step count
- Ball speed at receive
- Nearest opponent distance to receive point
- Passer position
- Score differential
- Game time remaining
- Pass type (direct / leading / through) one-hot

Output: scalar in [0, 1] — estimated value of taking this action.

### Training Data

Collect from match logs:
- At each decision point, log all candidates the generator considered and
  which one was chosen
- Label: did a goal result within the next 30 seconds? (or use a shaped
  reward: possession retained, field position gained, shot attempted)
- Even 50–100 matches generates enough data for a small MLP

### Integration

The scoring happens in `evaluateCourses` (shoot) and at the end of
`createPassCommon` (pass). Both currently compute a `score_` float.

Replace or blend the hand-crafted score:

```cpp
// existing
it->score_ = hand_crafted_score;

// with value net blending
float net_score = value_net_.predict( build_features( wm, *it ) );
it->score_ = 0.5f * hand_crafted_score_normalised + 0.5f * net_score;
```

The blend weight can be tuned — start at 0.3 network / 0.7 hand-crafted
and increase as confidence in the net grows.

### Effort Estimate

| Task | Estimate |
|---|---|
| Match logging (log candidates + outcomes) | 1–2 days |
| Feature extraction + dataset pipeline | 1 day |
| Train MLP (Python, PyTorch or sklearn) | 1 day |
| Export to ONNX / C array for inference | 0.5 day |
| Wire into `evaluateCourses` and `createPassCommon` | 1 day |
| Tuning blend weight, feature engineering | 2–3 days |
| **Total** | **~1.5–2 weeks** |

### Why This Is Preferable Near-Term

| Factor | Full GRF Replacement | Value Function on Top |
|---|---|---|
| Risk of regression | High — policy may be erratic | Low — HELIOS still generates |
| Training data needed | Millions of RL steps | 50–100 logged matches |
| Inference cost | Full network forward pass per tick | Tiny MLP, negligible cost |
| Interpretability | Black box | Generator still explains the candidates |
| Iteration speed | Slow (RL training loop) | Fast (supervised, quick retrains) |
| Path to GRF later | Compatible — can replace generator later | Yes — orthogonal |

### Files to Modify

| File | Change |
|---|---|
| `src/robocup_ai/shoot_generator.cpp` | Blend `evaluateCourses` score with net output |
| `src/robocup_ai/strict_check_pass_generator.cpp` | Blend score in `createPassCommon` |
| `src/robocup_ai/value_net.h` (new) | Lightweight ONNX/C inference wrapper |
| `src/robocup_ai/value_net.cpp` (new) | Feature builder + net forward pass |

---

## Recommended Sequence

1. **Now:** Continue tuning HELIOS parameters (in progress)
2. **Next (2 weeks):** Instrument match logging, train value net, wire in as
   a score blend — Option B
3. **Later (6–8 weeks):** If value net proves the concept, explore replacing
   the generator with a full GRF-derived policy — Option A
