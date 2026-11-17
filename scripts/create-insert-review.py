"""Embed the actual VPX light-check recording alongside its print separation."""
from pathlib import Path
import base64, json, sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/pydeps'))
from PIL import Image
out = ROOT / json.loads((ROOT / 'design/current-assets.json').read_text())['playfield_directory']
version = out.name.split('-')[-1]
Image.open(out / 'playfield-print-cutouts.png').crop((440, 2470, 1570, 3440)).save(out / 'print-cutouts-detail.png')
Image.open(out / 'finni-playfield-base.png').crop((440, 2470, 1570, 3440)).save(out / 'lettering-detail.png')
def data(file, mime):
    return 'data:' + mime + ';base64,' + base64.b64encode(file.read_bytes()).decode()
full = data(ROOT / f'output/live-vpx/finni-insert-{version}-light-check.mp4', 'video/mp4')
close = data(ROOT / f'output/live-vpx/finni-insert-{version}-light-closeup.mp4', 'video/mp4')
print_layer = data(out / 'print-cutouts-detail.png', 'image/png')
lettering = data(out / 'lettering-detail.png', 'image/png')
html = '''<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;font-family:var(--font-sans,system-ui);color:var(--foreground)}
.controls{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}button{padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius,7px);background:var(--secondary);color:var(--foreground);font:inherit;cursor:pointer}button[aria-pressed=true]{background:var(--primary);color:var(--primary-foreground)}
.stage{width:100%;aspect-ratio:1.63;background:#080d11}video{display:block;width:100%;height:100%;object-fit:contain}[hidden]{display:none!important}
.print{height:100%;background-color:#e2e2e2;background-image:conic-gradient(#bdbdbd 25%,transparent 0 50%,#bdbdbd 0 75%,transparent 0);background-size:20px 20px}.print img,.detail img{width:100%;height:100%;object-fit:contain}.detail{height:100%}
.note{margin-top:9px;color:var(--muted-foreground);font-size:13px;line-height:1.5}
</style></head><body><div id="insert-review"><div class="controls">
<button data-view="close" aria-pressed="true">Mission close-up</button><button data-view="full" aria-pressed="false">Full table in VPX</button><button data-view="detail" aria-pressed="false">Lettering detail</button><button data-view="print" aria-pressed="false">Print cutouts</button></div>
<div class="stage"><video id="close" controls autoplay muted loop playsinline src="'''+close+'''"></video><video id="full" hidden controls muted loop playsinline src="'''+full+'''"></video><div id="detail" class="detail" hidden><img alt="Playful white bubbly lettering with black outlines on the current playfield texture" src="'''+lettering+'''"></div><div id="print" class="print" hidden><img alt="Transparent mission insert holes in the print layer, shown over a checkerboard" src="'''+print_layer+'''"></div></div>
<div class="note" id="note">Actual VPX lamp check: bubbly outlined lettering and plain triangular sling covers.</div></div>
<script>const root=document.getElementById('insert-review'),views={close:document.getElementById('close'),full:document.getElementById('full'),detail:document.getElementById('detail'),print:document.getElementById('print')};let time=0;root.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{Object.values(views).forEach(v=>{if(v.tagName==='VIDEO'&&!v.hidden){time=v.currentTime;v.pause()}v.hidden=true});let chosen=views[button.dataset.view];chosen.hidden=false;if(chosen.tagName==='VIDEO'){chosen.currentTime=time;chosen.play()}root.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.getElementById('note').textContent=button.dataset.view==='print'?'Checkerboard shows real transparency in the print layer. The separate lens layer carries the labels.':button.dataset.view==='detail'?'Detail of the current playfield texture: playful white bubbly lettering with black outlines.':'Actual VPX lamp check: bubbly outlined lettering and plain triangular sling covers.'}));</script></body></html>'''
(out / 'insert-light-review.html').write_text(html, encoding='utf-8')
print('INSERT_REVIEW_READY')
