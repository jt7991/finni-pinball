"""Run every real DMD event through the table's VBScript display engine.

Windows Script Host runs the extracted queue, formatting, effects and character
mapping code. Only VPX timer/flasher objects, sound, and game-state inputs are
fixtures. This exercises the actual display logic without simulating gameplay.
"""
import json
from pathlib import Path
import re
import subprocess

ROOT=Path(__file__).resolve().parents[1]
TABLE=ROOT/'.work/finni-live-extracted'
OUT=ROOT/'.work/dmd-runtime-test'
OUT.mkdir(exist_ok=True)
source=(TABLE/'script.vbs').read_text()
events=[]
for line_no,line in enumerate(source.splitlines(),1):
    if line.lstrip().startswith("'"):continue
    match=re.search(r'\bDMD (.*?, e\w+.*)',line)
    if match:events.append((line_no,match[1]))
functions=set(re.findall(r'\b(\w+)\s*\(', '\n'.join(e for _,e in events)))
arrays=functions-{'CL','RL','FormatScore','SoundFXDOF','Space','dCharsPerLine','dLine'}
declarations=source[source.index('Const eNone ='):source.index('Sub DMD_Init()')]
engine=source[source.index('Sub DMD(Text0,'):source.index("' JP's new DMD")]
init=source[source.index('Sub DMDInit\r\n') if 'Sub DMDInit\r\n' in source else source.index('Sub DMDInit\n'):]
init=init[:init.index('End Sub')+len('End Sub')]
flush=source[source.index('Sub DMDFlush()'):source.index('Sub DMDScore()')]
life=source[source.index('Function Showlife(n)'):source.index('Sub DMDScoreNow')]
vbs='''
Class TestTimer
    Public Interval, Enabled
End Class
Class TestFlasher
    Public ImageA, Visible
End Class
Dim DMDTimer, DMDEffectTimer, digitgrid, UseFlexDMD, Digits, Chars(255), Images(255)
Set DMDTimer=New TestTimer
Set DMDEffectTimer=New TestTimer
Set digitgrid=New TestFlasher
UseFlexDMD=False
Sub PlaySound(s)
End Sub
Sub DMDScoreNow()
    DMDFlush
End Sub
Function SoundFXDOF(a,b,c,d)
    SoundFXDOF=""
End Function
'''
for i in range(1,42):vbs+=f'Dim digit{i:03}: Set digit{i:03}=New TestFlasher\n'
vbs+=declarations+engine+init+'\n'+flush+life+'\nDMDInit\n'
vbs+='dCharsPerLine(0)=20:dCharsPerLine(1)=20:dCharsPerLine(2)=1\n'
vbs+='deSpeed=20:deBlinkSlowRate=5:deBlinkFastRate=2\n'
vbs+='Dim digitIndex:For digitIndex=0 To 39:Digits(digitIndex).ImageA="d_empty":Next\n'
vbs+='Digits(40).ImageA="bkempty":dLine(0)=Space(20):dLine(1)=Space(20):dLine(2)="bkempty"\n'
for name in sorted(arrays):
    vbs+=f'Dim {name}(8)\n'
vbs+='Dim CurrentPlayer,Balls,Credits,PlayersPlayingGame,tmp,tmp2,myversion,stepIndex,fixture,j\n'
vbs+='CurrentPlayer=1:Balls=1:Credits=1:PlayersPlayingGame=4:tmp2=10:myversion="7.0.0"\n'
vbs+='For fixture=0 To 1\n'
for name in sorted(arrays):
    value='"FIN"' if name=='HighScoreName' else '(9+fixture*999999990)'
    if name in ('BallsInLock','NinjaStars','Chimichangas','Weapons','BonusMultiplier'):value='(1+fixture*8)'
    vbs+=f'For j=0 To 8:{name}(j)={value}:Next\n'
for n,(line_no,event) in enumerate(events):
    vbs+=f'WScript.Echo "EVENT|{n}|{line_no}|" & fixture\n'
    vbs+='tmp=10\n'
    vbs+='tmp2=10\n'
    if ', tmp,' in event or 'RL(1, tmp)' in event:vbs+='tmp=Showlife(10)\n'
    if event.startswith('tmp, tmp1, tmp2,'):
        vbs+='tmp=FL(0,"P1B1",FormatScore(Score(1))):tmp1=CL(1,"PARTY SUPPLIES"):tmp2="bkborder"\n'
    vbs+='DMDFlush\nDMD '+event+'\nDMDProcessEffectOn\n'
    vbs+='For j=0 To 40:WScript.StdOut.Write LCase(Digits(j).ImageA) & "|":Next:WScript.Echo ""\n'
    vbs+='For stepIndex=1 To 600\n'
    vbs+='If Not DMDEffectTimer.Enabled Then Exit For\nDMDEffectTimer_Timer\nNext\n'
vbs+='Next\n'
path=OUT/'all-events.vbs';path.write_text(vbs,encoding='ascii')
result=subprocess.run(['cscript.exe','//Nologo',str(path)],capture_output=True,text=True,timeout=45)
(OUT/'trace.txt').write_text(result.stdout)
assert result.returncode==0,result.stderr+'\n'+result.stdout[-1000:]
lines=result.stdout.splitlines()
assert len(lines)==len(events)*4,(len(lines),len(events),result.stdout[-500:])
manifest=json.loads((ROOT/'assets/finni/dmd/manifest.json').read_text())
frames=[]
for index in range(0,len(lines),2):
    event=lines[index].split('|');images=lines[index+1].split('|')[:41]
    assert len(images)==41,(event,images)
    assert all(name in manifest for name in images),(event,[name for name in images if name not in manifest])
    frames.append({'event':int(event[1]),'source_line':int(event[2]),'fixture':int(event[3]),'images':images})
(OUT/'frames.json').write_text(json.dumps(frames,indent=2))
report={'display_events':len(events),'fixtures':2,'executed_event_variants':len(frames),
        'actual_vbscript_display_engine':True,'all_image_and_character_references_resolve':True}
(ROOT/'output/live-vpx/dmd-runtime-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
