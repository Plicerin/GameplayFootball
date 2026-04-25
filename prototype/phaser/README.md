# Phaser Prototype — 11versus11 Pixel Soccer Mini

How to run

- Open `prototype/phaser/index.html` in a modern browser (double-click). This uses a CDN copy of Phaser and needs no build step.
- Alternatively, serve the folder from a simple HTTP server to avoid file:// limitations:

```powershell
# from workspace root
python -m http.server 8000
# then open http://localhost:8000/GameplayFootball/prototype/phaser/index.html
```

What this prototype does

- Programmatically spawns a player, AI opponent, and a ball (no Editor needed).
- Player: arrow keys to move.
- AI: simple chase-the-ball behavior.
- Ball: arcade physics with bounce and basic kicking on contact.

Next steps I can do for you

- Add proper input mapping and touch controls.
- Replace rectangle/circle placeholders with your art.
- Add basic scoring and timed matches.
- Convert this into an Electron/Desktop runner or build pipeline.
