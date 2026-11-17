"""Optional VPX sidecar: drive real launch/flipper inputs; never prescribe ball paths."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'output/live-vpx'
source=(ROOT/'.work/finni-live-extracted/script.vbs').read_text()
# Only opt in with -c1 autoplay. The VPX's embedded source script is untouched.
helper=r'''

' Finni review driver: normal VPX ball physics and source game rules.
Dim FinniDemoTicks, FinniDemoLeft, FinniDemoRight
If LCase(GetCustomParam(1)) = "autoplay" Then vpmtimer.addtimer 2500, "FinniDemoStart '"
Sub FinniDemoStart
    bFreePlay = True
    If Not bGameInPlay Then Table1_KeyDown StartGameKey
    FinniDemoTicks = 0
    vpmtimer.addtimer 40, "FinniDemoTick '"
End Sub
Sub FinniDemoTick
    Dim reviewBall, leftOn, rightOn, reviewFile, reviewFSO
    FinniDemoTicks = FinniDemoTicks + 1
    leftOn = False: rightOn = False
    If bGameInPlay Then
        If bBallInPlungerLane And FinniDemoTicks Mod 60 = 0 Then Table1_KeyDown PlungerKey
        If bBallInPlungerLane And FinniDemoTicks Mod 60 = 25 Then Table1_KeyUp PlungerKey
        For Each reviewBall In GetBalls
            If reviewBall.X > 0 And reviewBall.X < 952 And reviewBall.Y > 1580 And reviewBall.Y < 1870 Then
                If reviewBall.VelY > -3 Then
                    If reviewBall.X < 465 Then leftOn = True Else rightOn = True
                End If
            End If
        Next
        leftOn = leftOn And (FinniDemoTicks Mod 12 < 5)
        rightOn = rightOn And (FinniDemoTicks Mod 13 < 5)
        If leftOn And Not FinniDemoLeft Then Table1_KeyDown LeftFlipperKey
        If Not leftOn And FinniDemoLeft Then Table1_KeyUp LeftFlipperKey
        If rightOn And Not FinniDemoRight Then Table1_KeyDown RightFlipperKey
        If Not rightOn And FinniDemoRight Then Table1_KeyUp RightFlipperKey
        FinniDemoLeft = leftOn: FinniDemoRight = rightOn
    ElseIf FinniDemoTicks Mod 100 = 0 Then
        If BallsOnPlayfield = 0 Then Table1_KeyDown StartGameKey
    End If
    If FinniDemoTicks Mod 50 = 0 Then
        On Error Resume Next
        Set reviewFSO = CreateObject("Scripting.FileSystemObject")
        Set reviewFile = reviewFSO.CreateTextFile("STATUS_PATH", True)
        reviewFile.WriteLine "VPX real physics; automatic launch/flipper inputs"
        reviewFile.WriteLine "ticks=" & FinniDemoTicks & "; playing=" & bGameInPlay & "; score=" & Score(CurrentPlayer) & "; balls=" & BallsOnPlayfield & "; locks=" & BallsInLock(CurrentPlayer) & "; fox_hits=" & LilDPHits & "; plunger=" & bBallInPlungerLane
        reviewFile.Close
        On Error Goto 0
    End If
    vpmtimer.addtimer 40, "FinniDemoTick '"
End Sub
'''.replace('STATUS_PATH',str(out/'gameplay-status.txt'))
(out/'Finni-Big-Day.vbs').write_text(source+helper)
print('AUTOPLAY_SIDECAR_READY')
