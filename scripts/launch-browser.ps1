param([int]$Port = 8765)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot
$python = Join-Path $taskRoot '.tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe'
if (!(Test-Path -LiteralPath $python)) { throw 'Install the local Blender Python runtime described in README.md first.' }
& $python (Join-Path $PSScriptRoot 'serve-browser.py') --port $Port
