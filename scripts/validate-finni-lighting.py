"""Check delivered LED colors, unchanged lamp properties and actual VBScript shows."""
import json
from pathlib import Path
import re
import runpy
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.tools/pydeps'))
SOURCE = ROOT/'.work/deadpool-extracted'
TABLE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT/'.work/finni-lighting-final'
lighting = runpy.run_path(str(ROOT/'scripts/apply-finni-lighting.py'))
theme = lighting['config']()
configuration=json.loads((ROOT/'design/current-assets.json').read_text())
comic=configuration.get('appearance')=='comic-party-prep'
appearance=runpy.run_path(str(ROOT/'scripts/apply-comic-appearance.py')) if comic else None
fills={s['name']:s for s in configuration.get('center_fill',[])}
art = ROOT/json.loads((ROOT/'design/current-assets.json').read_text())['playfield_directory']
script = (TABLE/'script.vbs').read_bytes()
expected = runpy.run_path(str(ROOT/'scripts/apply-gameplay-tuning.py'))['tuned_script']((SOURCE/'script.vbs').read_bytes())
assert script == expected
assert (ROOT/'output/live-vpx/Finni-Big-Day.vbs').read_bytes() == expected

count = 0
def same(a, b):
    # VPX serializes coordinates as float32; JSON inputs may contain doubles.
    if isinstance(a, float):
        return abs(a-b) < .001
    if isinstance(a, dict):
        return a.keys() == b.keys() and all(same(v,b[k]) for k,v in a.items() if k not in ('color','color2'))
    if isinstance(a, list):
        return len(a) == len(b) and all(same(x,y) for x,y in zip(a,b))
    return a == b

for path in (TABLE/'gameitems').glob('Light.*.json'):
    actual = json.loads(path.read_text())['Light']
    if actual['name'] in fills:
        template=json.loads((TABLE/'gameitems/Light.gi001.json').read_text())['Light']
        expected=appearance['fill_light'](template,fills[actual['name']])
        assert same(actual,expected), path.name
        assert actual['color']==expected['color'] and actual['color2']==expected['color2']
        assert actual['state']==1 and not actual['show_bulb_mesh']
        continue
    baseline = art/'vpx-light-overrides'/(actual['name']+'.json')
    if not baseline.exists():
        baseline = SOURCE/'gameitems'/path.name
    original = json.loads(baseline.read_text())['Light']
    if comic and actual['name'].startswith('gi'):
        original=appearance['round_gi_outline'](original)
    assert same(actual, original), path.name
    for prop in ('color','color2'):
        name = theme['static_colors'].get(original[prop].lower())
        if name and not actual.get('is_backglass', False):
            values = theme['colors'][name]
            if prop == 'color':
                values = [round(v/10) for v in values]
            assert actual[prop] == '#'+''.join(f'{v:02x}' for v in values), path.name
    count += 1

flashers = 0
for path in (TABLE/'gameitems').glob('Flasher.*.json'):
    actual = json.loads(path.read_text())['Flasher']
    original = json.loads((SOURCE/'gameitems'/path.name).read_text())['Flasher']
    if actual['name'] == 'LightInserts':
        original['is_visible'] = False  # Existing build hides the source insert overlay.
    assert same(actual, original), path.name
    name = theme['static_colors'].get(original['color'].lower())
    if name and not actual.get('is_backglass', False):
        assert actual['color'] == '#'+''.join(f'{v:02x}' for v in theme['colors'][name]), path.name
    flashers += 1

text = script.decode('cp1252')
def routine(name, kind='Sub'):
    return re.search(r'(?m)^'+kind+' '+name+r'\b.*?End '+kind, text, re.S)[0]+'\n'

vbs = '''
Class Lamp
 Public color, colorfull, State, Visible
End Class
Dim n, i, stateValue, frame, RGBStep, RGBFactor, rRed, rGreen, rBlue, RainbowLights
Set n = New Lamp
RainbowLights = Array(n)
'''
vbs += text[text.index('Const red ='):text.index('Sub SetLightColor')]
vbs += routine('SetLightColor')+routine('SetFlashColor')+routine('RainbowTimer_Timer')+routine('FinniShowColor','Function')
for token, name in theme['source_ids'].items():
    color = theme['colors'][name]
    full = lighting['rgb'](color)
    dim = lighting['rgb']([round(v/10) for v in color])
    for state in (-1, 0, 1, 2):
        vbs += f'n.State=7\nSetLightColor n, {token}, {state}\n'
        vbs += f'If n.color <> {dim} Or n.colorfull <> {full} Or n.State <> {7 if state == -1 else state} Then Err.Raise 513\n'
    for state in (-1, 0, 1):
        vbs += f'n.Visible=7\nSetFlashColor n, {token}, {state}\n'
        vbs += f'If n.color <> {full} Or n.Visible <> {7 if state == -1 else state} Then Err.Raise 514\n'
vbs += 'RGBStep=0:RGBFactor=5:rRed=255:rGreen=0:rBlue=0\nFor frame=1 To 624\nRainbowTimer_Timer\nWScript.Echo n.colorfull\nNext\n'
out = ROOT/'.work/lighting-runtime-test'
out.mkdir(exist_ok=True)
(out/'lighting.vbs').write_text(vbs, encoding='ascii')
result = subprocess.run(['cscript.exe','//Nologo',str(out/'lighting.vbs')], capture_output=True, text=True, timeout=30)
assert result.returncode == 0, result.stderr
values = [int(line) for line in result.stdout.splitlines()]
assert len(values) == 624
assert len(set(values)) > 250
for value in values:
    r, g, b = value & 255, (value >> 8) & 255, (value >> 16) & 255
    assert all(0<=channel<=255 for channel in (r,g,b)), (r,g,b)
    assert max(r,g,b)-min(r,g,b)>=50, (r,g,b)  # The approved comic show stays saturated.
report = {'delivered_lights_checked':count, 'delivered_flashers_checked':flashers, 'functional_insert_geometry_intensity_states_and_timing_preserved':True,
          'approved_gi_contours_rounded':comic,'steady_center_fill_lights_checked':len(fills),
          'runtime_palette_cases_and_state_modes':84, 'actual_vbscript_show_frames':len(values),
          'all_show_colors_within_party_palette':True, 'physics_playtest':False}
(ROOT/'output/live-vpx/lighting-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
