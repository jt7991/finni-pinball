"""Install a display-only timer; leave the DMD event queue and rules intact."""
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
DECL=b'Dim FinniDmdMotion, FinniDmdScene, FinniDmdFrame\r\nFinniDmdMotion = True\r\n'
OLD=b'            Digits(40).ImageA = dLine(2)\r\n            If UseFlexDMD Then DMDScene.GetImage("Back").Bitmap = FlexDMD.NewImage("", "VPX." & dLine(2) & "&dmd=2").Bitmap'
NEW=b'            value = FinniDmdImage(dLine(2))\r\n            Digits(40).ImageA = value\r\n            If UseFlexDMD Then DMDScene.GetImage("Back").Bitmap = FlexDMD.NewImage("", "VPX." & value & "&dmd=2").Bitmap'


def friendship_events():
    edits=[]
    for count,word in enumerate(('ONE FRIEND','TWO FRIENDS','THREE FRIENDS'),1):
        old=f'DMD "", CL(1, "{word} READY"), "d_finni_friendship"'.encode()
        new=old.replace(b'"d_finni_friendship"',f'"d_finni_friend{count}"'.encode())
        edits.append((old,new))
    edits.append((b'DMD "", CL(1, "MULTIBALL"), "d_finni_friendship"',
                  b'DMD "", "", "d_finni_friendship_start"'))
    return edits


def restore_friendship_events(script):
    for old,new in reversed(friendship_events()):script=script.replace(new,old)
    return script


def animate_script(source):
    for old,new in friendship_events():
        assert source.count(old)==1,old
        source=source.replace(old,new,1)
    # Route real events that still had plain backgrounds into protected,
    # two-row reward art. Every effect, duration, queue flag and voice survives.
    lines=[]
    for line in source.splitlines(keepends=True):
        if b'DMD ' in line and not line.lstrip().startswith(b"'"):
            if b'BALL SAVED' in line:
                line=line.replace(b'DMD "_", CL(1, "BALL SAVED"), "_",',b'DMD "", "", "d_ballsaved",')
            elif b'"bkborder", e' in line:
                if b'JACKPOT' in line or b'SKILLSHOT' in line:
                    line=line.replace(b'"bkborder", e',b'"d_finni_award", e')
                elif b'GATHER FRIENDS' in line:
                    line=line.replace(b'"bkborder", e',b'"d_finni_ready", e')
            else:
                effect='bonus' if b'BONUS' in line else 'combo' if b'COMBO' in line else 'ready' if b'EXTRA BALL' in line or b'MYSTERY IS LIT' in line else None
                if effect:
                    line=re.sub(rb', "[_]?", (e\w+,)',lambda m:b', "d_finni_'+effect.encode()+b'", '+m[1],line)
        lines.append(line)
    source=b''.join(lines)
    animations=json.loads((ROOT/'assets/finni/dmd/animations.json').read_text())
    source=source.replace(b'Sub DMD_Init()',DECL+b'Sub DMD_Init()',1)
    assert source.count(OLD)==1
    source=source.replace(OLD,NEW)
    cases='\n'.join('        Case "'+name+'": FinniDmdAnimated = True' for name in animations)
    block='''
' FINNI MOTION BEGIN
Function FinniDmdAnimated(scene)
    FinniDmdAnimated = False
    Select Case LCase(scene)
CASES
    End Select
End Function

Function FinniDmdImage(scene)
    If scene <> FinniDmdScene Then
        FinniDmdScene = scene
        FinniDmdFrame = 0
    End If
    FinniDmdImage = scene
    If FinniDmdMotion And FinniDmdAnimated(scene) Then
        FinniDmdImage = scene & "_anim" & Right("0" & CStr(FinniDmdFrame), 2)
    End If
End Function

Sub FinniDmdAnimationTimer_Timer()
    If Not FinniDmdMotion Then Exit Sub
    If Not FinniDmdAnimated(dLine(2)) Then Exit Sub
    FinniDmdFrame = (FinniDmdFrame + 1) Mod 12
    DMDUpdate 2
End Sub
' FINNI MOTION END
'''.replace('CASES',cases).replace('\n','\r\n').encode('ascii')
    marker=b"' JP's new DMD"
    assert source.count(marker)==1
    return source.replace(marker,block+marker,1)


def restore_motion(script):
    script=re.sub(rb"\r\n' FINNI MOTION BEGIN.*?' FINNI MOTION END\r\n",b'',script,flags=re.S)
    return script.replace(DECL,b'').replace(NEW,OLD)
