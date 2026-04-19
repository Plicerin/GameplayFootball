// Headless simulation harness for the 11v11 Pixel Soccer prototype
// Extracts all game logic, stubs DOM, runs for N game-minutes, outputs telemetry

// ============================================================
// CONSTANTS
// ============================================================
const PITCH = { w: 105, h: 68 };
const DT = 1 / 20;
const GAME_SPEED_SCALE = 0.4;

const TEAM_A_COLORS = { shirt: '#dd0000', pants: '#dd0000', hair: '#dd0000', skin: '#dd0000', name: 'RED', keeper: '#ff6666', keeperPants: '#ff6666' };
const TEAM_B_COLORS = { shirt: '#0044dd', pants: '#0044dd', hair: '#0044dd', skin: '#0044dd', name: 'BLUE', keeper: '#6688ff', keeperPants: '#6688ff' };

const FORMATIONS = {
  '4-4-2': [
    { role: 'LB',  dx: 19, dy: -22 },
    { role: 'CB',  dx: 17, dy: -7 },
    { role: 'CB',  dx: 17, dy: 7 },
    { role: 'RB',  dx: 19, dy: 22 },
    { role: 'LM',  dx: 38, dy: -24 },
    { role: 'CM',  dx: 35, dy: -8 },
    { role: 'CM',  dx: 35, dy: 8 },
    { role: 'RM',  dx: 38, dy: 24 },
    { role: 'ST',  dx: 66, dy: -9 },
    { role: 'ST',  dx: 66, dy: 9 },
  ],
  '4-3-3': [
    { role: 'LB',  dx: 19, dy: -22 },
    { role: 'CB',  dx: 17, dy: -7 },
    { role: 'CB',  dx: 17, dy: 7 },
    { role: 'RB',  dx: 19, dy: 22 },
    { role: 'CM',  dx: 44, dy: -10 },
    { role: 'CM',  dx: 41, dy: 0 },
    { role: 'CM',  dx: 44, dy: 10 },
    { role: 'LW',  dx: 63, dy: -24 },
    { role: 'ST',  dx: 66, dy: 0 },
    { role: 'RW',  dx: 63, dy: 24 },
  ],
  '4-2-3-1': [
    { role: 'LB',  dx: 19, dy: -22 },
    { role: 'CB',  dx: 17, dy: -7 },
    { role: 'CB',  dx: 17, dy: 7 },
    { role: 'RB',  dx: 19, dy: 22 },
    { role: 'DM',  dx: 35, dy: -8 },
    { role: 'DM',  dx: 35, dy: 8 },
    { role: 'LW',  dx: 56, dy: -22 },
    { role: 'AM',  dx: 53, dy: 0 },
    { role: 'RW',  dx: 56, dy: 22 },
    { role: 'ST',  dx: 66, dy: 0 },
  ],
  '3-5-2': [
    { role: 'CB',  dx: 17, dy: -14 },
    { role: 'CB',  dx: 15, dy: 0 },
    { role: 'CB',  dx: 17, dy: 14 },
    { role: 'LM',  dx: 38, dy: -26 },
    { role: 'CM',  dx: 35, dy: -9 },
    { role: 'CM',  dx: 33, dy: 0 },
    { role: 'CM',  dx: 35, dy: 9 },
    { role: 'RM',  dx: 38, dy: 26 },
    { role: 'ST',  dx: 66, dy: -9 },
    { role: 'ST',  dx: 66, dy: 9 },
  ],
  '3-4-3': [
    { role: 'CB',  dx: 17, dy: -14 },
    { role: 'CB',  dx: 15, dy: 0 },
    { role: 'CB',  dx: 17, dy: 14 },
    { role: 'LM',  dx: 38, dy: -22 },
    { role: 'CM',  dx: 35, dy: -8 },
    { role: 'CM',  dx: 35, dy: 8 },
    { role: 'RM',  dx: 38, dy: 22 },
    { role: 'LW',  dx: 63, dy: -22 },
    { role: 'ST',  dx: 66, dy: 0 },
    { role: 'RW',  dx: 63, dy: 22 },
  ],
};

// ============================================================
// UTILITY
// ============================================================
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function normalizedClamp(v, lo, hi) { return clamp((v - lo) / (hi - lo), 0, 1); }

// ============================================================
// GAME STATE
// ============================================================
let ball, teamA, teamB, allPlayers, score, matchTime;
let kickOffCooldown, passGrace, passTrail, lastPasserSide;
let passOriginX, passOriginY, passTargetPlayer, tackleCooldown;
let lastPasserPlayer, recentPassTargets;
let freezeBlue = false;

const telem = {
  red: { passes: 0, shots: 0, clears: 0, tacklesWon: 0, possFrames: 0, holdTotal: 0, holdCount: 0 },
  blue: { passes: 0, shots: 0, clears: 0, tacklesWon: 0, possFrames: 0, holdTotal: 0, holdCount: 0 },
  totalFrames: 0,
  events: [],
};

// ============================================================
// BUILD
// ============================================================
function buildTeam(formationName, side, colors) {
  const form = FORMATIONS[formationName];
  const players = [];
  const midX = PITCH.w / 2;
  const midY = PITCH.h / 2;
  const gkX = side === 1 ? 4 : PITCH.w - 4;
  players.push({
    role: 'GK', homeX: gkX, homeY: midY,
    x: gkX, y: midY, vx: 0, vy: 0,
    side, colors: { ...colors, shirt: colors.keeper },
    isKeeper: true, hasBall: false, tackledImmunity: 0, shotCooldown: 0,
    keeperHandled: false, keeperNoPickUp: 0, shotReaction: 0,
  });
  for (const p of form) {
    let hx, hy;
    if (side === 1) { hx = p.dx; hy = midY + p.dy; }
    else { hx = PITCH.w - p.dx; hy = midY - p.dy; }
    hx = clamp(hx, 2, PITCH.w - 2);
    hy = clamp(hy, 2, PITCH.h - 2);
    players.push({
      role: p.role, homeX: hx, homeY: hy,
      x: hx, y: hy, vx: 0, vy: 0,
      side, colors,
      isKeeper: false, hasBall: false, tackledImmunity: 0, shotCooldown: 0,
    });
  }
  return players;
}

function resetMatch(formA = '4-2-3-1', formB = '4-4-2') {
  teamA = buildTeam(formA, 1, TEAM_A_COLORS);
  teamB = buildTeam(formB, -1, TEAM_B_COLORS);
  allPlayers = [...teamA, ...teamB];
  ball = { x: PITCH.w / 2, y: PITCH.h / 2, vx: 0, vy: 0, z: 0, vz: 0, owner: null };
  score = [0, 0];
  matchTime = 0;
  recentPassTargets = [];
  kickOffCooldown = 0;
  passGrace = 0;
  passTrail = null;
  lastPasserSide = 0;
  passOriginX = 0; passOriginY = 0;
  passTargetPlayer = null;
  tackleCooldown = 0;
  lastPasserPlayer = null;
  telemReset();
  doKickOff(teamA);
}

function telemReset() {
  for (const t of [telem.red, telem.blue]) {
    t.passes = 0; t.shots = 0; t.clears = 0; t.tacklesWon = 0;
    t.possFrames = 0; t.holdTotal = 0; t.holdCount = 0;
  }
  telem.totalFrames = 0;
  telem.events = [];
}

function telemEvent(team, action, detail) {
  const mins = Math.floor(matchTime / 3) % 90;
  const secs = Math.floor((matchTime / 3 * 60) % 60);
  const timeStr = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  telem.events.push({ time: timeStr, team, action, detail });
  if (telem.events.length > 200) telem.events.shift();
}

function telemUpdate() {
  telem.totalFrames++;
  if (ball.owner) {
    if (ball.owner.side === 1) telem.red.possFrames++;
    else telem.blue.possFrames++;
  }
}

function doKickOff(kickingTeam) {
  for (const p of allPlayers) {
    p.x = p.homeX; p.y = p.homeY; p.vx = 0; p.vy = 0; p.hasBall = false;
  }
  ball.x = PITCH.w / 2; ball.y = PITCH.h / 2;
  ball.vx = 0; ball.vy = 0; ball.vz = 0; ball.z = 0; ball.owner = null;
  passGrace = 0; passTargetPlayer = null; lastPasserPlayer = null;
  let kicker = null, bestD = Infinity;
  for (const p of kickingTeam) {
    if (p.isKeeper) continue;
    const d = Math.hypot(p.x - PITCH.w / 2, p.y - PITCH.h / 2);
    if (d < bestD) { bestD = d; kicker = p; }
  }
  if (kicker) {
    kicker.x = PITCH.w / 2; kicker.y = PITCH.h / 2;
    ball.owner = kicker; kicker.hasBall = true;
  }
  kickOffCooldown = 40;
}

// ============================================================
// AI: Off-ball positioning
// ============================================================
function getMindset(role) {
  const map = { GK: 0, CB: 0.1, LB: 0.25, RB: 0.25, DM: 0.3, CM: 0.5, LM: 0.55, RM: 0.55, AM: 0.7, LW: 0.75, RW: 0.75, ST: 0.9 };
  return map[role] ?? 0.5;
}
function isWideRole(role) { return ['LB','RB','LM','RM','LW','RW'].includes(role); }
function getFlankSign(player) { return player.homeY < PITCH.h / 2 ? -1 : 1; }

function getFormationTarget(player, ballPos, hasPossession) {
  const mindset = getMindset(player.role);
  const side = player.side;
  const mid = PITCH.w / 2;
  const followX = (ballPos.x - mid) * (0.15 + mindset * 0.12);
  const followY = (ballPos.y - PITCH.h / 2) * (0.08 + mindset * 0.08);
  let depthShift = 0;
  if (hasPossession) {
    depthShift = (side === 1 ? 1 : -1) * (8 + mindset * 22);
  } else {
    depthShift = (side === 1 ? -1 : 1) * (4 + (1 - mindset) * 10);
  }
  let x = player.homeX + followX + depthShift;
  let y = player.homeY + followY;
  if (mindset < 0.3) {
    x = side === 1 ? Math.min(x, mid + 15) : Math.max(x, mid - 15);
  }
  return { x: clamp(x, 4, PITCH.w - 4), y: clamp(y, 3, PITCH.h - 3) };
}

function getOffBallTarget(player, teammates, opponents, ballPos, hasPossession) {
  const base = getFormationTarget(player, ballPos, hasPossession);
  const side = player.side;
  const mindset = getMindset(player.role);
  let fx = 0, fy = 0;
  const toBaseX = base.x - player.x;
  const toBaseY = base.y - player.y;
  const baseDist = Math.hypot(toBaseX, toBaseY);
  if (baseDist > 1) {
    const pull = hasPossession ? 0.2 : 0.55;
    fx += (toBaseX / baseDist) * pull * Math.min(baseDist, 25);
    fy += (toBaseY / baseDist) * pull * Math.min(baseDist, 25);
  }
  for (const mate of teammates) {
    if (mate === player || mate.isKeeper) continue;
    const dx = player.x - mate.x;
    const dy = player.y - mate.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.1 && d < 12) {
      const repel = ((12 - d) / 12) * 4;
      fx += (dx / d) * repel;
      fy += (dy / d) * repel;
    }
  }
  if (isWideRole(player.role) && hasPossession) {
    const flank = getFlankSign(player);
    const targetY = PITCH.h / 2 + flank * 25;
    fy += (targetY - player.y) * 0.2;
  }
  if (!hasPossession && mindset < 0.7) {
    let nearestOpp = null, nearestD = Infinity;
    for (const opp of opponents) {
      if (opp.isKeeper) continue;
      const d = Math.hypot(base.x - opp.x, base.y - opp.y);
      if (d < nearestD) { nearestD = d; nearestOpp = opp; }
    }
    if (nearestOpp && nearestD < 30) {
      const ownGoalX = side === 1 ? 0 : PITCH.w;
      const markX = lerp(nearestOpp.x, ownGoalX, 0.3);
      const markY = nearestOpp.y;
      const defWeight = clamp(1 - mindset, 0.2, 0.8);
      fx += (markX - player.x) * defWeight * 0.4;
      fy += (markY - player.y) * defWeight * 0.2;
    }
  }
  if (hasPossession && mindset > 0.5) {
    const oppGoalX = side === 1 ? PITCH.w : 0;
    const ownGoalX = side === 1 ? 0 : PITCH.w;
    const distToOppGoal = Math.abs(player.x - oppGoalX);
    if (distToOppGoal > 15) {
      const runStrength = (mindset - 0.3) * 15;
      fx += (oppGoalX > ownGoalX ? 1 : -1) * runStrength;
    }
  }
  let tx = player.x + fx;
  let ty = player.y + fy;
  tx = clamp(tx, 3, PITCH.w - 3);
  ty = clamp(ty, 3, PITCH.h - 3);
  return { tx, ty };
}

// ============================================================
// AI: Keeper
// ============================================================
function updateKeeper(keeper, opponents, dt) {
  const goalX = keeper.side === 1 ? 4 : PITCH.w - 4;
  const goalLineX = keeper.side === 1 ? 0 : PITCH.w;
  const goalCenterY = PITCH.h / 2;
  const ballDist = dist(keeper, ball);
  const ballSpeed = Math.hypot(ball.vx, ball.vy);
  const ballHeadingToGoal = !ball.owner && ballSpeed > 10 &&
    ((keeper.side === 1 && ball.vx < -5) || (keeper.side === -1 && ball.vx > 5));
  let targetY = goalCenterY;
  let targetX = goalX;
  let maxSpeed = 5;

  if (ballHeadingToGoal && ballDist < 35) {
    keeper.shotReaction = (keeper.shotReaction || 0) + 1;
    if (keeper.shotReaction > 3) {
      const t = Math.abs(goalLineX - ball.x) / Math.abs(ball.vx);
      const projY = ball.y + ball.vy * t;
      const error = (Math.random() - 0.5) * 14;
      targetY = clamp(projY + error, goalCenterY - 6, goalCenterY + 6);
      maxSpeed = 5;
    } else {
      targetY = keeper.y;
      maxSpeed = 2;
    }
  } else if (ballDist < 15 && !ball.owner) {
    // Come out to intercept dribblers
    targetX = lerp(goalX, ball.x, 0.25);
    targetY = lerp(goalCenterY, ball.y, 0.25);
    maxSpeed = 6;
    keeper.shotReaction = 0;
  } else {
    targetY = clamp(ball.y, goalCenterY - 6, goalCenterY + 6);
    maxSpeed = 2.5;
    keeper.shotReaction = 0;
  }

  const dx = targetX - keeper.x;
  const dy = targetY - keeper.y;
  const d = Math.hypot(dx, dy);
  if (d > 0.3) {
    const speed = Math.min(maxSpeed, d * 3);
    keeper.vx = (dx / d) * speed;
    keeper.vy = (dy / d) * speed;
  } else {
    keeper.vx *= 0.8;
    keeper.vy *= 0.8;
  }

  // Keeper pickup: fast balls are harder to catch cleanly
  const ballSpd = Math.hypot(ball.vx, ball.vy);
  const effectivePickup = ballSpd > 12 ? 0.4 : 1.5;
  // Save attempt: keeper near fast ball → deflect instead of catch (50% chance)
  // Only if keeper is allowed to act (not in shot grace period)
  if (ballDist < 1.8 && ballSpd > 12 && !ball.owner && keeper.keeperNoPickUp <= 0 && !(ball.shotInFlight > 0) && Math.random() < 0.5) {
    // Deflect the ball — reduce speed and randomize direction
    ball.vx *= -0.3 + (Math.random() - 0.5) * 0.4;
    ball.vy += (Math.random() - 0.5) * 8;
    ball.vz = Math.random() * 2;
    keeper.keeperNoPickUp = 30; // can't immediately re-grab
  }
  if (ballDist < effectivePickup && !ball.owner && keeper.keeperNoPickUp <= 0 && !(ball.shotInFlight > 0)) {
    ball.owner = keeper;
    keeper.hasBall = true;
    keeper.holdTime = 0;
    keeper.keeperHandled = true;
    const oppTeam = keeper.side === 1 ? teamB : teamA;
    for (const opp of oppTeam) {
      const od = dist(opp, keeper);
      if (od < 5) {
        const pdx = opp.x - keeper.x;
        const pdy = opp.y - keeper.y;
        const pd = Math.hypot(pdx, pdy) || 1;
        opp.x += (pdx / pd) * (5 - od);
        opp.y += (pdy / pd) * (5 - od);
        opp.x = clamp(opp.x, 1, PITCH.w - 1);
        opp.y = clamp(opp.y, 1, PITCH.h - 1);
      }
    }
  }
}

// ============================================================
// AI: On-ball helpers
// ============================================================
function findBestPass(player, teammates, opponents, attackDir) {
  let bestTarget = null, bestScore = -Infinity;
  const oppGoalX = attackDir === 1 ? PITCH.w : 0;
  for (const mate of teammates) {
    if (mate === player || mate.isKeeper) continue;
    const d = dist(player, mate);
    if (d < 5 || d > 55) continue;
    if (mate === lastPasserPlayer) continue;
    if (mate.justPassed > 60) continue; // don't pass back to a player who just shot
    if (recentPassTargets.some(r => r.player === mate && r.timer > 0)) continue;
    let blocked = false;
    for (const opp of opponents) {
      const t = ((opp.x - player.x) * (mate.x - player.x) + (opp.y - player.y) * (mate.y - player.y))
              / (Math.pow(mate.x - player.x, 2) + Math.pow(mate.y - player.y, 2));
      if (t > 0.1 && t < 0.9) {
        const projX = player.x + t * (mate.x - player.x);
        const projY = player.y + t * (mate.y - player.y);
        const clearance = Math.hypot(opp.x - projX, opp.y - projY);
        if (clearance < 2) { blocked = true; break; }
      }
    }
    if (blocked) continue;
    let nearOppDist = Infinity;
    for (const opp of opponents) {
      const od = dist(mate, opp);
      if (od < nearOppDist) nearOppDist = od;
    }
    const openness = clamp(nearOppDist / 8, 0, 1);
    const forward = (mate.x - player.x) * attackDir / PITCH.w;
    const posValue = 1 - Math.abs(mate.x - oppGoalX) / PITCH.w;
    const score = openness * 0.35 + forward * 0.35 + posValue * 0.2 + (1 - d / 55) * 0.1;
    if (score > bestScore) { bestScore = score; bestTarget = mate; }
  }
  return { target: bestTarget, score: bestScore };
}

function canShoot(player, opponents, attackDir) {
  const oppGoalX = attackDir === 1 ? PITCH.w : 0;
  const goalY = PITCH.h / 2;
  const distToGoal = Math.abs(player.x - oppGoalX);
  const angleToGoal = Math.abs(player.y - goalY);
  if (distToGoal > 32 || angleToGoal > 25) return false;
  if (player.shotCooldown > 0) return false;
  let blocked = 0;
  for (const opp of opponents) {
    const t = ((opp.x - player.x) * (oppGoalX - player.x) + (opp.y - player.y) * (goalY - player.y))
            / (Math.pow(oppGoalX - player.x, 2) + Math.pow(goalY - player.y, 2));
    if (t > 0.05 && t < 0.85) {
      const projX = player.x + t * (oppGoalX - player.x);
      const projY = player.y + t * (goalY - player.y);
      const clearance = Math.hypot(opp.x - projX, opp.y - projY);
      if (clearance < 2) blocked++;
    }
  }
  return blocked < (distToGoal < 18 ? 5 : distToGoal < 25 ? 3 : 2);
}

// ============================================================
// AI: On-ball decision tree
// ============================================================
function updateOnBall(player, teammates, opponents, dt) {
  const attackDir = player.side;
  const oppGoalX = attackDir === 1 ? PITCH.w : 0;
  if (!player.holdTime) player.holdTime = 0;
  player.holdTime++;

  // KEEPER
  if (player.isKeeper) {
    const GK_TIME_LIMIT = 480;
    const GK_DISTRIBUTE_AT = 90;
    const GK_URGENT_AT = 360;
    const goalX = player.side === 1 ? 4 : PITCH.w - 4;
    const goalY = PITCH.h / 2;
    const dxG = goalX - player.x;
    const dyG = goalY - player.y;
    const dG = Math.hypot(dxG, dyG);
    if (dG > 1) { player.vx = (dxG / dG) * 3; player.vy = (dyG / dG) * 2; }
    else { player.vx *= 0.8; player.vy *= 0.8; }
    ball.x = player.x; ball.y = player.y;
    if (player.holdTime >= GK_TIME_LIMIT) {
      telemEvent(player.side === 1 ? 'RED' : 'BLUE', 'GK VIOLATION', `held ball ${Math.round(player.holdTime / 60)}s — corner kick`);
      awardCornerKick(player.side);
      return;
    }
    if (player.holdTime > GK_DISTRIBUTE_AT) {
      const { target, score } = findBestPass(player, teammates, opponents, attackDir);
      const threshold = player.holdTime > GK_URGENT_AT ? -1 : 0.1;
      if (target && score > threshold) {
        telemEvent(player.side === 1 ? 'RED' : 'BLUE', 'GK THROW', `to ${target.role} (${Math.round(dist(player, target))}m)`);
        doPass(player, target);
        ball.vx *= 1.4; ball.vy *= 1.4;
        player.keeperHandled = false;
        player.keeperNoPickUp = 180;
        return;
      }
      if (player.holdTime > GK_URGENT_AT + 60) {
        telemEvent(player.side === 1 ? 'RED' : 'BLUE', 'GK PUNT', `at ${Math.round(player.holdTime / 60)}s`);
        clearBall(player);
        player.keeperHandled = false;
        player.keeperNoPickUp = 180;
        return;
      }
    }
    return;
  }

  // OUTFIELD
  const distToGoal = Math.abs(player.x - oppGoalX);
  const ownGoalX = player.side === 1 ? 0 : PITCH.w;
  const distToOwnGoal = Math.abs(player.x - ownGoalX);
  let closestOppDist = Infinity;
  for (const opp of opponents) {
    const d = dist(player, opp);
    if (d < closestOppDist) closestOppDist = d;
  }

  // === OUTFIELD DECISION TREE ===
  // Philosophy: dribble forward by default, shoot when close, pass to better-positioned mates
  // Shooting is NOT the first priority — penetration is.

  // 1. POINT-BLANK: inside 12m — always shoot (only keeper stands in the way)
  if (distToGoal < 12 && player.shotCooldown <= 0 && Math.abs(player.y - PITCH.h / 2) < 14) {
    doShoot(player, oppGoalX);
    return;
  }
  // 2. DANGER ZONE: under pressure in own half — defenders clear
  if ((distToOwnGoal < 20 && closestOppDist < 3 && Math.random() < 0.04) || (player.role === 'CB' && distToOwnGoal < 30 && closestOppDist < 6 && Math.random() < 0.02)) {
    clearBall(player, true);
    return;
  }
  // 3. FIRST TOUCH: dribble to settle (8 frames), but skip if already in box
  if (player.holdTime < 8 && distToGoal > 18) {
    doDribble(player, opponents, attackDir);
    return;
  }
  // 3b. UNDER PRESSURE: pass if opponent is close
  if (closestOppDist < 2.5 && player.holdTime > 15 && Math.random() < 0.06) {
    const { target } = findBestPass(player, teammates, opponents, attackDir);
    if (target) { doPass(player, target); return; }
  }
  // 4. CLOSE-RANGE SHOT: inside 18m — shoot with ~3% per tick (fires in ~33 frames on avg)
  if (distToGoal < 18 && canShoot(player, opponents, attackDir) && Math.random() < 0.03) {
    doShoot(player, oppGoalX);
    return;
  }
  // 5. FINAL THIRD: pass to better-positioned mate or shoot
  if (distToGoal < 35) {
    const { target: passTarget, score: passScore } = findBestPass(player, teammates, opponents, attackDir);
    // Pass if teammate is meaningfully closer to goal
    if (passTarget && passScore > 0.50 && Math.random() < 0.07) {
      const mateDistToGoal = Math.abs(passTarget.x - oppGoalX);
      if (mateDistToGoal < distToGoal - 6) {
        doPass(player, passTarget);
        return;
      }
    }
    // Shot from 18–25m: ~1.5% per tick
    if (distToGoal < 25 && canShoot(player, opponents, attackDir) && Math.random() < 0.015) {
      doShoot(player, oppGoalX);
      return;
    }
    // Dribble toward goal for up to 60 frames
    if (player.holdTime < 60) {
      doDribble(player, opponents, attackDir);
      return;
    }
    // After 60 frames: shoot or pass — don't hold forever
    if (canShoot(player, opponents, attackDir) && Math.random() < 0.08) {
      doShoot(player, oppGoalX);
      return;
    }
    if (passTarget) { doPass(player, passTarget); return; }
    doDribble(player, opponents, attackDir);
    return;
  }
  // 6. MIDFIELD: pass regularly, occasional long-range shot
  if (distToGoal >= 35) {
    if (player.holdTime > 35) {
      const { target: passTarget, score: passScore } = findBestPass(player, teammates, opponents, attackDir);
      if (passTarget && passScore > 0.38 && Math.random() < 0.14) {
        doPass(player, passTarget);
        return;
      }
    }
    if (distToGoal < 32 && player.holdTime > 60 && canShoot(player, opponents, attackDir) && Math.random() < 0.008) {
      doShoot(player, oppGoalX);
      return;
    }
    doDribble(player, opponents, attackDir);
    return;
  }
  // 7. HELD TOO LONG anywhere: force action
  if (player.holdTime > 150) {
    if (distToOwnGoal < 20 && closestOppDist < 5) { clearBall(player, true); return; }
    if (canShoot(player, opponents, attackDir)) { doShoot(player, oppGoalX); return; }
    const { target } = findBestPass(player, teammates, opponents, attackDir);
    if (target) { doPass(player, target); return; }
  }
  // 8. DEFAULT: dribble
  doDribble(player, opponents, attackDir);
}

// ============================================================
// ACTIONS
// ============================================================
function doPass(from, to) {
  const t = from.side === 1 ? telem.red : telem.blue;
  t.passes++;
  if (from.holdTime) { t.holdTotal += from.holdTime; t.holdCount++; }
  telemEvent(from.side === 1 ? 'RED' : 'BLUE', 'PASS', `${from.role}→${to.role} (${Math.round(dist(from,to))}m)`);
  from.hasBall = false;
  from.holdTime = 0;
  from.intention = null;
  from.justPassed = 30;
  ball.owner = null;
  passOriginX = from.x; passOriginY = from.y;
  passTargetPlayer = to;
  lastPasserPlayer = from;
  lastPasserSide = from.side;
  recentPassTargets = recentPassTargets.filter(r => r.timer > 0);
  recentPassTargets.push({ player: to, timer: 120 });
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  // Power calibrated to harness drag: terminal_dist = power * dt / drag_rate = power * 0.02/0.014
  // → power = d * 0.7 so ball decelerates to exactly the target distance
  const power = clamp(d * 0.7, 3, 28);
  ball.vx = (dx / d) * power;
  ball.vy = (dy / d) * power;
  // Grace: estimate flight frames = d / (power * dt) * ln(power/(power-d*drag))... approx:
  passGrace = Math.max(20, Math.ceil(d / (power * 0.02) * 1.8));
  passTrail = { x1: from.x, y1: from.y, x2: to.x, y2: to.y, life: 45 };
}

function doShoot(player, goalX) {
  const t = player.side === 1 ? telem.red : telem.blue;
  t.shots++;
  if (player.holdTime) { t.holdTotal += player.holdTime; t.holdCount++; }
  const distG = Math.round(Math.abs(player.x - goalX));
  telemEvent(player.side === 1 ? 'RED' : 'BLUE', 'SHOT', `${player.role} from ${distG}m`);
  player.hasBall = false;
  player.holdTime = 0;
  player.intention = null;
  player.shotCooldown = 90;
  ball.owner = null;
  const goalCenterY = PITCH.h / 2;
  const spread = clamp(3 + distG * 0.05, 3, 5);
  const goalY = goalCenterY + (Math.random() - 0.5) * 2 * spread;
  const dx = goalX - player.x;
  const dy = goalY - player.y;
  const d = Math.hypot(dx, dy);
  const power = 22 + Math.random() * 8;
  ball.vx = (dx / d) * power;
  ball.vy = (dy / d) * power;
  ball.vz = Math.random() < 0.4 ? (Math.random() * 0.2) : (0.8 + Math.random() * 1.2);
  passGrace = 10; // grace period so defenders don't intercept the shot mid-flight
  lastPasserSide = player.side;
  lastPasserPlayer = player;
  passTargetPlayer = null; // no pass target for shots
  player.justPassed = 120; // can't reclaim own rebound for 2 seconds
  // Prevent ALL players from intercepting during shot flight
  ball.shotInFlight = 15;
  // Prevent defending GK from instantly catching the shot — give ball time to travel
  const defTeam = (goalX < PITCH.w / 2) ? teamA : teamB;
  const defKeeper = defTeam.find(p => p.isKeeper);
  if (defKeeper) defKeeper.keeperNoPickUp = 8;
  passTrail = { x1: player.x, y1: player.y, x2: goalX, y2: goalY, life: 25 };
}

function doDribble(player, opponents, attackDir) {
  const oppGoalX = attackDir === 1 ? PITCH.w : 0;
  const toGoalX = oppGoalX - player.x;
  const distToGoal = Math.abs(toGoalX);
  // Don't dribble into the goal — stop at ~5m from goal line and hold
  if (distToGoal < 5) {
    player.vx = 0;
    player.vy = 0;
    ball.x = player.x; ball.y = player.y;
    return;
  }
  if (distToGoal < 10) {
    player.vx = (toGoalX > 0 ? 1 : -1) * 1.5;
    player.vy = clamp((PITCH.h / 2 - player.y) * 0.15, -2, 2);
    ball.x = player.x; ball.y = player.y;
    return;
  }
  let vx = (toGoalX > 0 ? 1 : -1) * 3.5;
  let vy = 0;
  if (isWideRole(player.role)) {
    const flank = getFlankSign(player);
    const touchline = PITCH.h / 2 + flank * 25;
    vy = (touchline - player.y) * 0.03;
    if (distToGoal < 22) vy += (PITCH.h / 2 - player.y) * 0.08;
  } else {
    vy = (PITCH.h / 2 - player.y) * 0.02;
  }
  let nearDist = Infinity, nearOpp = null;
  for (const opp of opponents) {
    const d = dist(player, opp);
    if (d < nearDist) { nearDist = d; nearOpp = opp; }
  }
  if (nearOpp && nearDist < 5) {
    const evadeStrength = clamp((5 - nearDist) / 4, 0.3, 1.5);
    vy += (player.y > nearOpp.y ? 1 : -1) * evadeStrength;
  }
  player.vx = vx;
  player.vy = clamp(vy, -3, 3);
  ball.x = player.x; ball.y = player.y;
}

function clearBall(player) {
  // Defensive clear: kick ball far away toward touchline or upfield
  const t = player.side === 1 ? telem.red : telem.blue;
  t.clears++;
  telemEvent(player.side === 1 ? 'RED' : 'BLUE', 'CLEAR', `${player.role}`);
  player.hasBall = false;
  player.holdTime = 0;
  player.intention = null;
  ball.owner = null;
  const dir = player.side === 1 ? 1 : -1;
  ball.vx = dir * (22 + Math.random() * 8);
  ball.vy = (Math.random() - 0.5) * 14;
  ball.vz = 4 + Math.random() * 2;
  passGrace = 20;
  lastPasserSide = player.side;
  // Always log clear event in telemetry and event log if forced
  if (arguments.length > 1 && arguments[1]) {
    telemEvent(player.side === 1 ? 'RED' : 'BLUE', 'CLEAR', `FORCED by ${player.role}`);
  }
}

// ============================================================
// PLAYER AI TICK
// ============================================================
function smoothVelocity(player, desiredVx, desiredVy, blendRate) {
  player.vx = lerp(player.vx, desiredVx, blendRate);
  player.vy = lerp(player.vy, desiredVy, blendRate);
}
function getTeamPossession(team) { return team.some(p => p.hasBall) ? 1 : 0; }
function getClosestToBall(team) {
  let best = null, bestD = Infinity;
  for (const p of team) {
    if (p.isKeeper) continue;
    const d = dist(p, ball);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}
function getSecondClosestToBall(team) {
  let best = null, bestD = Infinity, second = null, secondD = Infinity;
  for (const p of team) {
    if (p.isKeeper) continue;
    const d = dist(p, ball);
    if (d < bestD) { secondD = bestD; second = best; bestD = d; best = p; }
    else if (d < secondD) { secondD = d; second = p; }
  }
  return second;
}

function updatePlayerAI(player, teammates, opponents, dt) {
  const myTeam = player.side === 1 ? teamA : teamB;
  const oppTeam = player.side === 1 ? teamB : teamA;
  const possession = getTeamPossession(myTeam);
  player.aiState = 'idle';
  if (player.isKeeper) {
    player.aiState = 'keeper';
    if (player.hasBall) { player.aiState = 'onball'; updateOnBall(player, teammates, opponents, dt); return; }
    updateKeeper(player, opponents, dt);
    return;
  }
  if (!possession) {
    const oppKeeper = oppTeam.find(p => p.isKeeper);
    if (oppKeeper && oppKeeper.hasBall && oppKeeper.keeperHandled) {
      const oppGoalX = player.side === 1 ? PITCH.w : 0;
      if (Math.abs(player.x - oppGoalX) < 16.5) {
        const retreatX = player.side === 1 ? PITCH.w - 18 : 18;
        smoothVelocity(player, (retreatX - player.x) * 0.3, 0, 0.2);
        player.aiState = 'retreat';
        return;
      }
    }
    const closest = getClosestToBall(myTeam);
    const second = getSecondClosestToBall(myTeam);
    if ((player === closest || (player === second && dist(player, ball) < 18)) && !player.justPassed) {
      player.aiState = 'chase';
      const dx = ball.x - player.x;
      const dy = ball.y - player.y;
      const d = Math.hypot(dx, dy);
      const speed = player === closest ? 8.5 : 7;
      if (d > 0.5) smoothVelocity(player, (dx / d) * speed, (dy / d) * speed, 0.25);
      if (d < 1.5 && !ball.owner && !(ball.shotInFlight > 0)) {
        ball.owner = player; player.hasBall = true; player.holdTime = 0; player.intention = null;
      }
      return;
    }
  }
  if (player.hasBall) { player.aiState = 'onball'; updateOnBall(player, teammates, opponents, dt); return; }
  if (!ball.owner && dist(player, ball) < 1.5 && !player.justPassed && !(ball.shotInFlight > 0)) {
    ball.owner = player; player.hasBall = true; player.holdTime = 0; player.intention = null;
  }
  player.aiState = possession ? 'support' : 'defend';
  const { tx, ty } = getOffBallTarget(player, teammates, opponents, ball, possession);
  player.targetX = tx; player.targetY = ty;
  const dx = tx - player.x;
  const dy = ty - player.y;
  const d = Math.hypot(dx, dy);
  if (d > 0.5) {
    const urgency = clamp(normalizedClamp(d, 1, 12), 0.4, 1);
    const maxSpeed = possession ? 7 : 8;
    smoothVelocity(player, (dx / d) * maxSpeed * urgency, (dy / d) * maxSpeed * urgency, 0.2);
  } else {
    smoothVelocity(player, 0, 0, 0.15);
  }
}

// ============================================================
// TACKLES & INTERCEPTS
// ============================================================
function checkTackles() {
  // Tackles re-enabled with gentle parameters
  if (!ball.owner) return;
  if (tackleCooldown > 0) return;
  const owner = ball.owner;
  if (owner.isKeeper && owner.keeperHandled) return;
  if (owner.tackledImmunity > 0) return; // recently dispossessed — can't be tackled yet
  const oppTeam = owner.side === 1 ? teamB : teamA;
  for (const opp of oppTeam) {
    if (opp.tackledImmunity > 0) continue;
    const d = dist(opp, ball);
    if (d < 2.0) {
      if (opp.tackleCooldown > 0) continue; // per-player cooldown: same player can't tackle repeatedly
      // Calibrated for ~18 tackles/team/90min (MLS avg). Per-player tackledImmunity handles re-tackle.
      const chance = 0.0008 + (2.0 - d) * 0.0006;
      if (Math.random() < chance) {
        owner.hasBall = false; owner.holdTime = 0; owner.intention = null;
        owner.tackledImmunity = 100;
        const oppTelem = opp.side === 1 ? telem.red : telem.blue;
        oppTelem.tacklesWon++;
        telemEvent(opp.side === 1 ? 'RED' : 'BLUE', 'TACKLE', `${opp.role} dispossesses ${owner.role}`);
        const awayAngle = Math.atan2(opp.y - owner.y, opp.x - owner.x) + (Math.random() - 0.5) * 1.2;
        ball.vx = Math.cos(awayAngle) * 12;
        ball.vy = Math.sin(awayAngle) * 12;
        ball.vz = 0.5;
        ball.owner = null;
        tackleCooldown = 10;
        passTargetPlayer = null;
        return;
      }
    }
  }
}

function checkIntercepts() {
  if (ball.owner) return;
  // During shot flight, nobody can intercept — let the ball fly
  if (ball.shotInFlight > 0) { ball.shotInFlight--; return; }
  if (passTargetPlayer && !passTargetPlayer.hasBall && passTargetPlayer.tackledImmunity <= 0) {
    const td = dist(passTargetPlayer, ball);
    if (td < 2.5) {
      ball.owner = passTargetPlayer;
      passTargetPlayer.hasBall = true;
      passTargetPlayer.holdTime = 0;
      passTargetPlayer.intention = null;
      passTargetPlayer.tackledImmunity = 25; // settling window: ~1 game-sec before opponent can tackle
      ball.vx = 0; ball.vy = 0;
      passGrace = 0;
      passTargetPlayer = null;
      return;
    }
  }
  for (const p of allPlayers) {
    if (p.tackledImmunity > 0) continue;
    if (p.isKeeper && p.keeperNoPickUp > 0) continue;
    if (p.justPassed > 0) continue;
    const d = dist(p, ball);
    const pickupR = p.isKeeper ? 0.5 : 1.5;
    if (d < pickupR) {
      if (passGrace > 0) {
        if (p.side !== lastPasserSide) continue;
        if (p === lastPasserPlayer) continue;
      }
      ball.owner = p; p.hasBall = true; p.holdTime = 0; p.intention = null;
      p.tackledImmunity = 15; // loose ball pickup: brief window before opponent can tackle
      ball.vx = 0; ball.vy = 0; passGrace = 0; passTargetPlayer = null;
      return;
    }
  }
}

function awardCornerKick(keeperSide) {
  const offendingKeeper = allPlayers.find(p => p.isKeeper && p.side === keeperSide);
  if (offendingKeeper) {
    offendingKeeper.hasBall = false; offendingKeeper.holdTime = 0;
    offendingKeeper.keeperHandled = false; offendingKeeper.keeperNoPickUp = 300;
  }
  const cornerX = keeperSide === 1 ? 2 : PITCH.w - 2;
  const cornerY = ball.y < PITCH.h / 2 ? 2 : PITCH.h - 2;
  ball.x = cornerX; ball.y = cornerY;
  ball.vx = 0; ball.vy = 0; ball.vz = 0; ball.z = 0; ball.owner = null;
  const oppTeam = keeperSide === 1 ? teamB : teamA;
  let closest = null, closestD = Infinity;
  for (const p of oppTeam) {
    if (p.isKeeper) continue;
    const d = Math.hypot(p.x - cornerX, p.y - cornerY);
    if (d < closestD) { closestD = d; closest = p; }
  }
  if (closest) {
    closest.x = cornerX; closest.y = cornerY;
    ball.owner = closest; closest.hasBall = true; closest.holdTime = 0;
  }
  passGrace = 0; passTargetPlayer = null;
}

function checkGoal() {
  const goalHalfW = 5;
  const goalYMin = PITCH.h / 2 - goalHalfW;
  const goalYMax = PITCH.h / 2 + goalHalfW;
  // Check left goal (Blue scores on Red's goal)
  if (ball.x <= 0.5 && ball.y > goalYMin && ball.y < goalYMax) {
    const offCenter = Math.abs(ball.y - PITCH.h / 2) / goalHalfW;
    const saveChance = 0.93 - offCenter * 0.25;
    if (Math.random() < saveChance) {
      // Keeper save — give ball to keeper (like a caught save → goal kick)
      ball.shotInFlight = 0;
      const keeper = teamA.find(p => p.isKeeper);
      if (keeper) {
        ball.x = keeper.x; ball.y = keeper.y;
        ball.vx = 0; ball.vy = 0; ball.vz = 0; ball.z = 0;
        ball.owner = keeper; keeper.hasBall = true; keeper.holdTime = 0;
        keeper.keeperHandled = true;
      }
      return;
    }
    score[1]++;
    telemEvent('BLUE', 'GOAL', `Score! ${score[0]}-${score[1]}`);
    doKickOff(teamA);
  } else if (ball.x >= PITCH.w - 0.5 && ball.y > goalYMin && ball.y < goalYMax) {
    const offCenter = Math.abs(ball.y - PITCH.h / 2) / goalHalfW;
    const saveChance = 0.93 - offCenter * 0.25;
    if (Math.random() < saveChance) {
      ball.shotInFlight = 0;
      const keeper = teamB.find(p => p.isKeeper);
      if (keeper) {
        ball.x = keeper.x; ball.y = keeper.y;
        ball.vx = 0; ball.vy = 0; ball.vz = 0; ball.z = 0;
        ball.owner = keeper; keeper.hasBall = true; keeper.holdTime = 0;
        keeper.keeperHandled = true;
      }
      return;
    }
    score[0]++;
    telemEvent('RED', 'GOAL', `Score! ${score[0]}-${score[1]}`);
    doKickOff(teamB);
  } else if (ball.x < -1 || ball.x > PITCH.w + 1 || ball.y < -1 || ball.y > PITCH.h + 1) {
    resetBallInBounds();
  }
}

function resetBallInBounds() {
  const outLeft = ball.x < -1;
  const outRight = ball.x > PITCH.w + 1;
  const outTop = ball.y < -1;
  const outBottom = ball.y > PITCH.h + 1;
  ball.vx = 0; ball.vy = 0; ball.vz = 0; ball.z = 0;
  if (outLeft || outRight) {
    const defendingSide = outLeft ? 1 : -1;
    const gkX = defendingSide === 1 ? 6 : PITCH.w - 6;
    ball.x = gkX; ball.y = PITCH.h / 2; ball.owner = null;
    const defTeam = defendingSide === 1 ? teamA : teamB;
    const keeper = defTeam.find(p => p.isKeeper);
    if (keeper) {
      keeper.x = gkX; keeper.y = PITCH.h / 2;
      ball.owner = keeper; keeper.hasBall = true; keeper.holdTime = 0; keeper.keeperHandled = true;
    }
    telemEvent(defendingSide === 1 ? 'RED' : 'BLUE', 'GOAL KICK', '');
    return;
  }
  if (outTop || outBottom) {
    ball.x = clamp(ball.x, 1, PITCH.w - 1);
    ball.y = outTop ? 1 : PITCH.h - 1;
    const throwSide = lastPasserSide === 1 ? -1 : 1;
    const throwTeam = throwSide === 1 ? teamA : teamB;
    let closest = null, closestD = Infinity;
    for (const p of throwTeam) {
      if (p.isKeeper) continue;
      const d = Math.hypot(p.x - ball.x, p.y - ball.y);
      if (d < closestD) { closestD = d; closest = p; }
    }
    if (closest) {
      closest.x = ball.x; closest.y = ball.y;
      ball.owner = closest; closest.hasBall = true; closest.holdTime = 0;
    }
    telemEvent(throwSide === 1 ? 'RED' : 'BLUE', 'THROW-IN', '');
    return;
  }
  ball.x = clamp(ball.x, 1, PITCH.w - 1);
  ball.y = clamp(ball.y, 1, PITCH.h - 1);
  let closest = null, closestD = Infinity;
  for (const p of allPlayers) {
    const d = dist(p, ball);
    if (d < closestD) { closestD = d; closest = p; }
  }
  if (closest) { ball.owner = closest; closest.hasBall = true; }
}

// ============================================================
// TICK
// ============================================================
function tick(dt) {
  matchTime += dt;
  if (kickOffCooldown > 0) kickOffCooldown--;
  if (passGrace > 0) passGrace--;
  if (tackleCooldown > 0) tackleCooldown--;
  if (passTrail && --passTrail.life <= 0) passTrail = null;
  for (const r of recentPassTargets) r.timer--;
  recentPassTargets = recentPassTargets.filter(r => r.timer > 0);
  for (const p of allPlayers) {
    if (p.justPassed > 0) p.justPassed--;
    if (p.tackledImmunity > 0) p.tackledImmunity--;
    if (p.shotCooldown > 0) p.shotCooldown--;
    if (p.keeperNoPickUp > 0) p.keeperNoPickUp--;
  }
  for (const p of teamA) updatePlayerAI(p, teamA, teamB, dt);
  for (const p of teamB) updatePlayerAI(p, teamB, teamA, dt);
  for (const p of allPlayers) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = clamp(p.x, 0.5, PITCH.w - 0.5);
    p.y = clamp(p.y, 0.5, PITCH.h - 0.5);
  }
  if (ball.owner) {
    ball.x = ball.owner.x; ball.y = ball.owner.y; ball.z = 0;
  } else {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.z += ball.vz * dt;
    ball.vz -= 20 * dt;
    if (ball.z < 0) { ball.z = 0; ball.vz = -ball.vz * 0.3; }
    ball.vx *= (1 - 0.7 * dt);
    ball.vy *= (1 - 0.7 * dt);
  }
  checkTackles();
  checkIntercepts();
  checkGoal();
  telemUpdate();
}

// ============================================================
// MAIN: Run simulation
// ============================================================
const GAME_MINUTES = parseInt(process.argv[2] || '5', 10);
const TARGET_MATCH_TIME = GAME_MINUTES * 3; // matchTime / 3 = game minutes
const dt = DT * GAME_SPEED_SCALE;

const FORM_A = process.argv[3] || '4-2-3-1';
const FORM_B = process.argv[4] || '4-4-2';

resetMatch(FORM_A, FORM_B);

let frame = 0;
while (matchTime < TARGET_MATCH_TIME) {
  tick(dt);
  frame++;
}

// Output telemetry
const total = telem.red.possFrames + telem.blue.possFrames || 1;
const rPoss = Math.round(telem.red.possFrames / total * 100);
const bPoss = Math.round(telem.blue.possFrames / total * 100);
const rHold = telem.red.holdCount ? Math.round(telem.red.holdTotal / telem.red.holdCount) + 'f' : '-';
const bHold = telem.blue.holdCount ? Math.round(telem.blue.holdTotal / telem.blue.holdCount) + 'f' : '-';

console.log(`=== TELEMETRY (Score: RED ${score[0]} - ${score[1]} BLUE) | ${GAME_MINUTES} game-min | ${frame} frames ===`);
console.log(`RED:  Passes ${telem.red.passes} | Shots ${telem.red.shots} | Clears ${telem.red.clears} | Tackles ${telem.red.tacklesWon} | Poss ${rPoss}% | Avg hold ${rHold}`);
console.log(`BLUE: Passes ${telem.blue.passes} | Shots ${telem.blue.shots} | Clears ${telem.blue.clears} | Tackles ${telem.blue.tacklesWon} | Poss ${bPoss}% | Avg hold ${bHold}`);
console.log(`\n=== LAST 50 EVENTS ===`);
const lastEvents = telem.events.slice(-50);
for (const ev of lastEvents) {
  console.log(`${ev.time} ${ev.team} ${ev.action} ${ev.detail}`);
}

// Summary stats for automated analysis
const goalTotal = score[0] + score[1];
const shotTotal = telem.red.shots + telem.blue.shots;
const passTotal = telem.red.passes + telem.blue.passes;
console.log(`\n=== SUMMARY ===`);
console.log(`Goals: ${goalTotal} (${score[0]}-${score[1]})`);
console.log(`Shots: ${shotTotal} (R:${telem.red.shots} B:${telem.blue.shots})`);
console.log(`Passes: ${passTotal} (R:${telem.red.passes} B:${telem.blue.passes})`);
console.log(`Possession: R:${rPoss}% B:${bPoss}%`);
console.log(`Avg hold: R:${rHold} B:${bHold}`);

// Count goals from events
const goalEvents = telem.events.filter(e => e.action === 'GOAL');
if (goalEvents.length > 0) {
  console.log(`Goal details:`);
  for (const g of goalEvents) console.log(`  ${g.time} ${g.team} ${g.detail}`);
}
