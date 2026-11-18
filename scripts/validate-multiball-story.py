"""Check story events, voice coverage and preservation of non-presentation VBScript."""
import json
from pathlib import Path
import re
import runpy
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT/'.work/deadpool-extracted/script.vbs').read_bytes()
tune = runpy.run_path(str(ROOT/'scripts/apply-gameplay-tuning.py'))['tuned_script']
expected = tune(source)
script = (ROOT/'.work/finni-live-extracted/script.vbs').read_bytes()
assert script == expected
assert (ROOT/'output/live-vpx/Finni-Big-Day.vbs').read_bytes() == expected
roundtrip = Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'.work/finni-story-roundtrip'
assert (roundtrip/'script.vbs').read_bytes() == expected
art = ROOT/json.loads((ROOT/'design/current-assets.json').read_text())['playfield_directory']
for filename in ['finni-playfield-base.svg', 'playfield-editable-layers.svg',
                 'playfield-print-cutouts.svg', 'playfield-insert-lenses.svg']:
    labels = [e.text for e in ET.parse(art/filename).getroot().iter('{http://www.w3.org/2000/svg}text')]
    assert 'Cake Time Multiball' in labels and 'Finni Fox Multiball' not in labels, filename
images = {p.stem:p for p in (roundtrip/'images').iterdir()}
assert images['pf'].read_bytes() == (art/'finni-playfield-base.png').read_bytes()

def gameplay(data, story=False):
    if story:
        data = re.sub(rb'^[ \t]+DMD [^\r\n]*"vo_caketime(?:toppings|finish|frosting)"\r\n', b'', data, flags=re.M)
    # DMD payloads and the renamed scoreboard image are presentation only.
    data = re.sub(rb'\bDMD [^\r\n]*', b'DMD', data)
    data = data.replace(b'"d_lildpmb"', b'"bkborder"')
    data = data.replace(b'case 5:PlaySong "mu_multiball"', b'case 5:PlaySong "mu_hellhouse5"')
    return data

scoop_only = source.replace(b'HellHouse.kick 164, 30, 1', b'HellHouse.kick 164, 12, 0', 1)
assert gameplay(script, True) == gameplay(scoop_only), 'Non-presentation script changed'
assert b'"LILDP JACKPOT"' not in script and b'"d_lildpmb"' not in script
assert b'CL(0, "CAKE TIME")' in script and b'CL(0, "FRIENDSHIP")' in script
for title in [b'KITCHEN TIMER',b'PARTY LIGHTS',b'CHECKLIST',b'PARTY FAVORS']:
    assert b'CL(0, "'+title+b'")' in script
assert b'"  TEAM-UP"' not in script
for name in ['d_daz','d_col','d_wol','d_dom']:
    original=next((ROOT/'.work/deadpool-extracted/images').glob(name+'.*'))
    assert images[name].read_bytes()!=original.read_bytes()
    assert images[name].read_bytes()==(ROOT/'.work/finni-live-extracted/images'/(name+'.png')).read_bytes()
lines = runpy.run_path(str(ROOT/'scripts/build-finni-callouts.py'))['lines']()[1]
for name in ['vo_friendshipmb', 'vo_caketimetoppings', 'vo_caketimefinish', 'vo_caketimefrosting']:
    assert script.count(('"'+name+'"').encode()) == 1
    assert lines[name]
cake = script[script.index(b'Sub LilDPCheckHits'):script.index(b'Sub StopLilDPMB')]
assert cake.index(b'Case 9') < cake.index(b'"vo_caketimetoppings"') < cake.index(b'Case 10')
assert cake.index(b'Case 14') < cake.index(b'"vo_caketimefinish"') < cake.index(b'Case 15')
assert cake.index(b'Case 15') < cake.index(b'"vo_caketimefrosting"')
for old in [source.replace(b'LilDPSpinner.Enabled = 1', b'LilDPSpinner.Enabled = 2'), source+ b'\r\n"LILDP JACKPOT"']:
    try:tune(old)
    except ValueError:pass
    else:raise AssertionError('Unknown source presentation revision accepted')
report = {'cake_phases': ['frosting at Finni', 'toppings at lit shots', 'spinner flourish', 'repeat frosting'],
          'friendship_three_lock_route_retained': True, 'all_non_presentation_script_preserved': True,
          'voice_cues_present': True, 'assembled_script_and_playfield_verified': True,
          'runtime_playtest': False}
(ROOT/'output/live-vpx/multiball-story-validation.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
