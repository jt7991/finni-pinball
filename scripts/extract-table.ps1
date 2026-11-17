param([Parameter(Mandatory=$true)][string]$TablePath)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot
$taskSource=(Resolve-Path -LiteralPath $TablePath).Path
if([IO.Path]::GetExtension($taskSource) -ne '.vpx'){throw 'Pass the .vpx table file.'}
$taskExtractor=Join-Path $taskRoot '.tools/vpxtool/vpxtool.exe'
$taskExtracted=Join-Path $taskRoot '.work/deadpool-extracted'
$taskScene=Join-Path $taskRoot '.work/deadpool-scene'
& $taskExtractor verify $taskSource
if($LASTEXITCODE -ne 0){throw 'VPX verification failed.'}
& $taskExtractor extract --output-dir $taskExtracted $taskSource
if($LASTEXITCODE -ne 0){throw 'VPX extraction failed.'}
& $taskExtractor export gltf --format glb --units m --output-dir $taskScene $taskSource
if($LASTEXITCODE -ne 0){throw 'VPX scene export failed.'}
Get-ChildItem -LiteralPath $taskScene -File | Select-Object Name,Length
Get-ChildItem -LiteralPath $taskExtracted -Recurse -File | Where-Object {$_.Name -match 'deadpool|mini|lil|toy|playfield'} | Select-Object FullName,Length
