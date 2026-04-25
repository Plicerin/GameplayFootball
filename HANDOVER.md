**Handover — 11versus11 Pixel Soccer Mini (Prototype)**

- **Repo root:** Project workspace is at `GameplayFootball`.
- **Primary prototype locations:** `prototype/defold` (Defold starter) and `prototype/phaser` (code-first Phaser prototype).

**Status Summary**
- **Defold starter:** Skeleton created (scripts, factories, stubs). Many `.go` / `.collection` files were hand-edited and triggered Editor parse issues; authoritative Game Objects and Collections must be created inside the Defold Editor. Helper scripts and `*.stub` files are provided to minimize manual typing.
- **Phaser prototype:** Working programmatic 1v1 prototype implemented at `prototype/phaser` (no Editor required). Includes `index.html`, `main.js`, a local `phaser.min.js` fallback, and `README.md` with run instructions.

**How to run the Phaser prototype (quick)**
- From the workspace root run a simple HTTP server and open the URL in a browser (recommended):

```powershell
# from workspace root
python -m http.server 8000
# then open in browser:
http://localhost:8000/GameplayFootball/prototype/phaser/index.html
```

- Notes: The prototype includes a local `phaser.min.js` fallback if the CDN is blocked. If you see a white page, open DevTools (F12) and check for a small diagnostics overlay at bottom-left — it reports file fetch sizes and whether Phaser initialized.

**Key files**
- `prototype/phaser/index.html` — loader + error overlay + local-fallback logic.
- `prototype/phaser/main.js` — programmatic spawner, player controls, AI, physics.
- `prototype/phaser/phaser.min.js` — local Phaser fallback (bundled for offline/blocked networks).
- `prototype/defold/` — Defold starter, factories, scripts, helpers and `.stub` files. Editor must be used to finalize `.go` and `.collection` assets.
- `prototype/defold/setup_defold_project.ps1` and `prototype/defold/tools/recreate_main_collection.ps1` — helpers to decode placeholder assets and guide Editor recreation.

**Known issues & troubleshooting**
- Defold Editor rejects hand-authored `.go` / `.collection` files. Workaround: open the Editor, create assets manually using the provided factories and attach the provided script files.
- Browser extensions can mask real runtime errors (extension console messages). If you see no errors but a white page, try Incognito or another browser.
- If CDN loading is blocked, `index.html` will attempt the local `phaser.min.js`. Confirm local copy exists at `prototype/phaser/phaser.min.js`.

**Next recommended steps**
1. Verify Phaser prototype locally and confirm desired features: scoring, timing, multi-player spawn logic. The Phaser prototype is code-first — easy to extend and CI-automate.
2. Decide engine for main port (Godot recommended if you want Editor + scriptable text scenes; Phaser or Love2D if you want code-first). I can create a Godot or Love2D variant on request.
3. If staying with Defold: open Defold Editor, recreate `main.collection` and the `spawner` Game Object using the `prototype/defold` scripts and factories. I can generate a checklist for the Editor steps or produce Editor automation scripts where feasible.

**Operational notes for maintainers**
- To run the Phaser prototype unattended on a headless machine, serve `prototype/phaser` via any HTTP server and use a headless browser for CI tests.
- Telemetry/logging hooks: `main.js` is simple and can be instrumented to emit JSON telemetry similar to the original harness.

**Contacts / where to look for context**
- Conversation and change history are in the repository commit messages and in the Copilot chat transcript stored locally (see your VS Code workspace storage for the Chat transcript if needed).

If you want, I can now:
- Add scoring + match timer to the Phaser prototype.
- Port this prototype to Godot with programmatic scene creation so Editor work is minimal.
- Produce a Defold Editor checklist that walks someone step-by-step to recreate the `main.collection` and `spawner` Game Object.

---
Generated: 2026-04-25
