"""Render actual VBScript display-test output with installed native sprites."""
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.tools/pydeps'))
from PIL import Image,ImageDraw
frames=json.loads((ROOT/'.work/dmd-runtime-test/frames.json').read_text())
manifest=json.loads((ROOT/'assets/finni/dmd/manifest.json').read_text())
out=ROOT/'output/live-vpx';selected=[];seen=set()
for frame in frames:
    if frame['fixture'] or frame['images'][40] in seen:continue
    seen.add(frame['images'][40]);selected.append(frame)
for page in range((len(selected)+15)//16):
    subset=selected[page*16:(page+1)*16]
    contact=Image.new('RGB',(1040,((len(subset)+1)//2)*166),'#242029')
    draw=ImageDraw.Draw(contact)
    for row,frame in enumerate(subset):
        def sprite(name):return Image.open(ROOT/'assets/finni/dmd'/manifest[name]['file']).convert('RGBA')
        im=sprite(frame['images'][40])
        for i,name in enumerate(frame['images'][:40]):
            g=sprite(name).resize((12,22),Image.Resampling.NEAREST)
            im.alpha_composite(g,(8+(i%20)*12,6 if i<20 else 34))
        x=(row%2)*520;y=(row//2)*166
        contact.paste(im.resize((512,128),Image.Resampling.NEAREST),(x,y+20))
        draw.text((x,y+3),frame['images'][40]+' - line '+str(frame['source_line']),fill='white')
    contact.save(out/f'dmd-all-scenes-{page+1}.png')
print(json.dumps({'active_scene_backgrounds':len(selected),'review_sheets':(len(selected)+15)//16}))
