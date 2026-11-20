"""Execute the delivered chooser and restart handler with Windows Script Host."""
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT/'.work/finni-live-extracted/script.vbs').read_text()

def sub(name):
    return re.search(r'^Sub '+name+r'\b.*?^End Sub', source, re.M | re.S | re.I)[0] + '\n'

fixture = '''
Dim Battle(4,7), LifeLeft(4,7), CurrentPlayer, Battlenr, BattlesToChoose
Dim bChooseBattle, bGameInPlay, Tilted, bFreePlay, BallsOnPlayfield
Dim hsbModeActive, starts, selected, updates, booms
Const LeftFlipperKey=1, RightFlipperKey=2, PlungerKey=3, StartGameKey=4
Const LockBarKey=5, RightMagnaSave=6, LeftTiltKey=7, RightTiltKey=8
Const CenterTiltKey=9, MechanicalTilt=10, AddCreditKey=11, AddCreditKey2=12
Sub Assert(ok, message)
    If Not ok Then WScript.Echo message:WScript.Quit 1
End Sub
Sub StartBattle(n)
    selected=n
End Sub
Sub DMD(a,b,c,d,e,f,g,h,i)
End Sub
Sub DMDFlush
End Sub
Function ShowLife(n)
    ShowLife=n
End Function
Function RL(a,b)
    RL=b
End Function
Sub ResetForNewGame
    starts=starts+1:bGameInPlay=True
End Sub
Sub BoomHit
    booms=booms+1
End Sub
CurrentPlayer=1:BattlesToChoose=3
Dim i:For i=1 To 7:LifeLeft(1,i)=10:LifeLeft(2,i)=10:Next
Battle(1,3)=1:LifeLeft(1,3)=0:Battlenr=2:bChooseBattle=True
ChooseBattle RightFlipperKey
Assert Battlenr=1, "Right must skip completed balloons and wrap"
ChooseBattle LeftFlipperKey
Assert Battlenr=2, "Left must skip completed balloons and wrap"
Battlenr=3:UpdateDMDBattle
Assert Battlenr=1, "Reopening must skip the previously completed choice"
Battlenr=3:selected=0:ChooseBattle LockBarKey
Assert selected=0, "Cannot confirm a completed task"
LifeLeft(1,3)=5:ChooseBattle LockBarKey
Assert selected=0, "Completion flag must prevent replay even with positive life"
CurrentPlayer=2:ChooseBattle LockBarKey
Assert selected=3, "Progress must be per player"
CurrentPlayer=1:Battle(1,3)=0:LifeLeft(1,3)=2:Battlenr=2
ChooseBattle RightFlipperKey:ChooseBattle LockBarKey
Assert selected=3, "Unfinished tasks must remain selectable"
For i=1 To 3:Battle(1,i)=1:LifeLeft(1,i)=0:Next
NextPartyTask 1
Assert Battlenr>=1 And Battlenr<=3, "No eligible tasks must terminate safely"
BattlesToChoose=6:Battlenr=3:NextPartyTask 1
Assert Battlenr=4, "Unlocked tasks must remain reachable"
bChooseBattle=False:bGameInPlay=False:bFreePlay=True:BallsOnPlayfield=0
Table1_KeyDown StartGameKey
Assert starts=1 And bGameInPlay, "First game must start"
bGameInPlay=False
Table1_KeyDown StartGameKey
Assert starts=2 And bGameInPlay, "Second game must start after game over"
Table1_KeyDown LockBarKey
Assert booms=1, "Action must invoke the existing special ability"
WScript.Echo "PASS: task selection, player isolation, two starts, action"
'''
out=ROOT/'.work/party-controls-test.vbs'
out.write_text(sub('NextPartyTask')+sub('ChooseBattle')+sub('UpdateDMDBattle')+sub('Table1_KeyDown')+fixture)
subprocess.run(['cscript.exe','//Nologo',str(out)],check=True)
