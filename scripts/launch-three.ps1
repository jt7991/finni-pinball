param([int]$Port=5174,[string]$BindAddress='127.0.0.1')
$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if(-not (Test-Path -LiteralPath 'node_modules/vite/bin/vite.js')) {
    & npm.cmd ci
    if($LASTEXITCODE -ne 0){throw 'Node dependencies could not be installed.'}
}
& npm.cmd run play -- --host $BindAddress --port $Port
exit $LASTEXITCODE
