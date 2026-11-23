"""Verify every motion frame, clear text regions and the real VBScript timer."""
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.tools/pydeps'))
from PIL import Image, ImageDraw

art=ROOT/'assets/finni/dmd'
animations=json.loads((art/'animations.json').read_text())
manifest=json.loads((art/'manifest.json').read_text())
required={'selection','envelopes','poses_pinata','poses_wrap','ball_return','timer',
          'page_turn','parcels','ribbons','record','steam','friendship',
          'edge_award','edge_bonus','edge_ready','edge_combo'}
assert required <= {s['effect'] for s in animations.values()}
runtime=json.loads((ROOT/'.work/dmd-runtime-test/frames.json').read_text())
active={f['images'][40].split('_anim')[0] for f in runtime}
assert {'d_ballsaved','d_finni_award','d_finni_bonus','d_finni_ready','d_finni_combo'} <= active
for count,word in enumerate(('ONE FRIEND','TWO FRIENDS','THREE FRIENDS'),1):
    name='d_finni_friend'+str(count)
    assert name in active
    assert animations[name]['effect']=='friend_arrival_'+str(count)
    # Arrivals finish at 800ms and hold, before the 1500ms event expires.
    base=Image.open(art/manifest[name]['file']).convert('RGBA')
    for key in animations[name]['frames'][5:]:
        assert Image.open(art/manifest[key]['file']).convert('RGBA').tobytes()==base.tobytes(),key
assert 'd_finni_friendship_start' in active
for name,spec in animations.items():
    base=Image.open(art/manifest[name]['file']).convert('RGBA')
    layout=manifest[name]['layout']
    variants=[]
    for key in spec['frames']:
        im=Image.open(art/manifest[key]['file']).convert('RGBA')
        variants.append(im.tobytes())
        # All precomposed lettering, live text and meters remain pixel-identical.
        if layout=='overlay':
            for region in ((8,6,248,28),(8,34,248,56)):
                assert im.crop(region).tobytes()==base.crop(region).tobytes(),key
        else:
            region=(68,0,256,64) if layout=='header' else (110,0,256,64)
            assert im.crop(region).tobytes()==base.crop(region).tobytes(),key
        if layout=='header':
            assert im.crop((0,30,256,64)).tobytes()==base.crop((0,30,256,64)).tobytes(),key
    assert len(set(variants))>1,name

# Reuse the actual queue harness's engine and mock flashers, adding timer calls.
harness=(ROOT/'.work/dmd-runtime-test/all-events.vbs').read_text()
harness=harness[:harness.index('For fixture=0 To 1')]
checks=[]
for name,spec in animations.items():
    checks.append(f'dLine(2)="{name}":DMDUpdate 2')
    for key in spec['frames'][1:]+spec['frames'][:1]:
        checks.append('FinniDmdAnimationTimer_Timer')
        checks.append(f'If Digits(40).ImageA<>"{key}" Then WScript.Quit 2')
    checks.append('FinniDmdMotion=False:DMDUpdate 2')
    checks.append(f'If Digits(40).ImageA<>"{name}" Then WScript.Quit 3')
    checks.append('FinniDmdMotion=True')
checks+=['dLine(2)="bkempty":DMDUpdate 2:FinniDmdAnimationTimer_Timer',
         'If Digits(40).ImageA<>"bkempty" Then WScript.Quit 4',
         'dLine(2)="d_title":DMDUpdate 2',
         'If Digits(40).ImageA<>"d_title_anim00" Then WScript.Quit 5']
out=ROOT/'.work/dmd-runtime-test/motion.vbs'
out.write_text(harness+'\n'+'\n'.join(checks),encoding='ascii')
result=subprocess.run(['cscript.exe','//Nologo',str(out)],capture_output=True,text=True,timeout=45)
assert result.returncode==0,(result.returncode,result.stderr)

# Static filmstrip for inspecting actual installed pixels at presentation size.
names=['d_finni_friend1','d_finni_friend2','d_finni_friend3','d_finni_friendship_start']
sheet=Image.new('RGB',(1040,len(names)*154),'#242029');d=ImageDraw.Draw(sheet)
for row,name in enumerate(names):
    for col,frame in enumerate((0,3,6,9)):
        key=animations[name]['frames'][frame]
        d.text((col*260,row*154),f'{name} / {frame*160}ms',fill='white')
        sheet.paste(Image.open(art/manifest[key]['file']).resize((256,64),Image.Resampling.NEAREST),(col*260,row*154+24))
sheet.save(ROOT/'output/live-vpx/dmd-motion-filmstrip.png')
print(json.dumps(dict(animated_scenes=len(animations),frames=sum(len(s['frames']) for s in animations.values()),
                     native_timer_wrap_reset_and_static_mode=True,all_text_and_meters_stable=True),indent=2))
