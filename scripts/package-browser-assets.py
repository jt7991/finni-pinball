"""Package the built table and its original DMD sprites for browser/Docker use."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.tools/pydeps'))


def package(output, copy_table=True):
    from PIL import Image
    table=ROOT/'output/live-vpx/Finni-Big-Day.vpx'
    images=ROOT/'.work/finni-live-extracted/images'
    if not images.is_dir():
        extracted=ROOT/'.work/browser-dmd-extracted'
        tool=ROOT/'.tools/vpxtool/vpxtool.exe'
        subprocess.run([str(tool),'extract','--output-dir',str(extracted),str(table)],check=True)
        images=extracted/'images'
    output.mkdir(parents=True,exist_ok=True)
    paths=sorted([*images.glob('d_*.png'),*images.glob('bk*.png')])
    if not paths:raise RuntimeError('No DMD images found in the extracted table')
    atlas=Image.new('RGBA',(2048,2048),(0,0,0,0))
    metadata={};x=y=row=0
    for path in paths:
        image=Image.open(path).convert('RGBA');w,h=image.size
        if x+w>2048:x=0;y+=row;row=0
        if y+h>2048:raise RuntimeError('DMD atlas overflow')
        atlas.paste(image,(x,y));metadata[path.stem.lower()]=[x,y,w,h]
        x+=w;row=max(row,h)
    atlas.crop((0,0,2048,y+row)).save(output/'dmd-atlas.png',optimize=True)
    (output/'dmd-atlas.json').write_text(json.dumps(metadata),encoding='utf-8')
    if copy_table:shutil.copy2(table,output/'Finni-Big-Day.vpx')
    return output


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'.work/browser-assets')
    args=parser.parse_args();print(package(args.output))
