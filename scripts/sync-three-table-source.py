# SPDX-License-Identifier: GPL-3.0-or-later
"""Read the merged VPX directly and refresh its authored rules, appearance and sounds.

BIFF fields and sound serialization follow Visual Pinball's Light, Primitive,
Flasher, PinTable and PinSound at 195f214dd4849b8ef6113fd377258b78d0dec3bf.
No executable table editor or modification of either input VPX is required.
"""
import argparse,base64,gzip,hashlib,json,struct,zlib
from pathlib import Path
import olefile
from three_rules_adapter import adapt_rules
from three_sound_settings import sound_settings

ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--old-vpx',type=Path,required=True);p.add_argument('--vpx',type=Path,required=True)
p.add_argument('--output',type=Path,required=True)
p.add_argument('--audit-only',action='store_true',help='Stage imported rules and objects without changing playback assets.')
args=p.parse_args()
out=args.output.resolve();out.mkdir(parents=True,exist_ok=True)
sha=lambda data:hashlib.sha256(data).hexdigest()
def tags(data,offset=0):
    result={}
    while offset+8<=len(data):
        size=struct.unpack_from('<I',data,offset)[0];tag=data[offset+4:offset+8]
        if tag==b'CODE':
            n=struct.unpack_from('<I',data,offset+8)[0];result[tag]=data[offset+12:offset+12+n];break
        if size<4 or offset+4+size>len(data):raise ValueError('Malformed BIFF record')
        result[tag]=data[offset+8:offset+4+size];offset+=4+size
    return result
def read_items(table):
    result={}
    for path in table.listdir():
        if len(path)==2 and path[0]=='GameStg' and path[1].startswith('GameItem'):
            data=table.openstream(path).read();fields=tags(data,4);name=fields[b'NAME'][4:].decode('utf-16le')
            result[name]=(struct.unpack_from('<I',data)[0],fields)
    return result
def scalar(data,fmt='f'):return struct.unpack('<'+fmt,data)[0]
def color(data):
    n=scalar(data,'I');return '#'+''.join(f'{(n>>shift)&255:02x}' for shift in (0,8,16))
def string(data):
    n=struct.unpack_from('<I',data)[0];return data[4:4+n].decode('utf-8')
def script(data):
    return data.decode('utf-8-sig').replace('\r\n','\n')
public=ROOT/'three/public'
bundle=out/'legacy-table-6300.json.gz'
with olefile.OleFileIO(args.old_vpx) as old,olefile.OleFileIO(args.vpx) as new:
    old_items=read_items(old);new_items=read_items(new)
    assert old_items.keys()==new_items.keys(),'New authored objects need an explicit asset exporter update'
    old_data=tags(old.openstream(['GameStg','GameData']).read());new_data=tags(new.openstream(['GameStg','GameData']).read())
    current_rules=(public/'rules.vbs').read_text(encoding='utf-8-sig').replace('\r\n','\n').strip()
    old_rules=adapt_rules(script(old_data[b'CODE'])).strip();new_rules=adapt_rules(script(new_data[b'CODE'])).strip()
    assert current_rules in (old_rules,new_rules),'Recognized source rules'
    if not bundle.exists():
        assert current_rules==old_rules,'Archive the old source before replacing it'
        contents={'sourceSha256':sha(args.old_vpx.read_bytes()),'layout':json.loads((public/'layout.json').read_text()),'objects':json.loads((public/'objects.json').read_text()),'source':(public/'rules.vbs').read_text(encoding='utf-8-sig')}
        bundle.write_bytes(gzip.compress(json.dumps(contents,separators=(',',':')).encode(),mtime=0))
    changes={};meshes={}
    light={b'RADI':('falloff_radius','f'),b'COLR':('color','color'),b'COL2':('color2','color'),b'BWTH':('intensity','f'),b'FASP':('fade_speed_up','f'),b'FASD':('fade_speed_down','f'),b'BMSC':('mesh_radius','f'),b'BHHI':('bulb_halo_height','f')}
    for name,(kind,current) in new_items.items():
        previous=old_items[name][1];different={key for key in current if current[key]!=previous.get(key)}
        update={}
        for key in different:
            if kind==7 and key in light:
                prop,fmt=light[key];update[prop]=color(current[key]) if fmt=='color' else scalar(current[key],fmt)
            elif kind==20 and key==b'FALP':update['alpha']=scalar(current[key],'i')
            elif kind==20 and key==b'COLR':update['color']=color(current[key])
            elif kind==19 and key==b'STRE':update['static_rendering']=bool(scalar(current[key],'i'))
            elif kind==19 and key==b'DILB':update['disable_lighting_below']=scalar(current[key])
            elif kind==19 and key==b'IMAG':update['image']=string(current[key])
            elif kind==19 and key.startswith(b'M3'):pass
            else:raise ValueError(f'Unmapped changed field {name}:{key!r}')
        if update:changes[name]=update
        if any(key.startswith(b'M3') for key in different):
            def mesh(fields):
                vertices=zlib.decompress(fields[b'M3CX']);indices=zlib.decompress(fields[b'M3CI']);count=scalar(fields[b'M3VN'],'I');n=scalar(fields[b'M3FN'],'I');fmt='I' if count>65535 else 'H';indices=struct.pack('<'+'I'*n,*struct.unpack('<'+fmt*n,indices));return {'vertices':base64.b64encode(vertices).decode(),'indices':base64.b64encode(indices).decode(),'vertexSHA256':sha(vertices),'indexSHA256':sha(indices)}
            meshes[name]={'old':mesh(previous),'new':mesh(current)}
    old_sound_signatures={}
    for sound_path in old.listdir():
        if len(sound_path)!=2 or sound_path[0]!='GameStg' or not sound_path[1].startswith('Sound'):continue
        raw=old.openstream(sound_path).read();pos=0;sound_name=None
        for i in range(3):
            n=struct.unpack_from('<I',raw,pos)[0];pos+=4
            if i==0:sound_name=raw[pos:pos+n].decode('utf-8',errors='replace').lower()
            pos+=n
        old_sound_signatures[sound_name]=sha(raw[pos:])
    old_audio=json.loads((public/'audio.json').read_text())
    sounds=[];(out/'sounds').mkdir(exist_ok=True)
    for path in new.listdir():
        if len(path)!=2 or path[0]!='GameStg' or not path[1].startswith('Sound'):continue
        data=new.openstream(path).read();offset=0;names=[]
        for _ in range(3):
            n=struct.unpack_from('<I',data,offset)[0];offset+=4;names.append(data[offset:offset+n].decode('utf-8',errors='replace').rstrip('\0'));offset+=n
        name,original,_=names;unchanged=old_sound_signatures.get(name.lower())==sha(data[offset:]);wav=original.lower().endswith('.wav');wave_format=None
        if wav:wave_format=data[offset:offset+18];offset+=18;assert scalar(wave_format[16:18],'H')==0,'Extended WAV format needs explicit decoding'
        size=struct.unpack_from('<I',data,offset)[0];offset+=4;payload=data[offset:offset+size];assert len(payload)==size
        suffix='.wav' if wav else Path(original.replace('\\','/')).suffix or '.mp3'
        if wav:payload=b'RIFF'+struct.pack('<I',4+8+len(wave_format)+8+size)+b'WAVEfmt '+struct.pack('<I',len(wave_format))+wave_format+b'data'+struct.pack('<I',size)+payload
        filename=name.lower()+suffix;(out/'sounds'/filename).write_bytes(payload);entry={'name':name,'file':filename,'sha256':sha(payload),**sound_settings(data,offset+size)}
        if unchanged and name.lower() in old_audio:entry['reuse_file']=old_audio[name.lower()]['file']
        sounds.append(entry)
    (out/'sounds.json').write_text(json.dumps(sounds,separators=(',',':')))
    globals_={'env_emission_scale':scalar(new_data[b'ENES']),'bloom_strength':scalar(new_data[b'BLST'])}
    ((out if args.audit_only else public)/'rules.vbs').write_text(adapt_rules(script(new_data[b'CODE'])),encoding='utf-8')
objects=json.loads((public/'objects.json').read_text())
for obj in objects['objects']:obj.update(changes.get(obj['name'],{}))
objects['sound_names']=[sound['name'].lower() for sound in sounds]
((out if args.audit_only else public)/'objects.json').write_text(json.dumps(objects,separators=(',',':')))
(out/'table-update.json').write_text(json.dumps({'sourceSha256':sha(args.vpx.read_bytes()),'previousSourceSha256':sha(args.old_vpx.read_bytes()),'auditOnly':args.audit_only,'changes':changes,'meshes':meshes,'globals':globals_},separators=(',',':')))
print(json.dumps({'sourceSha256':sha(args.vpx.read_bytes()),'changedObjects':len(changes),'meshes':list(meshes),'sounds':len(sounds),'globals':globals_}))
