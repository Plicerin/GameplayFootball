# Defold Starter — Build Instructions

1. Install Defold Editor: https://defold.com
2. Create or open a Defold project.
3. Copy the `prototype/defold/` folder contents into your Defold project's root.
4. In the Defold Editor, create a `main.collection` and add the `main` game object, `ball` game object, and a player factory that references `player.script` and `ball.script`.
5. Replace placeholder assets with proper atlases/sprites and set up the `game.project` resolution and input bindings.

Notes:
- The provided scripts are stubs intended to be replaced with richer implementations.
- Use `prototype/defold/data/game_constants.json` to initialize tuning variables.
