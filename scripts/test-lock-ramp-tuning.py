"""Execute the shipped ramp assist and check its deliberately limited scope."""
from pathlib import Path
import re
import runpy
import subprocess
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
script = (ROOT/'.work/finni-live-extracted/script.vbs').read_bytes()
module = runpy.run_path(str(ROOT/'scripts/apply-lock-ramp-tuning.py'))
assert module['ramp_script'](script) == script
assert module['restore_script'](module['ramp_script'](script)) == module['restore_script'](script)
if len(sys.argv) > 1:
    extracted = Path(sys.argv[1])
    assert (extracted/'script.vbs').read_bytes() == script
    for name in ('Ramp010', 'Ramp009', 'Ramp011', 'Ramp012', 'Ramp013'):
        filename = 'Ramp.' + name + '.json'
        original = json.loads((ROOT/'.work/deadpool-extracted/gameitems'/filename).read_text())['Ramp']
        delivered = json.loads((extracted/'gameitems'/filename).read_text())['Ramp']
        for key in ('drag_points', 'height_bottom', 'height_top', 'is_collidable', 'physics_material', 'friction'):
            assert original[key] == delivered[key], (name, key)
routine = re.search(rb'Sub FinniLockRampAssist\(ball\).*?End Sub', script, re.S)[0]
fixture = '''
Class Ball
    Public X, Y, Z, VelX, VelY, VelZ
End Class
Dim b:Set b=New Ball
Sub Check(ok)
    If Not ok Then WScript.Echo "FAIL":WScript.Quit 1
End Sub
Sub Shot(x,y,z,vx,vy)
    b.X=x:b.Y=y:b.Z=z:b.VelX=vx:b.VelY=vy:b.VelZ=4
    FinniLockRampAssist b
    Check b.VelZ=4
End Sub
Shot 280,321,35,-16,-12
Check Abs(Sqr(b.VelX^2+b.VelY^2)-24)<0.00001
Check Abs(b.VelX/b.VelY-4/3)<0.00001
Shot 280,321,35,-12,-9
Check b.VelX=-12 And b.VelY=-9
Shot 280,321,35,-24,-18
Check b.VelX=-24 And b.VelY=-18
Shot 280,321,35,16,12
Check b.VelX=16 And b.VelY=12
Shot 280,321,25,-16,-12
Check b.VelX=-16 And b.VelY=-12
Shot 200,820,35,-16,-12
Check b.VelX=-16 And b.VelY=-12
Shot 280,321,35,-3,-20
Check b.VelX=-3 And b.VelY=-20
WScript.Echo "PASS: modest ramp assist preserves weak/strong shots, aim, rollbacks and other lanes"
'''
path = ROOT/'.work/lock-ramp-test.vbs'
path.write_bytes(routine + b'\r\n' + fixture.encode('ascii'))
subprocess.run(['cscript.exe', '//Nologo', str(path)], check=True)
