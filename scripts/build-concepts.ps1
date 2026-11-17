$ErrorActionPreference = 'Stop'
$taskRoot = (Split-Path $PSScriptRoot).Replace('\','/')
$taskOutput = Join-Path $taskRoot 'output/concept-v1'
New-Item -ItemType Directory -Force -Path $taskOutput | Out-Null
$taskStyles = Get-Content -LiteralPath (Join-Path $taskRoot 'design/concept-v1/styles.css') -Raw
$taskArt = (Get-Content -LiteralPath (Join-Path $taskRoot 'design/concept-v1/playfield-art.html') -Raw).Replace('__ROOT__',$taskRoot)
$taskHardware = Get-Content -LiteralPath (Join-Path $taskRoot 'design/concept-v1/hardware.svg') -Raw
$taskToy = '<img class="toy" src="'+$taskRoot+'/output/concept-v1/finni-fox-toy.png" alt="Finni fox spring-mounted toy concept">'
$taskFlat = $taskArt.Replace('<!-- HARDWARE -->','').Replace('<!-- TOY -->','')
$taskAssembled = $taskArt.Replace('<!-- HARDWARE -->',$taskHardware).Replace('<!-- TOY -->',$taskToy)
$taskHead = '<!doctype html><html lang="en"><meta charset="utf-8"><style>'+$taskStyles
$taskFlatPage = $taskHead+'body{width:1500px;height:3225px;background:#fbf7f0}.pf{transform:scale(1.5);transform-origin:top left}</style><title>Finni playfield base artwork</title>'+$taskFlat+'</html>'
[IO.File]::WriteAllText((Join-Path $taskOutput 'finni-playfield-base.html'),$taskFlatPage)
$taskMockupStyle = @'
body{width:1500px;height:3070px;background:#eee6da;background-image:radial-gradient(ellipse at 50% 30%,#fffaf2,#e1d7ce);overflow:hidden}.masthead{position:absolute;left:118px;top:44px;width:1264px;display:flex;justify-content:space-between;align-items:baseline;font-size:14px;letter-spacing:3px;color:#5b4560}.masthead strong{font-size:24px;letter-spacing:1px}.machine{position:absolute;left:101px;top:105px;padding:25px;width:1298px;height:2738px;background:linear-gradient(100deg,#302938,#5c5063 13px,#231c2d 22px,#302938 97%,#17121d);border:2px solid #675a69;border-radius:27px;box-shadow:0 30px 55px #3a263e45,0 4px 8px #3a263e50}.machine .well{position:relative;width:1248px;height:2683px;overflow:hidden;border-radius:9px}.machine .pf{transform:scale(1.248);transform-origin:top left}.bottom-rail{position:absolute;left:102px;top:2821px;width:1296px;height:94px;background:linear-gradient(#504456,#302936 20%,#24202b);border:2px solid #5e5264;border-radius:6px 6px 22px 22px;box-shadow:0 15px 24px #3a263e30}.button{position:absolute;left:613px;top:16px;border:6px solid #817988;border-radius:50%;width:59px;height:59px;background:radial-gradient(circle at 35% 30%,#f9efd9,#b3a4dc 36%,#6c54c5 65%,#352343);box-shadow:0 0 0 3px #1d1725,0 0 18px #d1bce75c}.caption{position:absolute;top:2960px;left:118px;right:118px;font-size:15px;color:#69586b;display:flex;justify-content:space-between}.caption b{color:#49344f}.toy-label{position:absolute;left:1025px;top:860px;z-index:10;font-size:13px;color:#49344f;border:1px solid #bfb2c9;background:#fffaf1eb;padding:9px 12px;border-radius:20px;box-shadow:0 4px 8px #30243b10}
'@
$taskMockupBody = '<div class="masthead"><strong>finni / pinball</strong><span>PLAYFIELD + FOX &nbsp; / &nbsp; CONCEPT 01</span></div><div class="machine"><div class="well">'+$taskAssembled+'</div></div><div class="bottom-rail"><div class="button"></div></div><div class="caption"><b>Original Finni mascot artwork. Fox-forward, garden-inspired reskin.</b><span>Illustrative hardware / VPX fit pending</span></div>'
[IO.File]::WriteAllText((Join-Path $taskOutput 'finni-combined-playfield.html'),($taskHead+$taskMockupStyle+'</style><title>Finni assembled playfield concept</title>'+$taskMockupBody+'</html>'))
Write-Output 'Built playfield-base and combined-playfield HTML exports.'
