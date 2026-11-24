"""Retain authored startup camera fields from the original binary VPX table."""
import argparse,hashlib,json,struct,sys
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--table',type=Path,required=True)
parser.add_argument('--pydeps',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args();sys.path.insert(0,str(args.pydeps))
import olefile
with olefile.OleFileIO(args.table) as table:data=table.openstream(['GameStg','GameData']).read()
names=['ROTA','INCL','LAYB','FOVX','XLTX','XLTY','XLTZ','SCLX','SCLY','SCLZ']
at=0;fields={}
while at+8<=len(data):
    size=struct.unpack_from('<I',data,at)[0]
    if size<4 or at+4+size>len(data):raise ValueError('Invalid VPX camera BIFF record')
    name=data[at+4:at+8].decode('ascii');value=data[at+8:at+4+size]
    if name in names:fields[name]=struct.unpack('<f',value)[0]
    at+=size+4
assert set(fields)==set(names)
result={'sourceTableSHA256':hashlib.sha256(args.table.read_bytes()).hexdigest(),'fields':fields}
assert not args.output.exists(),'Preserve existing source observations'
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
