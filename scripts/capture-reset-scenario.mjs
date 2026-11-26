// Explicit approach to the original enabled scoop. Retaining the ordinary
// Ball dispatch keeps its native owner alive after the authored destruction.
export const captureResetInput='Dim CaptureResetRetained,CaptureResetBall:For Each CaptureResetBall In GetBalls():If CaptureResetBall.ID=3 Then:Set CaptureResetRetained=CaptureResetBall:CaptureResetBall.X=293.68433:CaptureResetBall.Y=530:CaptureResetBall.Z=25:CaptureResetBall.VelX=0:CaptureResetBall.VelY=-8:CaptureResetBall.VelZ=0:CaptureResetBall.AngMomX=12.3:CaptureResetBall.AngMomY=-7.5:CaptureResetBall.AngMomZ=0.625:End If:Next';
export const captureResetScenarios={floor:captureResetInput,airborne:captureResetInput.replace('Y=530','Y=500').replace('Z=25','Z=32')};
