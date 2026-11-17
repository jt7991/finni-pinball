"""Compose the Finni base texture against the extracted VPX insert coordinates."""
from pathlib import Path
import sys,base64,json,io,math,re
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.tools/pydeps'))
from PIL import Image
import resvg_py
OUT=ROOT/'output/vpx-v1';OUT.mkdir(parents=True,exist_ok=True)
ASSETS=ROOT/'assets/finni/originals'
def image(name,x,y,w,h,extra=''):
    p=ASSETS/name
    mime={'png':'image/png','avif':'image/avif','svg':'image/svg+xml'}[p.suffix[1:]]
    # resvg has no AVIF decoder; convert the existing source to PNG locally.
    raw=p.read_bytes()
    if p.suffix=='.avif':
        stream=io.BytesIO();Image.open(p).save(stream,format='PNG');raw=stream.getvalue();mime='image/png'
    return f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="data:{mime};base64,{base64.b64encode(raw).decode()}" {extra}/>'
svg=['''<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="4550" viewBox="0 0 952 2115">
<defs>
 <linearGradient id="night" x2=".3" y2="1"><stop stop-color="#30223c"/><stop offset=".5" stop-color="#51406a"/><stop offset="1" stop-color="#29203b"/></linearGradient>
 <radialGradient id="sun"><stop stop-color="#fff7da"/><stop offset="1" stop-color="#f2d5ae"/></radialGradient>
 <pattern id="dots" width="13" height="13" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" fill="#e7d7f6" opacity=".15"/></pattern>
 <pattern id="grain" width="47" height="47" patternUnits="userSpaceOnUse"><path d="M0 5L47 5M0 29L47 29" stroke="#fff" stroke-width=".35" opacity=".05"/></pattern>
 <g id="paw"><ellipse cy="5" rx="7.5" ry="6.5"/><ellipse cx="-8" cy="-4" rx="3" ry="4" transform="rotate(-20 -8 -4)"/><ellipse cy="-8" rx="3" ry="4"/><ellipse cx="8" cy="-4" rx="3" ry="4" transform="rotate(20 8 -4)"/></g>
 <g id="star"><path d="M0-8L2-2 8 0 2 2 0 8 -2 2 -8 0 -2-2Z" fill="#f1d7a1"/></g>
</defs>
<rect width="952" height="2115" fill="url(#night)"/>
<path d="M0 0H952V310Q780 220 604 325Q345 470 0 287Z" fill="#71608d"/>
<path d="M0 170Q270 0 520 155T952 150V0H0Z" fill="#a48ac3"/>
<path d="M0 260Q240 140 450 255T952 250" fill="none" stroke="#e8d8f2" stroke-width="3" opacity=".65"/>
<path d="M-20 1450Q220 1200 500 1380T980 1320V1800H-20Z" fill="#665177"/>
<path d="M-20 1570Q280 1400 480 1560T980 1510V1940H-20Z" fill="#8e7196"/>
<path d="M-20 1710Q190 1540 460 1730T980 1610V1990H-20Z" fill="#b39ac0"/>
<path d="M0 1750Q320 1510 650 1750T952 1740V2115H0Z" fill="#54405e"/>
<rect width="952" height="2115" fill="url(#dots)"/>
<path d="M58 1660L54 510Q-15 145 236 116Q352 98 388 207Q425 320 305 333" fill="none" stroke="#20172e" stroke-width="70"/>
<path d="M58 1660L54 510Q-15 145 236 116Q352 98 388 207Q425 320 305 333" fill="none" stroke="#f49545" stroke-width="56"/>
<path d="M58 1660L54 510Q-15 145 236 116Q352 98 388 207Q425 320 305 333" fill="none" stroke="#ffe9c5" stroke-width="4"/>
<path d="M154 1510Q99 1140 253 900T239 534" fill="none" stroke="#281c36" stroke-width="89"/>
<path d="M154 1510Q99 1140 253 900T239 534" fill="none" stroke="#8272f5" stroke-width="72"/>
<path d="M154 1510Q99 1140 253 900T239 534" fill="none" stroke="#d1bce7" stroke-width="4"/>
<path d="M802 1640Q873 1260 737 940Q629 676 812 416Q891 310 854 168" fill="none" stroke="#241b31" stroke-width="102"/>
<path d="M802 1640Q873 1260 737 940Q629 676 812 416Q891 310 854 168" fill="none" stroke="#ed762f" stroke-width="84"/>
<path d="M802 1640Q873 1260 737 940Q629 676 812 416Q891 310 854 168" fill="none" stroke="#ffe5bb" stroke-width="4"/>
<path d="M922 2115V195Q928 23 786 29" fill="none" stroke="#ed762f" stroke-width="32"/>
<path d="M900 2115V195Q902 45 787 50" fill="none" stroke="#d1bce7" stroke-width="5"/>
<ellipse cx="462" cy="1112" rx="225" ry="264" fill="#20172e" stroke="#ed762f" stroke-width="6"/>
<ellipse cx="462" cy="1112" rx="208" ry="246" fill="url(#sun)"/>
<ellipse cx="462" cy="1112" rx="190" ry="226" fill="none" stroke="#e9ba82" stroke-width="2"/>
''']
svg.append(image('fox-leaning.png',273,917,380,374))
svg.append(image('fox-running.avif',276,1280,386,386))
svg.append(image('fox-peeking-down.png',285,25,185,138))
svg.append(image('bush.png',-45,301,175,151,'opacity=".95"'))
svg.append(image('flowers.png',-18,1370,188,188))
svg.append(image('flowers-orange.png',745,1328,180,180))
svg.append(image('butterfly.png',370,520,100,100,'transform="rotate(-18 420 570)"'))
# Decorative stars in the remaining open printed areas.
for x,y,s in [(520,370,.7),(749,282,.8),(180,1305,.6),(690,1270,.8),(422,1560,.6),(295,1520,.7),(604,1600,.5),(671,910,.5),(104,1010,.5),(500,256,.8)]:
    svg.append(f'<use href="#star" transform="translate({x} {y}) scale({s})"/>')
# Actual VPX inserts, rather than estimated or invented light locations.
light_map={}
for file in (ROOT/'.work/deadpool-extracted/gameitems').glob('Light.*.json'):
    obj=json.loads(file.read_text())['Light'];light_map[obj['name']]=obj
included=[f'li{i:03d}' for i in range(2,54) if i not in (44,)]+['LightShootAgain']
for name in included:
    if name not in light_map:continue
    light=light_map[name]; points=light.get('drag_points',[])
    if len(points)<3:continue
    n=int(name[2:]) if name.startswith('li') else 999
    path='M'+'L'.join(f'{p["x"]:.2f},{p["y"]:.2f}' for p in points)+'Z'
    color='#fbe7b7' if n in (2,3,4,5) else '#c6b5e6' if n%3==0 else '#f0b56d'
    svg.append(f'<path d="{path}" fill="{color}" stroke="#2a1d35" stroke-width="4" stroke-linejoin="round"/>')
    x,y=light['center']['x'],light['center']['y']
    if 17<=n<=24:
        letter=('W','O','R','G','Y','A','L','P')[n-17]
        svg.append(f'<text x="{x}" y="{y+7}" text-anchor="middle" font-family="Arial" font-size="21" font-weight="bold" fill="#49344f">{letter}</text>')
    elif n in (2,3,4,5):
        value={2:'2X',3:'3X',4:'4X',5:'5X'}[n]
        svg.append(f'<text x="{x}" y="{y+5}" text-anchor="middle" font-family="Arial" font-size="17" font-weight="bold" fill="#49344f">{value}</text>')
    elif n in (25,26,27,29,30,31,49,50,51,52):
        svg.append(f'<use href="#paw" fill="#7c4928" transform="translate({x} {y}) scale(.58)"/>')
    elif n in (7,8,9,10,11,12,13):
        svg.append(f'<use href="#paw" fill="#49344f" transform="translate({x} {y}) scale(1.1)"/>')
    elif n in (28,32,33,38,42,46):
        svg.append(f'<use href="#paw" fill="#fdf6e6" transform="translate({x} {y+7}) scale(.6)"/>')
svg.extend(['''
<g font-family="Arial" text-anchor="middle" fill="#f7eddc" font-size="12" letter-spacing="1.3" font-weight="bold">
<text x="394" y="805">FOX MULTIBALL</text>
<text x="296" y="929" transform="rotate(18 296 929)">JACKPOT</text>
<text x="653" y="929" transform="rotate(-18 653 929)">JACKPOT</text>
<text x="433" y="1613">GROW TOGETHER</text>
</g>
<path d="M0 1950Q465 1810 952 1950V2115H0Z" fill="#2d213b"/>
<path d="M0 1950Q465 1810 952 1950" fill="none" stroke="#f39349" stroke-width="7"/>
<path d="M0 1966Q465 1827 952 1966" fill="none" stroke="#bba1d1" stroke-width="2"/>
'''])
svg.append(image('finni-logo-light.svg',340,1950,265,96))
svg.append('<text x="472" y="2084" text-anchor="middle" font-family="Arial" font-size="13" letter-spacing="4" fill="#eadcf4">FINNIHEALTH.COM</text>')
svg.append('<rect width="952" height="2115" fill="url(#grain)"/></svg>')
text=''.join(svg)
(OUT/'finni-playfield-base.svg').write_text(text,encoding='utf-8')
(OUT/'finni-playfield-base.png').write_bytes(resvg_py.svg_to_bytes(svg_string=text,width=2048,height=4550))
# A matching back panel for the 3D preview, using the same artwork.
back='<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="720" viewBox="0 0 1024 360"><rect width="1024" height="360" fill="#392840"/><path d="M0 220Q250 90 500 205T1024 165V360H0Z" fill="#6f567f"/><path d="M0 300Q400 200 1024 290V360H0Z" fill="#9b7cad"/>'+image('fox-leaning.png',50,45,285,280)+image('finni-logo-light.svg',420,85,430,155)+'</svg>'
(OUT/'finni-back-panel.png').write_bytes(resvg_py.svg_to_bytes(svg_string=back))
print('Wrote 2048 x 4550 texture using original VPX insert outlines.')
