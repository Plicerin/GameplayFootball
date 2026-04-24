# Defold Editor Setup — Quick Start

This guide steps through creating a runnable minimal scene in Defold using the starter files in this folder.

1) Decode the placeholder image (PowerShell):

```
[System.Convert]::FromBase64String((Get-Content prototype\defold\assets\placeholder.png.b64)) | Set-Content -Encoding Byte prototype\defold\assets\placeholder.png
```

2) Open Defold Editor and open the project at:

```
C:/Users/vrock/OneDrive/Documents/Gameplay Football/GameplayFootball-defold/prototype/defold
```

3) Add resources
- Import `prototype/defold/assets/placeholder.png` into the project (Assets folder).
- Create an Atlas in the editor named `placeholder.atlas` and add the `placeholder` region (1x1) or use the existing `prototype/defold/assets/placeholder.atlas` as a reference.

4) Create game objects
- Player game object
  - Right-click folder → New → Game Object
  - Name: `player.go`
  - Add components:
    - Sprite: set `Image` to `placeholder.atlas` and `Region` to `placeholder`.
    - Script: set `Script` to `/scripts/player.script`.
  - In the properties set `Id` to `player`.

- Ball game object
  - New Game Object → `ball.go`
  - Add components:
    - Sprite: `placeholder.atlas` / `placeholder` (or different region if you create one)
    - Script: `/scripts/ball.script`.
  - Set `Id` to `ball`.

5) Create a collection
- New → Collection → `main.collection`
- Drag `player.go` and `ball.go` into the collection.
- For the `player` instance set its `id` to `player` and for the `ball` instance set `id` to `ball` (these IDs match the scripts' expectations: `/ball#ball`).

6) Input bindings
- Open `game.project` → Input → Open input bindings
- Add bindings:
  - `move_left`  -> Keyboard `A` and `Left`
  - `move_right` -> Keyboard `D` and `Right`
  - `move_up`    -> Keyboard `W` and `Up`
  - `move_down`  -> Keyboard `S` and `Down`
  - `kick`       -> Keyboard `Space`
  - `click`      -> Mouse button `Left` and Touch `Tap`

7) Create a main game object
- New Game Object → `main.go` with Script `/scripts/main.script` and add it to `main.collection`.

8) Run
- Press `Project > Build and Launch` (or Run) in Defold. Use keyboard or click to move player; click near the ball to kick it.

Notes:
- The scripts assume the ball instance path is `/ball#ball`. If you change IDs, update `player.script` accordingly.
- Tweak `prototype/defold/data/game_constants.json` values to tune feel.
