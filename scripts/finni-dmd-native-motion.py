"""Install a display-only timer; leave the DMD event queue and rules intact."""
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
DECL=b'Dim FinniDmdMotion, FinniDmdScene, FinniDmdFrame\r\nFinniDmdMotion = True\r\n'
OLD=b'            Digits(40).ImageA = dLine(2)\r\n            If UseFlexDMD Then DMDScene.GetImage("Back").Bitmap = FlexDMD.NewImage("", "VPX." & dLine(2) & "&dmd=2").Bitmap'
NEW=b'            value = FinniDmdImage(dLine(2))\r\n            Digits(40).ImageA = value\r\n            If UseFlexDMD Then DMDScene.GetImage("Back").Bitmap = FlexDMD.NewImage("", "VPX." & value & "&dmd=2").Bitmap'
SCORE_CALL=b'DMD tmp, tmp1, tmp2, eNone, eNone, eNone, 25, True, ""'
THEMED_SCORE_CALL=SCORE_CALL.replace(b'tmp2', b'FinniScoreScene(tmp2)')


def score_display(script):
    assert script.count(SCORE_CALL)==1
    script=script.replace(SCORE_CALL,THEMED_SCORE_CALL)
    score_cases=json.loads((ROOT/'assets/finni/dmd/animations.json').read_text())
    registrations=b''.join(
        f'        Case "{name}": FinniDmdAnimated = True\r\n'.encode('ascii')
        for name in score_cases
        if name.startswith('d_score_') and f'Case "{name}":'.encode('ascii') not in script
    )
    index=script.index(b'    End Select',script.index(b'Function FinniDmdAnimated(scene)'))
    script=script[:index]+registrations+script[index:]
    block='''
Function FinniScoreScene(background)
    FinniScoreScene = background
    If background <> "bkborder" Then Exit Function
    Select Case Battle(CurrentPlayer, 0)
        Case 1: FinniScoreScene = "d_score_presents"
        Case 2: FinniScoreScene = "d_score_invites"
        Case 3: FinniScoreScene = "d_score_balloons"
        Case 4: FinniScoreScene = "d_score_decorations"
        Case 5: FinniScoreScene = "d_score_cookies"
        Case 6: FinniScoreScene = "d_score_pinata"
        Case 7: FinniScoreScene = "d_score_party"
        Case Else
            If bLilDPMB Then
                FinniScoreScene = "d_score_cake"
            ElseIf bNinjaMB Then
                FinniScoreScene = "d_score_friendship"
            ElseIf bMechSuitMBStarted Then
                FinniScoreScene = "d_score_supplyrun"
            ElseIf bDiscoMBEnabled Then
                FinniScoreScene = "d_score_discomb"
            ElseIf bDiscoLoopsEnabled Then
                FinniScoreScene = "d_score_disco"
            ElseIf bKatanaramaTime Then
                FinniScoreScene = "d_score_streamers"
            ElseIf bBerserker Then
                FinniScoreScene = "d_score_spinner"
            Else
                FinniScoreScene = "d_score_garden"
            End If
    End Select
End Function
'''.replace('\n','\r\n').encode('ascii')
    marker=b"' FINNI MOTION END"
    assert script.count(marker)==1
    return script.replace(marker,block+marker)


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
    return score_display(source.replace(marker,block+marker,1))


def restore_motion(script):
    script=re.sub(rb"\r\n' FINNI MOTION BEGIN.*?' FINNI MOTION END\r\n",b'',script,flags=re.S)
    return script.replace(DECL,b'').replace(NEW,OLD).replace(THEMED_SCORE_CALL,SCORE_CALL)
