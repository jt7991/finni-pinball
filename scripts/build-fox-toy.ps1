$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskRoot = Split-Path $PSScriptRoot
$taskOutput = Join-Path $taskRoot 'output/concept-v1'
New-Item -ItemType Directory -Force -Path $taskOutput | Out-Null
$taskCanvas = New-Object Drawing.Bitmap 900,1000
$taskCanvas.SetResolution(144,144)
$taskGraphics = [Drawing.Graphics]::FromImage($taskCanvas)
$taskGraphics.Clear([Drawing.Color]::Transparent)
$taskGraphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$taskGraphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$taskGraphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality

function New-TaskBrush([string]$color) { return New-Object Drawing.SolidBrush ([Drawing.ColorTranslator]::FromHtml($color)) }
function New-TaskPen([string]$color,[single]$width) { return New-Object Drawing.Pen ([Drawing.ColorTranslator]::FromHtml($color)),$width }

# Mounting plinth: a rounded purple base, separate from the site's character art.
$taskBasePath = New-Object Drawing.Drawing2D.GraphicsPath
$taskBasePath.AddArc(125,850,650,100,180,180)
$taskBasePath.AddLine(775,900,775,930)
$taskBasePath.AddArc(125,880,650,100,0,180)
$taskBasePath.CloseFigure()
$taskBaseFill = New-Object Drawing.Drawing2D.LinearGradientBrush ([Drawing.Point]::new(125,850)),([Drawing.Point]::new(775,980)),([Drawing.ColorTranslator]::FromHtml('#8272F5')),([Drawing.ColorTranslator]::FromHtml('#382752'))
$taskGraphics.FillPath($taskBaseFill,$taskBasePath)
$taskRim = New-TaskPen '#352342' 6
$taskGraphics.DrawPath($taskRim,$taskBasePath)
$taskTopFill = New-Object Drawing.Drawing2D.LinearGradientBrush ([Drawing.Point]::new(125,850)),([Drawing.Point]::new(700,950)),([Drawing.ColorTranslator]::FromHtml('#D1BCE7')),([Drawing.ColorTranslator]::FromHtml('#8272F5'))
$taskGraphics.FillEllipse($taskTopFill,125,850,650,100)
$taskGraphics.DrawEllipse((New-TaskPen '#F2E9FF' 3),133,852,634,90)
$taskGraphics.FillEllipse((New-TaskBrush '#30243B'),355,867,190,44)

# A visible spring communicates the existing table toy's articulated mounting.
for($taskCoil=0; $taskCoil -lt 7; $taskCoil++) {
    $taskY = 789 + $taskCoil * 15
    $taskGraphics.FillEllipse((New-TaskBrush '#544D55'),400,$taskY,100,28)
    $taskGraphics.DrawEllipse((New-TaskPen '#B3AAB8' 7),400,$taskY,100,28)
    $taskGraphics.DrawArc((New-TaskPen '#FFFDF9' 3),402,($taskY+1),96,23,185,140)
}
foreach($taskBoltX in @(210,670)) {
    $taskGraphics.FillEllipse((New-TaskBrush '#382752'),($taskBoltX-2),891,28,18)
    $taskGraphics.FillEllipse((New-TaskBrush '#D2CED7'),$taskBoltX,888,24,16)
    $taskGraphics.DrawLine((New-TaskPen '#665D70' 2),($taskBoltX+6),896,($taskBoltX+18),896)
}

# Preserve the supplied Finni face and paws; add only a subtle thickness edge.
$taskFox = [Drawing.Image]::FromFile((Join-Path $taskRoot 'assets/finni/originals/fox-leaning.png'))
$taskDestination = New-Object Drawing.Rectangle 50,30,800,787
$taskEdgeMatrix = New-Object Drawing.Imaging.ColorMatrix
$taskEdgeMatrix.Matrix00=0; $taskEdgeMatrix.Matrix11=0; $taskEdgeMatrix.Matrix22=0
$taskEdgeMatrix.Matrix33=1; $taskEdgeMatrix.Matrix40=0.29; $taskEdgeMatrix.Matrix41=0.12; $taskEdgeMatrix.Matrix42=0.025
$taskAttributes = New-Object Drawing.Imaging.ImageAttributes
$taskAttributes.SetColorMatrix($taskEdgeMatrix)
for($taskDepth=10; $taskDepth -ge 2; $taskDepth-=2) {
    $taskEdgeRect = New-Object Drawing.Rectangle (50+$taskDepth),(30+$taskDepth),800,787
    $taskGraphics.DrawImage($taskFox,$taskEdgeRect,0,0,$taskFox.Width,$taskFox.Height,[Drawing.GraphicsUnit]::Pixel,$taskAttributes)
}
$taskGraphics.DrawImage($taskFox,$taskDestination)
$taskCanvas.Save((Join-Path $taskOutput 'finni-fox-toy.png'),[Drawing.Imaging.ImageFormat]::Png)
$taskFox.Dispose(); $taskGraphics.Dispose(); $taskCanvas.Dispose()
Write-Output 'Saved output/concept-v1/finni-fox-toy.png (900 x 1000, transparent)'
