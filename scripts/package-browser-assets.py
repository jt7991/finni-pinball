"""Package the built table and its installed DMD sprites for browser/Docker use."""
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
    # Use the table index, not a directory glob: extracted dedup files and old
    # unregistered sprites must never leak into the browser bundle.
    index=json.loads((images.parent/'images.json').read_text())
    paths=[];names=set()
    for entry in index:
        name=entry['name'].lower()
        if name in names or not name.startswith(('d_','bk')):continue
        names.add(name)
        file=images/Path(entry['path'].replace('\\','/')).name
        if not file.exists():file=next(images.glob(entry['name']+'.*'))
        paths.append((name,file))
    paths.sort()
    if not paths:raise RuntimeError('No DMD images found in the extracted table')
    atlas_width=4096
    shelf_x=shelf_y=shelf_h=0
    for _,path in paths:
        with Image.open(path) as image:w,h=image.size
        if shelf_x+w>atlas_width:shelf_x=0;shelf_y+=shelf_h;shelf_h=0
        shelf_x+=w;shelf_h=max(shelf_h,h)
    atlas=Image.new('RGBA',(atlas_width,shelf_y+shelf_h),(0,0,0,0))
    metadata={};x=y=row=0
    for name,path in paths:
        image=Image.open(path).convert('RGBA');w,h=image.size
        if x+w>atlas_width:x=0;y+=row;row=0
        if y+h>atlas.height:raise RuntimeError('DMD atlas overflow')
        atlas.paste(image,(x,y));metadata[name]=[x,y,w,h]
        x+=w;row=max(row,h)
    atlas.crop((0,0,atlas_width,y+row)).save(output/'dmd-atlas.png',optimize=True)
    (output/'dmd-atlas.json').write_text(json.dumps(metadata),encoding='utf-8')
    if copy_table:shutil.copy2(table,output/'Finni-Big-Day.vpx')
    return output


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'.work/browser-assets')
    args=parser.parse_args();print(package(args.output))
