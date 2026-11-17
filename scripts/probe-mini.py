import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'.work/deadpool-source.blend'))
head=bpy.data.objects['LilHead'];img=bpy.data.images['lildp-th'];pixels=list(img.pixels);w,h=img.size
uv=head.data.uv_layers.active.data
weighted=Vector();total=0
for p in head.data.polygons:
    coords=[uv[i].uv for i in p.loop_indices]
    u=sum(v.x for v in coords)/len(coords);v=sum(v.y for v in coords)/len(coords)
    x=max(0,min(w-1,int(u*w)));y=max(0,min(h-1,int(v*h)))
    rgb=pixels[(y*w+x)*4:(y*w+x)*4+3]
    if max(rgb)<.16:
        c=head.matrix_world@p.center
        weighted+=c*p.area;total+=p.area
bbox=[head.matrix_world@Vector(c) for c in head.bound_box]
center=sum(bbox,Vector())/8
dark=weighted/total
direction=dark-center;direction.z=0;direction.normalize()
print('HEAD_FORWARD',list(direction),'DARK_CENTROID',list(dark),'CENTER',list(center))
print('MATERIALS',[(m.name,[(n.type,round(n.inputs['Metallic'].default_value,3),round(n.inputs['Roughness'].default_value,3)) for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED']) for m in bpy.data.materials if m.name.startswith(('LilHead','Playfield','Ramp','Toys'))])
print('COUNTS',len(bpy.data.objects),len(bpy.data.materials))
import bmesh
for name in ('LilLeftArm','LilRightArm'):
    obj=bpy.data.objects[name];bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
    seen=set();groups=[]
    for v in bm.verts:
        if v in seen:continue
        stack=[v];seen.add(v);group=[]
        while stack:
            a=stack.pop();group.append(obj.matrix_world@a.co)
            for edge in a.link_edges:
                b=edge.other_vert(a)
                if b not in seen:seen.add(b);stack.append(b)
        if len(group)>5:
            groups.append({'verts':len(group),'min':[round(min(p[i] for p in group),5) for i in range(3)],'max':[round(max(p[i] for p in group),5) for i in range(3)]})
    print('ARM_COMPONENTS',name,json.dumps(groups))
    bm.free()
print('OBJ_MAPPING_VERTEX',list(bpy.data.objects['LilHead'].data.vertices[0].co))
