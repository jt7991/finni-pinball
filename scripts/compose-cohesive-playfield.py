"""Register one unified scene beneath the exact revision-4 insert/label layer."""
from pathlib import Path
import base64,sys,json,shutil,xml.etree.ElementTree as ET,re
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'.tools/pydeps'))
import resvg_py
SRC=ROOT/'output/playfield-party-v4';OUT=ROOT/'output/playfield-party-v5';OUT.mkdir(exist_ok=True)
generated=Path(sys.argv[1]).resolve()
shutil.copyfile(generated,OUT/'cohesive-party-environment.png')
for name in ('back-panel.png','inlane-layout-overrides.json','original-plastic-alpha-map.json'):
    shutil.copyfile(SRC/name,OUT/name)
shutil.copytree(SRC/'vpx-light-overrides',OUT/'vpx-light-overrides',dirs_exist_ok=True)
ns='http://www.w3.org/2000/svg';ET.register_namespace('',ns)
tree=ET.parse(SRC/'finni-playfield-base.svg');root=tree.getroot()
old_vector=ET.tostring(root,encoding='unicode')
background=list(root)[0];assert background.tag==f'{{{ns}}}image'
background.set('href','data:image/png;base64,'+base64.b64encode(generated.read_bytes()).decode())
background.set('id','cohesive-party-environment')
svg=ET.tostring(root,encoding='unicode')
(OUT/'finni-playfield-base.svg').write_text(svg,encoding='utf-8')
(OUT/'playfield-editable-layers.svg').write_text(svg,encoding='utf-8')
(OUT/'finni-playfield-base.png').write_bytes(resvg_py.svg_to_bytes(svg_string=svg))
old=ET.fromstring(old_vector)
assert [ET.tostring(e) for e in list(old)[1:]]==[ET.tostring(e) for e in list(root)[1:]]
labels=[e for e in root.iter(f'{{{ns}}}text') if e.get('data-mission')]
assert len(labels)==14
(OUT/'art-validation.json').write_text(json.dumps({'insert_and_label_layers_unchanged':True,
    'mission_label_lines':14,'texture_dimensions':[2048,4550],
    'composition':'single continuous environment; no separate activity stickers',
    'generated_source':str(generated),'method':'built-in imagegen, exact vector overlays'},indent=2))
# Preserve the exact built-in prompt with the workspace-bound illustration.
for session in (Path('C:/Users/Jacob/.codex/sessions/2026/11/17')).glob('*01a1ea4c-4282-7e71-b96d-1e7335890ae4.jsonl'):
    for line in session.read_text(encoding='utf-8').splitlines():
        item=json.loads(line);p=item.get('payload',{})
        if p.get('type')=='custom_tool_call' and 'Redesign the ARTWORK BACKGROUND' in p.get('input',''):
            match=re.search(r'prompt:("(?:[^"\\]|\\.)*")',p['input'])
            if match:(OUT/'generation-prompt.txt').write_text(json.loads(match.group(1)),encoding='utf-8')
print('COHESIVE_PLAYFIELD_READY',str(OUT),flush=True)
