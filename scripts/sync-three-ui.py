"""Copy the main player's UI into this port; the source checkout stays read only."""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-root',type=Path,required=True)
parser.add_argument('--pydeps',type=Path,required=True)
parser.add_argument('--source-commit',default='HEAD')
args=parser.parse_args()
sys.path.insert(0,str(args.pydeps))
from PIL import Image

root=Path(__file__).resolve().parents[1]
source=args.source_root.resolve()/'browser'
target=root/'three'
public=target/'public'
old=(target/'index.html').read_text(encoding='utf-8')
about=re.search(r'<details><summary>About the game</summary>.*?</details>',old).group()
html=(source/'index.html').read_text(encoding='utf-8')
html=re.sub(r'src="app\.js(?:\?[^\"]*)?"','src="./main.js"',html)
html=re.sub(r'src="/player-preview\.png(?:\?[^\"]*)?"','src="/player-preview.webp"',html)
html=re.sub(r'<details><summary>About the game</summary>.*?</details>',lambda _:about,html)
(target/'index.html').write_text(html,encoding='utf-8')
shutil.copyfile(source/'style.css',target/'style.css')
arcade=(source/'arcade.css').read_text(encoding='utf-8')
(target/'arcade.css').write_text(arcade,encoding='utf-8')
for name in ['arcade-background.svg','start-dmd.png']:
    shutil.copyfile(source/name,public/name)
for name in ['favicon.ico','favicon.png']:
    shutil.copyfile(source/name,public/name)
shutil.copytree(source/'icons',public/'icons',dirs_exist_ok=True)
manifest=json.loads((source/'manifest.json').read_text(encoding='utf-8'))
manifest.update(id='/three/',start_url='/three/',scope='/three/')
for icon in manifest['icons']:icon['src']='./'+icon['src'].lstrip('/')
(public/'manifest.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
(public/'fonts').mkdir(exist_ok=True)
for name in ['DMSans.ttf','DMSans-OFL.txt','PressStart2P-Regular.ttf','PressStart2P-OFL.txt']:
    shutil.copyfile(source/'fonts'/name,public/'fonts'/name)
preview=Image.open(source/'player-preview.png').convert('RGBA')
preview.save(public/'player-preview.webp',lossless=True,method=6,exact=True)
assert preview.tobytes()==Image.open(public/'player-preview.webp').convert('RGBA').tobytes()
sha=lambda b:hashlib.sha256(b).hexdigest()
metadata={'sourceCommit':subprocess.check_output(['git','-C',str(args.source_root),'rev-parse',args.source_commit],text=True).strip(),'sourceStyleSHA256':sha((source/'style.css').read_bytes()),'sourceArcadeSHA256':sha(arcade.encode()),'arcadeScope':'Same main UI CSS and cascade order, bundled with the app. Vite supplies the /three/ asset prefix. Existing port About paragraph retained; main.js remains the independent runtime.','preview':{'sourceBytes':(source/'player-preview.png').stat().st_size,'outputBytes':(public/'player-preview.webp').stat().st_size,'decodedPixelsIdentical':True,'rgbaSHA256':sha(preview.tobytes())}}
(public/'main-ui-source.json').write_text(json.dumps(metadata,separators=(',',':')),encoding='utf-8')
print(json.dumps(metadata))
