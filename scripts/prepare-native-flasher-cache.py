"""Retain original embedded images selected by the pinned full-table texture cache.

The published image is extracted from the VPX, never a rendered capture.
Native upload bytes and virtual getters are independent expectations only.
"""
import argparse,base64,gzip,hashlib,io,json,re,struct,sys
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--table',type=Path,required=True);p.add_argument('--capture',type=Path,required=True)
p.add_argument('--output',type=Path,required=True);p.add_argument('--fixture',type=Path,required=True)
p.add_argument('--pydeps',type=Path,action='append',default=[]);p.add_argument('--getter-layout',type=Path)
p.add_argument('--framebuffer-capture',type=Path)
args=p.parse_args();sys.path[:0]=[str(path) for path in args.pydeps]
import olefile
from PIL import Image
sha=lambda b:hashlib.sha256(b).hexdigest()
capture=json.loads(args.capture.read_text());audit=capture['textureAudit']
assert capture['engineSHA256']=='c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8'
assert sha(args.table.read_bytes())==capture['reference']['sourceSha256']==capture['reference']['controlledSha256']
assert capture['reference']['controlledOverrides']=={} and capture['errors']==[]
getter=audit.get('layout') or json.loads(args.getter_layout.read_text())
assert getter['indices']==[4790] and getter['originalBody']=='0020002903200b'
objects={row['name'].lower():row for row in audit['textureObjects']};images={}
with olefile.OleFileIO(args.table) as table:
 for path in table.listdir():
  if len(path)!=2 or path[0]!='GameStg' or not path[1].startswith('Image'):continue
  data=table.openstream(path).read();assert data[4:8]==b'NAME'
  n=struct.unpack_from('<I',data,8)[0];name=data[12:12+n].decode('utf-8').lower()
  if name not in objects:continue
  start=data.find(b'RIFF');assert start>=0
  size=struct.unpack_from('<I',data,start+4)[0]+8;encoded=data[start:start+size]
  bitmap=Image.open(io.BytesIO(encoded)).convert('RGBA')
  images[name]={'encoded':encoded,'width':bitmap.width,'height':bitmap.height,'rgbaSHA256':sha(bitmap.tobytes()),'encodedSHA256':sha(encoded)}
groups={}
for name,row in objects.items():groups.setdefault(row['liveHash'],[]).append(name)
frame,draw=next((frame,draw) for frame in capture['frames'] for draw in frame['draws'] if 'flasherTextureA' in draw)
selected_upload=next(row for row in audit['uploads'] if row['id']==draw['flasherTextureA']['id'])
selected=next(name for name,image in images.items() if image['rgbaSHA256']==selected_upload['rgbaSHA256'])
key=objects[selected]['liveHash'];members=groups[key];assert len(members)>1
assert sha(base64.b64decode(draw['flasherTextureA']['bytes']))==images[selected]['rgbaSHA256']
for name in members:
 row=objects[name];assert row['getter']==4790
 assert int(row['liveHash'])==row['object']^row['pinBinary']^(images[name]['width']<<16)^(images[name]['height']<<32)
assert re.fullmatch('[a-z0-9-]+',selected);filename='cache-'+selected+'.webp';image=images[selected]
metadata={'engineSHA256':capture['engineSHA256'],'sourceTableSHA256':capture['reference']['sourceSha256'],'aliases':{name:selected for name in members if name!=selected},'images':{selected:{'width':image['width'],'height':image['height'],'format':35907,'pixelFormat':6408,'pixelType':5121,'encoding':'webp-source','generatedMipmaps':True,'levels':[{'file':filename,'bytes':len(image['encoded']),'sha256':image['encodedSHA256'],'sourceBytes':image['width']*image['height']*4,'sourceSHA256':image['rgbaSHA256']}]}},'provenance':{'captureSHA256':sha(args.capture.read_bytes()),'textureCacheKey':key,'members':[objects[name]['name'] for name in members],'selectedSourceImage':selected,'scope':'The pinned full-table texture manager caches by GetLiveHash. These original image objects have the same key before physics starts; the first actual upload uses embedded '+selected+' pixels. This file retains that resource binding, using the original embedded encoded image, without a rendered reference image, body, rules or clock override.'}}
fixture={'engineSHA256':capture['engineSHA256'],'sourceTableSHA256':metadata['sourceTableSHA256'],'captureSHA256':sha(args.capture.read_bytes()),'getter':getter,'objects':audit['textureObjects'],'uploads':audit['uploads'],'warmFrame':frame['frameIndex'],'warmDraw':draw,'embeddedImages':{name:{**{k:v for k,v in image.items() if k!='encoded'},'encodedBase64':base64.b64encode(image['encoded']).decode()} for name,image in images.items()},'scope':metadata['provenance']['scope']}
if args.framebuffer_capture:
 context=json.loads(args.framebuffer_capture.read_text());assert context['engineSHA256']==capture['engineSHA256'] and context['reference']['sourceSha256']==metadata['sourceTableSHA256']
 fixture['framebuffer']={'captureSHA256':sha(args.framebuffer_capture.read_bytes()),'attributes':context['frames'][0]['canvas']['attributes']}
assert not args.output.exists() and not args.fixture.exists();args.output.mkdir(parents=True)
(args.output/filename).write_bytes(image['encoded']);(args.output/'texture-cache.json').write_text(json.dumps(metadata,indent=2)+'\n')
args.fixture.write_bytes(gzip.compress(json.dumps(fixture,separators=(',',':')).encode(),mtime=0))
print(json.dumps({'output':str(args.output),'fixture':str(args.fixture),'aliases':metadata['aliases'],'sourceImageSHA256':image['rgbaSHA256']}))
