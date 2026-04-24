<#
setup_defold_project.ps1

Automates the remaining local setup steps for the Defold starter project.

What it does:
- Decodes the placeholder base64 PNG into `assets\placeholder.png`.
- Creates helpful editor-ready stub files and fixtures you can open in Defold.
- Opens the project folder in Explorer when finished.

Note: The Defold editor keeps authoritative state for .go/.collection/.factory assets.
This script creates plain-text stubs and helper files to speed the editor work, but
you should open the project in Defold and use the Editor to create the actual
Game Objects and Factories (quick steps are provided in the generated stubs).

Run from the project root (PowerShell):
  cd "..\prototype\defold"
  .\setup_defold_project.ps1

#>

Write-Host "Running Defold project setup helper..."

$assetsDir = Join-Path $PSScriptRoot "assets"
if (-not (Test-Path $assetsDir)) { New-Item -ItemType Directory -Path $assetsDir | Out-Null }

$b64File = Join-Path $assetsDir "placeholder.png.b64"
$pngFile = Join-Path $assetsDir "placeholder.png"

if (Test-Path $b64File) {
  Write-Host "Decoding placeholder image..."
  # extract the first base64-like token from the file
  $raw = Get-Content -Raw $b64File
  $token = ($raw -split '\s+') | Where-Object { $_ -match '^[A-Za-z0-9+/=]+$' } | Select-Object -First 1
  if (-not $token) { Write-Error "Could not find base64 token in $b64File"; exit 1 }
  [System.Convert]::FromBase64String($token) | Set-Content -Encoding Byte $pngFile
  Write-Host "Wrote $pngFile"
} else {
  Write-Warning "$b64File not found - skipping image decode"
}

# Write simple editor stubs (human-editable instructions)
$stubs = @{
  "player.go.txt" = "Create a Game Object named 'player.go' in the Defold Editor and add Sprite + Script -> /scripts/player.script. Then create a Factory from it named 'player_factory'.";
  "ball.go.txt"   = "Create a Game Object named 'ball.go' and add Sprite + Script -> /scripts/ball.script. Create a Factory named 'ball_factory'.";
  "ai_player.go.txt" = "Create a Game Object 'ai_player.go' with Sprite + Script -> /scripts/ai_opponent.script. Create Factory 'ai_player_factory'.";
  "main.collection.txt" = "Open Defold -> File -> New -> Collection -> main.collection. Add 'main.go' (script /scripts/main.script) and 'spawner.go' (script /scripts/spawner.script).";
}

foreach ($name in $stubs.Keys) {
  $path = Join-Path $PSScriptRoot $name
  $stubs[$name] | Out-File -FilePath $path -Encoding UTF8
  Write-Host "Created stub: $path"
}

Write-Host "Opening project folder in Explorer..."
Start-Process explorer.exe -ArgumentList $PSScriptRoot

Write-Host 'Setup helper finished. Please open the project in the Defold Editor and follow the stub instructions to create Game Objects and Factories.'
