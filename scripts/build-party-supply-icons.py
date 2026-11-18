"""Replace the four DMD helper glyphs with small party-supply pixel icons."""
import argparse
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.tools/pydeps'))
from PIL import Image,ImageDraw

def install(table):
    metadata=json.loads((table/'images.json').read_text())
    icons={}
    ink=(255,163,71,255)
    for name,kind in [('d_daz','timer'),('d_col','lights'),('d_wol','checklist'),('d_dom','favors')]:
        image=Image.new('RGBA',(16,16),(0,0,0,0))
        d=ImageDraw.Draw(image)
        if kind=='timer':
            d.ellipse((2,3,13,14),outline=ink,width=1)
            d.line([(8,5),(8,9),(11,9)],fill=ink,width=1)
            d.rectangle((6,0,9,1),fill=ink)
            d.line((8,1,8,3),fill=ink)
        elif kind=='lights':
            d.line([(0,2),(5,4),(10,2),(15,4)],fill=ink,width=1)
            for x,y in [(2,3),(7,3),(12,3)]:
                d.line((x,y,x,y+3),fill=ink)
                d.ellipse((x-1,y+3,x+2,y+7),fill=ink)
        elif kind=='checklist':
            d.rectangle((2,1,13,14),outline=ink)
            for y in (4,8,12):
                d.line([(4,y),(5,y+1),(7,y-1)],fill=ink)
                d.line((9,y,11,y),fill=ink)
        else:
            d.rectangle((2,7,13,14),outline=ink)
            d.rectangle((1,5,14,7),outline=ink)
            d.line((8,5,8,14),fill=ink)
            d.line([(8,5),(4,4),(4,2),(6,2),(8,5),(10,2),(12,2),(12,4),(8,5)],fill=ink)
        entry=next(e for e in metadata if e['name'].lower()==name)
        source=next((ROOT/'.work/deadpool-extracted/images').glob(entry['name']+'.*'))
        with Image.open(source) as original:size=original.size
        image=image.resize(size,Image.Resampling.NEAREST)
        output=table/'images'/(entry['name']+'.png')
        image.save(output)
        entry['path']=output.name
        icons[name]=kind
    (table/'images.json').write_text(json.dumps(metadata,indent=2))
    return icons

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install',type=Path,default=ROOT/'.work/finni-live-extracted')
    print(json.dumps(install(parser.parse_args().install)))
