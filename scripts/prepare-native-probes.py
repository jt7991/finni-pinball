"""Read authored render probes and preserve VPX's Float32 strength decoding."""
import argparse, hashlib, json, struct, sys
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--table',type=Path,required=True)
parser.add_argument('--pydeps',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args();sys.path.insert(0,str(args.pydeps))
import olefile
def tags(data):
    offset=0
    while offset+8<=len(data):
        size=struct.unpack_from('<I',data,offset)[0]
        if size<4 or offset+size+4>len(data):raise ValueError('Invalid authored BIFF record')
        yield data[offset+4:offset+8].decode('ascii'),data[offset+8:offset+size+4]
        offset+=size+4
def integer(data):return struct.unpack('<i',data)[0]
def f(value):return struct.unpack('<f',struct.pack('<f',value))[0]
with olefile.OleFileIO(args.table) as table:data=table.openstream(['GameStg','GameData']).read()
probes=[];strength=None
for name,value in tags(data):
    if name=='PLST':strength=integer(value)
    elif name=='RPRB':
        fields=dict(tags(value));text=fields['NAME'];length=struct.unpack_from('<I',text)[0]
        probes.append({'name':text[4:4+length].decode('utf-8'),'type':integer(fields['TYPE']),'roughness':integer(fields['RBAS']),'plane':list(struct.unpack('<4f',fields['RPLA'])),'mode':integer(fields['RMOD']),'disableLightReflection':bool(integer(fields['RLMP']))})
assert strength is not None and 0<=strength<=255
result={'sourceTableSHA256':hashlib.sha256(args.table.read_bytes()).hexdigest(),'playfieldStrengthByte':strength,'playfieldStrength':f(strength*f(1/255)),'probes':probes}
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,separators=(',',':')))
print(json.dumps(result))
