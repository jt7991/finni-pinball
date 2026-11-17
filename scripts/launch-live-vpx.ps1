param([switch]$AutoPlay)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot
$runtime=Join-Path $taskRoot '.tools/vpx-runtime/VPinballX_GL64.exe'
$tableName=if($AutoPlay){'Finni-Autoplay.vpx'}else{'Finni-Big-Day.vpx'}
$table=Join-Path $taskRoot "output/live-vpx/$tableName"
$settings=Join-Path $taskRoot '.tools/vpx-runtime/Finni.ini'
if(!(Test-Path -LiteralPath $runtime) -or !(Test-Path -LiteralPath $table)){throw 'Build the live VPX assets and install the portable runtime first.'}
$vpxArguments=@('-Play',('"'+$table+'"'),'-DisableTrueFullscreen','-Ini',('"'+$settings+'"'))
if($AutoPlay){$vpxArguments+=@('-c1','autoplay')}
Start-Process -FilePath $runtime -ArgumentList $vpxArguments -WorkingDirectory (Split-Path $runtime)
