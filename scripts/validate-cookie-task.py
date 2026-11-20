"""Check that the cookie task agrees across rules presentation, artwork and speech."""
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
load=lambda p:json.loads((ROOT/p).read_text(encoding='utf-8'))
task=next(m for m in load('design/party-tasks.json')['modes'] if m['key']=='megalodon')
assert (task['id'],task['insert'],task['label'])==(5,'li009','Bake the Cookies')
assert task['words']==['BAKE THE','COOKIES'] and task['complete']==['COOKIES','BAKED']
theme=next(m for m in load('design/finni-dmd-theme.json')['tasks'] if m['key']=='megalodon')
assert theme['art']=='cookies' and theme['title']==task['words']
assert load('assets/finni/dmd/animations.json')['d_finni_baking']['effect']=='steam'
art=ROOT/load('design/current-assets.json')['playfield_directory']
for file in ('finni-playfield-base.svg','playfield-editable-layers.svg','playfield-insert-lenses.svg'):
    labels=list(ET.parse(art/file).getroot().iter('{http://www.w3.org/2000/svg}text'))
    assert [e.text for e in labels if e.get('data-mission')=='li009']==task['words'],file
    assert 'Cake Time Multiball' in [e.text for e in labels],file
callouts=load('design/finni-callouts.json')['callouts']
voice=load('output/finni-voice/voice-report.json')['callouts']
for name in ('vo_megalodon','vo_megalodondefeated','vo_shootblueshots-megalodon'):
    assert 'cookie' in callouts[name].lower() and 'cake' not in callouts[name].lower()
    assert voice[name]['text']==callouts[name] and not voice[name]['silent']
table=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'.work/finni-live-extracted'
script=(table/'script.vbs').read_text().upper()
assert 'COOKIES BAKED' in script and 'COOKIE JACKPOT' in script
assert 'BAKE THE CAKE' not in script and 'CAKE BAKED' not in script
assert 'D_FINNI_CAKE' in script and 'VO_CAKETIMETOPPINGS' in script
runtime=load('.work/dmd-runtime-test/frames.json')
assert any(f['images'][40]=='d_finni_baking_anim00' for f in runtime)
def text(names):
    return ''.join(n[2:].upper() if len(n)==3 and n.startswith('d_') else ' ' for n in names)
assert any(f['images'][40]=='d_finni_baking_done_anim00' and 'COOKIES BAKED' in text(f['images'][20:40]) for f in runtime)
assert (table/'images/pf.png').read_bytes()==(art/'finni-playfield-base.png').read_bytes()
print('PASS: cookies in task selection, completion, jackpot, playfield, DMD art/motion and all three voices; Cake Time retained.')
