"""Verify embedded scene pixels, browser packaging and presentation-only changes."""
import json
from pathlib import Path
import re
import runpy
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.tools/pydeps'))
from PIL import Image

source = ROOT/'.work/deadpool-extracted'
work = ROOT/'.work/finni-live-extracted'
roundtrip = Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'.work/finni-dmd-roundtrip'
art = ROOT/'assets/finni/dmd'
script = (roundtrip/'script.vbs').read_bytes()
assert script == (work/'script.vbs').read_bytes()
assert script == (ROOT/'output/live-vpx/Finni-Big-Day.vbs').read_bytes()
tuned = runpy.run_path(str(ROOT/'scripts/apply-gameplay-tuning.py'))['tuned_script']
assert script == tuned((source/'script.vbs').read_bytes())
atlas = Image.open(ROOT/'.work/browser-assets/dmd-atlas.png').convert('RGBA')
rects = json.loads((ROOT/'.work/browser-assets/dmd-atlas.json').read_text())
manifest=json.loads((art/'manifest.json').read_text())
metadata=json.loads((roundtrip/'images.json').read_text())
dmd_names=[e['name'].lower() for e in metadata if e['name'].lower().startswith(('d_','bk'))]
assert set(dmd_names)==set(manifest)==set(rects)
assert len(dmd_names)==len(set(dmd_names)), 'Duplicate DMD identifiers'
for name,spec in manifest.items():
    path=art/spec['file']
    expected = Image.open(path).convert('RGBA')
    assert expected.size == tuple(spec['size']),path.name
    embedded = Image.open(roundtrip/'images'/path.name).convert('RGBA')
    assert expected.tobytes() == embedded.tobytes(),path.name
    x,y,w,h = rects[path.stem]
    assert atlas.crop((x,y,x+w,y+h)).tobytes() == expected.tobytes(),path.name
    if spec['layout'] in ('header','overlay'):
        # Every native lower-row glyph can extend to y=55 without touching art.
        assert len(expected.crop((8,34,248,56)).getcolors()) == 1,path.name
    if spec['layout']=='overlay':
        assert len(expected.crop((8,6,248,28)).getcolors()) == 1,path.name
    if spec['layout']=='side':
        assert len(expected.crop((128,34,248,56)).getcolors()) == 1,path.name
legacy=json.loads((source/'images.json').read_text())
for entry in legacy:
    name=entry['name'].lower()
    if not name.startswith(('d_','bk')):continue
    assert name in manifest,name
    original_path=source/'images'/Path(entry['path'].replace('\\','/')).name
    if not original_path.exists():original_path=next((source/'images').glob(entry['name']+'.*'))
    original=Image.open(original_path).convert('RGBA')
    new=Image.open(art/manifest[name]['file']).convert('RGBA')
    assert original.size!=new.size or original.tobytes()!=new.tobytes(),('Original DMD pixels',name)
for line in script.splitlines():
    if b'DMD ' not in line or line.lstrip().startswith(b"'"):continue
    literals=re.findall(rb'"([^"\r\n]*)"',line)
    visible=b' '.join(t for t in literals if not t.lower().startswith((b'd_',b'bk',b'vo_',b'fx_')))
    assert not re.search(rb'DEADPOOL|NINJA|CHIMICH|WEAPON|KATANA|BERSERKER|MECH.?SUIT|MEGALODON|HELLHOUSE|BATTLE|DIAMOND|REGENERAT',visible),visible
font = runpy.run_path(str(ROOT/'scripts/build-finni-dmd.py'))
for name, char in [('d_a','A'),('d_0','0'),('d_9','9'),('d_comma',','),('d_dot','.'),('d_empty',' ')]:
    expected = Image.new('RGBA',(12,22),(0,0,0,0))
    font['label'](expected,char,1,4)
    installed = Image.open(roundtrip/'images'/(name+'.png')).convert('RGBA')
    assert installed.size == (12,22)
    assert expected.tobytes() == installed.tobytes(),name

# Every event retains all effects, duration, queue behavior and voice routing.
tasks = runpy.run_path(str(ROOT/'scripts/apply-party-tasks.py'))['task_script']
story = runpy.run_path(str(ROOT/'scripts/apply-multiball-story.py'))['story_script']
before = (source/'script.vbs').read_bytes().replace(b'HellHouse.kick 164, 30, 1',b'HellHouse.kick 164, 12, 0',1)
before = story(before)
before = tasks(before)
events_before = re.findall(rb'\bDMD ([^\r\n]*)',before)
restored = runpy.run_path(str(ROOT/'scripts/apply-finni-dmd.py'))['mode_callouts'](script, restore=True)
events_after = re.findall(rb'\bDMD ([^\r\n]*)', restored)
assert len(events_before) == len(events_after)
changes = 0
for a,b in zip(events_before,events_after):
    # The prior separately approved ball-save speech addition is allowed.
    if b'vo_ballsaved' in b:
        continue
    if a != b:
        assert a[a.index(b', e'):] == b[b.index(b', e'):],(a,b)
        changes += 1
assert changes > 70,changes
report={'dmd_assets':len(manifest),'changed_display_events':changes,'all_legacy_dmd_pixels_replaced':True,'no_original_theme_in_display_text':True,'verified_embedded_and_atlas_pixels':True,
                  'pixel_font_embedded':True,'live_instruction_region_clear':True,
                  'event_timing_and_voice_preserved':True,'full_vpx_physics_playtest':False}
(ROOT/'output/live-vpx/dmd-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
