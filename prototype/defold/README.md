Helper script
- There's a helper to make recreating the collection in the Defold Editor easier:

    `prototype/defold/tools/recreate_main_collection.ps1`

    Run it from PowerShell. It will rename any stub collection files so Defold won't try to parse them, create a `recreate_collection_instructions.txt` file with step-by-step Editor actions, open the instructions in Notepad, and open the project folder in Explorer.

Next options I can take for you:
 - Add initial properties (position/team/id) into the factories and/or `.go` defaults.
 - Create a spawner Game Object that contains factory components and auto-creates instances at runtime.
 - Update `prototype/defold/README.md` with step-by-step Editor instructions.
 - Commit these changes and push them to the remote.
 - Which one should I do next?
# Defold Starter — Quick Setup

Steps to open and run the 1v1 prototype in the Defold Editor:

1. Run the helper to decode the placeholder assets (if you haven't already):

```powershell
cd "c:\Users\vrock\OneDrive\Documents\Gameplay Football\GameplayFootball-defold\prototype\defold"
.\setup_defold_project.ps1
```

2. Open the Defold Editor and `Open Project` → choose this folder.

3. In the `Assets` view you should see `player.go`, `ai_player.go`, `ball.go`, and `spawner.go`.

4. Open `spawner.go` and verify factory component targets. If the factory components appear as missing,
   right-click the `.factory` files and create factory components, or re-link them in the Editor.

5. Open `main.collection` in the Editor (or create a new collection) and add `spawner.go` to the scene.

6. Run the collection — the spawner will create the player, AI, and ball instances at startup.

Configuration notes
- The `spawner.script` contains a `self.spawn_config` table at the top where you can set team counts and spawn positions.
- By default the script creates one player (team 1), one AI (team 2), and one ball. Increase `count` for each team to spawn multiple players.
- The spawner posts a `set_properties` message to each spawned instance with `team`, `id`, and `ball_path` fields. Both `player.script` and `ai_opponent.script` now handle `set_properties` and will configure themselves accordingly.

Notes:
- The placeholder atlas uses the single animation named `placeholder`. Replace with proper sprites and atlases.
- The `spawner.script` creates initial properties for `team` and `id` on the spawned objects. Scripts on `player` and `ai` should read those properties.
- For advanced setup, create `.factory` components inside a dedicated Game Object instead of using the GO-level factories.
# 11versus11 Pixel Soccer Mini — Defold Starter

This folder contains a minimal Defold project skeleton to start the migration.

Structure:
- `game.project` — Defold project settings (placeholder)
- `main.collection` — top-level collection (stub)
- `scripts/` — Lua component scripts for `player`, `ball`, and `main`
- `data/game_constants.json` — extracted game constants (already present)

How to use:
1. Open Defold Editor and choose "New Project" or open an existing project.
2. Copy the files from this folder into your Defold project directory, or import them as needed.
3. Replace placeholder assets with your art and adjust `game.project` settings.

Next steps:
- Implement Defold `gui`, `atlas`, and sprite resources.
- Create collections for `field`, `team`, and `player` prefabs.
- Hook up `player.script` and `ball.script` to game objects and test basic movement.
