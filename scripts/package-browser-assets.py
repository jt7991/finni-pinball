"""Package the built table, DMD sprites and soundtrack for browser/Docker use."""
import argparse
import json
import runpy
from pathlib import Path
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.tools/pydeps'))


def package_music(extracted, output):
    config = json.loads((ROOT / 'design/music-trial.json').read_text(encoding='utf-8'))
    sounds = json.loads((extracted / 'sounds.json').read_text(encoding='utf-8'))
    paths = {sound['name'].lower(): sound['path'] for sound in sounds}
    ffmpeg = runpy.run_path(str(ROOT / 'scripts/apply-music-trial.py'))['FF']
    output.mkdir(parents=True, exist_ok=True)
    for track in config['tracks']:
        name = track['ids'][0]
        source = extracted / 'sounds' / paths[name]
        # MP3 playback and seeking work on older Safari versions as well.
        subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
                        '-i', str(source), '-map', '0:a:0', '-c:a', 'libmp3lame',
                        '-b:a', '128k', str(output / f'{name}.mp3')], check=True)


def package(output, copy_table=True, images=None):
    from PIL import Image
    table=ROOT/'output/live-vpx/Finni-Big-Day.vpx'
    images=images if images is not None else ROOT/'.work/finni-live-extracted/images'
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
    shutil.copy2(ROOT/'assets/finni/dmd/animations.json',output/'dmd-animations.json')
    if copy_table:
        package_music(images.parent, output / 'music')
        shutil.copy2(table,output/'Finni-Big-Day.vpx')
    return output


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'runtime')
    args=parser.parse_args();print(package(args.output))
