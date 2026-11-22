# SPDX-License-Identifier: GPL-3.0-or-later
"""Read original VPX Float32 collision vertices, avoiding rounded OBJ exports.

Primitive mesh tags and transform math follow Visual Pinball contributors'
primitive.cpp / math/matrix.h at 195f214dd4849b8ef6113fd377258b78d0dec3bf.
Requires olefile in the Python environment used for asset preparation.
"""
import math
import struct
import zlib
import olefile

def f(value):return struct.unpack('<f',struct.pack('<f',value))[0]
def identity():return [[float(i==j) for j in range(4)] for i in range(4)]
def translate(x,y,z):
    m=identity();m[3][:3]=[f(x),f(y),f(z)];return m
def rotate(axis,degrees):
    angle=f(f(degrees)*f(math.pi/180));s=f(math.sin(angle));c=f(math.cos(angle));m=identity()
    a,b={'x':(1,2),'y':(2,0),'z':(0,1)}[axis]
    m[a][a]=m[b][b]=c;m[a][b]=s;m[b][a]=-s;return m
def multiply(a,b):
    return [[f(f(f(f(b[0][j]*a[i][0])+f(b[1][j]*a[i][1]))+f(b[2][j]*a[i][2]))+f(b[3][j]*a[i][3])) for j in range(4)] for i in range(4)]
def transformed(mesh,item):
    r=item['rot_and_tra'];p=item['position'];size=item['size'];rt=translate(*r[3:6])
    for axis,index in [('z',2),('y',1),('x',0),('z',8),('y',7),('x',6)]:rt=multiply(rt,rotate(axis,r[index]))
    scale=identity()
    for i,key in enumerate('xyz'):scale[i][i]=f(size[key])
    m=multiply(multiply(scale,rt),translate(*[p[k] for k in 'xyz']));vertices=[]
    for x,y,z in mesh['vertices']:
        w=f(f(f(f(m[0][3]*x)+f(m[1][3]*y))+f(m[2][3]*z))+m[3][3]);inv=f(1/w)
        q=[f(f(f(f(f(m[0][j]*x)+f(m[1][j]*y))+f(m[2][j]*z))+m[3][j])*inv) for j in range(3)]
        vertices.extend([q[0]*.01,(2115-q[1])*.01,q[2]*.01])
    # Reflecting native Y into Three.js reverses handedness. Keep outward
    # normals and the same triangle/edge registration order as the OBJ path.
    indices=[]
    for i in range(0,len(mesh['indices']),3):
        a,b,c=mesh['indices'][i:i+3];indices.extend([a,c,b])
    return {'vertices':vertices,'indices':indices,'native_edges':True}

def read_meshes(path,render=False):
    result={}
    with olefile.OleFileIO(path) as table:
        for path in table.listdir():
            if len(path)!=2 or path[0]!='GameStg' or not path[1].startswith('GameItem'):continue
            data=table.openstream(path).read()
            if len(data)<4 or struct.unpack_from('<I',data)[0]!=19:continue # Primitive
            offset=4;tags={}
            while offset+8<=len(data):
                size=struct.unpack_from('<I',data,offset)[0]
                if size<4 or offset+4+size>len(data):raise ValueError(f'Malformed VPX mesh record {path}')
                tags[data[offset+4:offset+8]]=data[offset+8:offset+4+size];offset+=size+4
            if b'M3CX' not in tags and b'M3DX' not in tags:continue
            raw=zlib.decompress(tags[b'M3CX']) if b'M3CX' in tags else tags[b'M3DX']
            count=struct.unpack('<I',tags[b'M3VN'])[0]
            if len(raw)!=count*32:raise ValueError(f'Unexpected native vertex stride {path}')
            vertices=[struct.unpack_from('<3f',raw,i*32) for i in range(count)]
            render_bytes=raw if render else None
            raw=zlib.decompress(tags[b'M3CI']) if b'M3CI' in tags else tags[b'M3DI']
            count_indices=struct.unpack('<I',tags[b'M3FN'])[0];fmt='I' if count>65535 else 'H'
            if len(raw)!=count_indices*struct.calcsize(fmt):raise ValueError(f'Unexpected native index stride {path}')
            indices=list(struct.unpack('<'+fmt*count_indices,raw));name=tags[b'NAME'][4:].decode('utf-16le')
            result[name]={'vertices':vertices,'indices':indices}
            if render:result[name]['render_bytes']=render_bytes
    return result
