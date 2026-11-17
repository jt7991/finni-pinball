"""A separate VPX inspection copy that cycles the seven real mission lamps."""
from pathlib import Path
import subprocess,shutil
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'output/live-vpx'
source=(ROOT/'.work/finni-live-extracted/script.vbs').read_text()
extra='''

' Mission-art inspection only: original game table remains separate.
Dim FinniMissionPhase
If LCase(GetCustomParam(1)) = "mission-lights" Then vpmtimer.addtimer 3000, "FinniMissionLightCheck '"
Sub FinniMissionLightCheck
    Dim lamps, lamp
    StopRainbow
    LightSeqAttract.StopPlay
    GiOn
    For Each lamp In aLights: lamp.State = 0: Next
    lamps = Array(li008, li010, li011, li007, li009, li012, li013)
    For Each lamp In lamps: lamp.State = 0: Next
    lamps(FinniMissionPhase Mod 7).State = 1
    FinniMissionPhase = FinniMissionPhase + 1
    vpmtimer.addtimer 2000, "FinniMissionLightCheck '"
End Sub
'''
shutil.copyfile(out/'Finni-Big-Day.vpx',out/'Finni-Mission-Lights.vpx')
(out/'Finni-Mission-Lights.vbs').write_text(source+extra)
subprocess.run([str(ROOT/'.tools/vpxtool/vpxtool.exe'),'importvbs',str(out/'Finni-Mission-Lights.vpx')],check=True)
print('MISSION_LIGHT_CHECK_READY')
