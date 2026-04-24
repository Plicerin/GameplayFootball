<#
Helper: recreate_main_collection.ps1

What it does:
- Renames any existing hand-written `main.collection` or `logic/main.collection` to `*.stub` to avoid Defold parsing errors.
- Verifies required `.go` and `.factory` files exist and prints warnings if missing.
- Writes a `recreate_collection_instructions.txt` file with step-by-step Editor actions and opens it in Notepad.
- Opens the project folder in Explorer so you can switch to the Defold Editor and follow the steps.

Usage:
PowerShell> .\recreate_main_collection.ps1
# Run from `prototype/defold/tools` or double-click in Explorer.
#>

Set-StrictMode -Version Latest
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projDir = Resolve-Path (Join-Path $scriptDir "..")
Set-Location $projDir

Write-Host "Project folder:" (Get-Location)

$required = @(
  "spawner.go",
  "player.go",
  "ball.go",
  "player_factory.factory",
  "ai_player_factory.factory",
  "ball_factory.factory",
  "scripts\spawner.script",
  "scripts\player.script",
  "scripts\ai_opponent.script"
)

$missing = @()
foreach ($f in $required) {
  if (-not (Test-Path $f)) { $missing += $f }
}
if ($missing.Count -gt 0) {
  Write-Host "Warning: missing files:" -ForegroundColor Yellow
  $missing | ForEach-Object { Write-Host " - $_" }
  Write-Host "Continue anyway? Press Y to continue, any other key to abort." -NoNewline
  $k = [System.Console]::ReadKey($true)
  if ($k.Key -ne 'Y') { Write-Host "Aborted."; exit 1 }
}

function SafeRename($path) {
  if (Test-Path $path) {
    $new = $path + ".stub"
    Rename-Item -Path $path -NewName $new -Force
    Write-Host "Renamed $path -> $new"
  }
}

SafeRename "main.collection"
SafeRename "logic\main.collection"

$instr = @"
Defold Editor — recreate `main.collection` (follow these steps)

1) Open Defold Editor -> File -> New -> Collection. Save it as `main.collection` in the project root or under `/logic`.

2) Create or confirm the following assets exist in the Assets panel:
   - `spawner.go` (Game Object) with Factory components: `player_factory`, `ai_player_factory`, `ball_factory` and a Script component `/scripts/spawner.script`.
   - `player.go` (Game Object) with Script `/scripts/player.script` and sprite set to `/assets/placeholder.atlas -> placeholder`.
   - `ball.go` (Game Object) with Script `/scripts/ball.script` and sprite placeholder.
   - If any Factory components are empty, right-click the corresponding `.go` and choose Create Factory (name it `player_factory`, etc.).

3) Drag `spawner.go` into the newly created `main.collection` scene. Position it at 0,0.

4) Save the collection. Defold will write a proper `.collection`/.collectionc file.

5) In the Editor, Project -> Reload Project. Then run the collection (Play button) to spawn the player, AI, and ball.

Notes:
- If you prefer, create `main.collection` under `/logic` and set `game.project` main.collection accordingly.
- The spawner sends `set_properties` messages; ensure scripts are attached to `player` and `ai` GOs.
"@

$instrPath = Join-Path $projDir "recreate_collection_instructions.txt"
Set-Content -Path $instrPath -Value $instr -Encoding UTF8
Write-Host "Wrote instructions to: $instrPath"

Start-Process notepad.exe -ArgumentList $instrPath
Start-Process explorer.exe -ArgumentList (Get-Location)

Write-Host "Helper finished. Open the Defold Editor and follow the instructions in Notepad." -ForegroundColor Green
