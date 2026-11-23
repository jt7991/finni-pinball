"""Build Finni's short apron card and the native VPX rulescard image."""
import base64
from html import escape
import json
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/pydeps'))
import resvg_py

OUT = ROOT / 'output/party-plastics'
FONTS = [ROOT/'assets/fonts/chewy/Chewy-Regular.ttf', ROOT/'browser/fonts/DMSans.ttf']


def document(width, height, body):
    fonts = ''.join('@font-face{font-family:'+name+';src:url(data:font/ttf;base64,'+
                    base64.b64encode(path.read_bytes()).decode()+')}'
                    for name,path in zip(('Chewy','DM Sans'),FONTS))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
    <style>{fonts}text{{font-family:'DM Sans';fill:#142651}}.title{{font-family:Chewy}}</style>
    <rect width="100%" height="100%" rx="18" fill="#fff1ce"/>{body}</svg>'''


def text(x, y, value, size, extra=''):
    return f'<text x="{x}" y="{y}" font-size="{size}" {extra}>{escape(value)}</text>'


def build(output=OUT):
    output.mkdir(parents=True, exist_ok=True)
    config = json.loads((ROOT/'design/instruction-card.json').read_text())
    body = '<path d="M0 0H1240V69H0Z" fill="#142651"/>'
    body += text(36,48,'LET’S GET THE PARTY READY',39,'class="title" style="fill:#fff1ce"')
    for i,section in enumerate(config['quick_start']):
        x = 36 + (i%2)*604
        y = 101 + (i//2)*170
        body += f'<circle cx="{x+9}" cy="{y-8}" r="18" fill="#ffce54"/>'
        body += text(x+9,y,str(i+1),25,'font-weight="800" text-anchor="middle"')
        body += text(x+43,y,section['title'],28,'font-weight="800"')
        for j,line in enumerate(section['lines']):
            body += text(x+43,y+43+j*32,line,30)
    body += '<path d="M36 436H1204" stroke="#bcae91" stroke-width="2"/>'
    body += text(36,465,config['quick_footer'],24,'font-weight="700"')
    short = document(1240,480,body)
    body = '<path d="M0 0H2048V192H0Z" fill="#142651"/>'
    body += text(64,119,config['title'],94,'class="title" style="fill:#ffce54"')
    body += text(1980,90,'HOW TO PLAY',33,'font-weight="800" text-anchor="end" style="fill:#40cce3"')
    body += text(1980,140,'Prepare the party. Follow the lights.',30,'text-anchor="end" style="fill:#fff1ce"')
    for i,section in enumerate(config['sections']):
        x=64+(i%2)*1000; y=235+(i//2)*214
        body += f'<rect x="{x}" y="{y-24}" width="8" height="156" rx="4" fill="{["#ff478e","#40cce3"][i%2]}"/>'
        body += text(x+26,y+8,section['title'],36,'class="title"')
        for j,line in enumerate(section['lines']):
            body += text(x+26,y+50+j*31,line,29)
    body += '<path d="M64 1080H1984" stroke="#bcae91" stroke-width="2"/>'
    body += text(64,1120,'Finni’s Big Day • Party preparation rules • Original VPX table by JP Salas',25)
    full = document(2048,1152,body)
    for name,svg in [('instruction-card',short),('rulescard',full)]:
        (output/f'{name}.svg').write_text(svg)
        (output/f'{name}.png').write_bytes(resvg_py.svg_to_bytes(svg_string=svg,font_files=[str(f) for f in FONTS]))


def install(extracted, artwork_dir=OUT):
    extracted = Path(extracted)
    path = extracted/'images.json'
    images = json.loads(path.read_text())
    entry = next(e for e in images if e['name']=='rulescard')
    shutil.copyfile(artwork_dir/'rulescard.png',extracted/'images/rulescard.png')
    entry['path']='rulescard.png'
    path.write_text(json.dumps(images,indent=2))
    path = extracted/'info.json'
    info = json.loads(path.read_text())
    info['table_rules']='![Rules](rulescard)'
    path.write_text(json.dumps(info,indent=2))


if __name__=='__main__':
    build()
