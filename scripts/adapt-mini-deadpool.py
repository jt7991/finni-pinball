"""Adapt the actual four-part Mini Deadpool into a Finni fox bobblehead.

Uses the source body and arm envelopes, stance, local origins and script
object names. Rebuilds clean fox anatomy and reshapes the source head.
"""
import bpy,bmesh,math,json
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/vpx-v1';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'.work/deadpool-source.blend'))
NAMES=['LilHead','LilLeftArm','LilRightArm','Primitive077']
objects={name:bpy.data.objects[name] for name in NAMES}
pivots={name:obj.matrix_world.copy() for name,obj in objects.items()}
reference=bpy.data.collections.new('REFERENCE | original Mini Deadpool geometry')
bpy.context.scene.collection.children.link(reference)
for name,obj in objects.items():
    copy=obj.copy();copy.data=obj.data.copy();copy.name='REFERENCE_'+name
    reference.objects.link(copy);copy.hide_render=True;copy.hide_set(True)
original_bounds={name:[[min((o.matrix_world@Vector(c))[i] for c in o.bound_box) for i in range(3)],[max((o.matrix_world@Vector(c))[i] for c in o.bound_box) for i in range(3)]] for name,o in objects.items()}
F=Vector((-.5239493847,-.8517494202,0));R=Vector((-F.y,F.x,0));Z=Vector((0,0,1))
BASE=objects['Primitive077'].location.copy()
HC=Vector((.3383677304,-.3605263829,0))
rotation=Matrix((R,-F,Z)).transposed().to_quaternion()

def rgba(value):
    def lin(c):
        c=int(c,16)/255
        return c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4
    return tuple(lin(value[i:i+2]) for i in (0,2,4))+(1,)
def material(name,color,rough=.43):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=rgba(color)
    s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=rgba(color);s.inputs['Roughness'].default_value=rough;s.inputs['Specular IOR Level'].default_value=.28
    return m
ORANGE=material('Finni orange vinyl','ED762F')
CREAM=material('Finni cream vinyl','FFF0CD')
BROWN=material('Finni cocoa paws and smile','713911')
GOLD=material('Finni warm inner ear','FFB53E')
NOSE=material('Finni polished cocoa nose','64300D',.27)
SILVER=material('Original articulated joints','A8A6AC',.27)
def node_math(nodes,links,op,a,b=None):
    n=nodes.new('ShaderNodeMath');n.operation=op
    for i,value in enumerate((a,b)):
        if value is None:continue
        if isinstance(value,(int,float)):n.inputs[i].default_value=value
        else:links.new(value,n.inputs[i])
    return n.outputs[0]
def projected(nodes,links,position,axis,origin):
    n=nodes.new('ShaderNodeVectorMath');n.operation='DOT_PRODUCT';links.new(position,n.inputs[0]);n.inputs[1].default_value=axis
    return node_math(nodes,links,'SUBTRACT',n.outputs['Value'],origin.dot(axis))
def paint_material(name,head=False,arm=False):
    m=material(name,'ED762F');nodes=m.node_tree.nodes;links=m.node_tree.links
    pos=nodes.new('ShaderNodeNewGeometry').outputs['Position'];sep=nodes.new('ShaderNodeSeparateXYZ');links.new(pos,sep.inputs[0]);z=sep.outputs['Z']
    origin=HC if head else BASE
    x=projected(nodes,links,pos,R,origin);f=projected(nodes,links,pos,F,origin)
    shader=nodes.get('Principled BSDF')
    if head:
        ax=node_math(nodes,links,'ABSOLUTE',x)
        bound=node_math(nodes,links,'ADD',node_math(nodes,links,'MULTIPLY',ax,.245),.103)
        mask=node_math(nodes,links,'MULTIPLY',node_math(nodes,links,'LESS_THAN',z,bound),node_math(nodes,links,'GREATER_THAN',f,-.002))
    else:
        xx=node_math(nodes,links,'DIVIDE',x,.0115);zz=node_math(nodes,links,'DIVIDE',node_math(nodes,links,'SUBTRACT',z,.0785),.012)
        ellipse=node_math(nodes,links,'ADD',node_math(nodes,links,'MULTIPLY',xx,xx),node_math(nodes,links,'MULTIPLY',zz,zz))
        mask=node_math(nodes,links,'MULTIPLY',node_math(nodes,links,'LESS_THAN',ellipse,1),node_math(nodes,links,'GREATER_THAN',f,.003))
    mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[1].default_value=rgba('ED762F');mix.inputs[2].default_value=rgba('FFF0CD');links.new(mask,mix.inputs[0])
    color=mix.outputs[0]
    if not head:
        boot=node_math(nodes,links,'LESS_THAN',z,.047)
        dark=boot
        mx=nodes.new('ShaderNodeMixRGB');links.new(dark,mx.inputs[0]);links.new(color,mx.inputs[1]);mx.inputs[2].default_value=rgba('713911');color=mx.outputs[0]
    links.new(color,shader.inputs['Base Color'])
    return m
HEADMAT=paint_material('Finni | curved cream cheek marking',head=True)
BODYMAT=paint_material('Finni | source body with cream bib')

def set_material(obj,mat):
    obj.data.materials.clear();obj.data.materials.append(mat)
    for p in obj.data.polygons:p.material_index=0;p.use_smooth=True
def ellipsoid(name,center,scale,mat,group,segments=32,rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=center)
    obj=bpy.context.object;obj.name=name;obj.rotation_mode='QUATERNION';obj.rotation_quaternion=rotation;obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    set_material(obj,mat);groups[group].append(obj);return obj
def make_mesh(name,verts,faces,mat,group,subdiv=0):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);set_material(obj,mat)
    if subdiv:
        mod=obj.modifiers.new('Rounded molded surface','SUBSURF');mod.levels=subdiv;mod.render_levels=subdiv
    groups[group].append(obj);return obj
def curve(name,coords,radius,mat,group):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.bevel_depth=radius;data.bevel_resolution=4;data.resolution_u=14;data.use_fill_caps=True
    sp=data.splines.new('BEZIER');sp.bezier_points.add(len(coords)-1)
    for p,co in zip(sp.bezier_points,coords):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);data.materials.append(mat);groups[group].append(obj);return obj
def at(x,f,z,origin=HC):return origin+R*x+F*f+Z*z
groups={name:[obj] for name,obj in objects.items()}

# The source body supplies the stance, scale, foot plane and pivots. Its suit,
# belt, pouches, boots and weapons are replaced by smooth fox anatomy.
removed={}
for name in ('Primitive077','LilLeftArm','LilRightArm'):
    removed[name]=len(objects[name].data.vertices)
    bpy.data.objects.remove(objects[name],do_unlink=True);groups[name]=[]
body_origin=BASE-Z*BASE.z
torso=ellipsoid('Fox | upright pear torso',at(0,0,.071,body_origin),(.0175,.013,.0205),BODYMAT,'Primitive077',48,32)
ellipsoid('Fox | tapered neck',at(0,-.001,.088,body_origin),(.011,.010,.010),BODYMAT,'Primitive077')
for side in (-1,1):
    leg=ellipsoid(f'Fox | short leg {side}',at(side*.0095,.001,.0495,body_origin),(.0065,.007,.013),BODYMAT,'Primitive077')
    leg.rotation_mode='QUATERNION'
    leg.rotation_quaternion=(Z+R*(side*.15)).to_track_quat('Z','Y')
# Fuse the torso/neck/legs so they read as a single molded fox body.
bpy.ops.object.select_all(action='DESELECT')
for obj in groups['Primitive077']:obj.select_set(True)
bpy.context.view_layer.objects.active=torso;bpy.ops.object.join()
body=bpy.context.object;body.data.remesh_voxel_size=.00055;bpy.ops.object.voxel_remesh()
smooth=body.modifiers.new('Continuous fur contours','SMOOTH');smooth.factor=.65;smooth.iterations=5;bpy.ops.object.modifier_apply(modifier=smooth.name)
set_material(body,BODYMAT);groups['Primitive077']=[body];objects['Primitive077']=body
# Preserve the exact static-body origin from the VPX.
old=body.matrix_world.copy();body.matrix_world=pivots['Primitive077'];delta=body.matrix_world.inverted()@old
for v in body.data.vertices:v.co=delta@v.co
for side in (-1,1):
    paw=at(side*.011,.0055,.0378,body_origin)
    ellipsoid(f'Fox | rounded hind paw {side}',paw,(.0074,.010,.0045),BROWN,'Primitive077')
    for toe in (-1,0,1):
        ellipsoid(f'Fox | hind toe {side} {toe}',paw+R*(toe*.0033)+F*.0072-Z*.0002,(.0023,.0032,.0028),BROWN,'Primitive077',24,16)
for side,name,hand in [(-1,'LilLeftArm',Vector((.2941,-.3579,.0780))),(1,'LilRightArm',Vector((.3648,-.3944,.0783)))]:
    root=at(side*.0155,-.0005,.0815,body_origin)
    center=(root+hand)/2
    arm=ellipsoid(f'Fox | soft foreleg {side}',center,(.0051,.0051,(hand-root).length*.63),ORANGE,name)
    arm.rotation_mode='QUATERNION';arm.rotation_quaternion=(hand-root).to_track_quat('Z','Y')
    paw=ellipsoid(f'Fox | front paw {side}',hand,(.0054,.005,.0059),BROWN,name)
    ellipsoid(f'Fox | cream paw pad {side}',hand+F*.0043,(.0032,.0011,.0032),CREAM,name,24,16)
    for toe in (-1,0,1):
        ellipsoid(f'Fox | front toe {side} {toe}',hand+R*(toe*.0028)+Z*.004,(.0019,.0035,.0022),BROWN,name,24,16)
    objects[name]=arm
    old=arm.matrix_world.copy();arm.matrix_world=pivots[name];delta=arm.matrix_world.inverted()@old
    for v in arm.data.vertices:v.co=delta@v.co

# Reshape the source bobblehead mesh, preserving its original animated origin.
head=objects['LilHead'];set_material(head,HEADMAT)
for v in head.data.vertices:
    world=head.matrix_world@v.co
    rel=world-HC;x=rel.dot(R);f=rel.dot(F)
    t=(world.z-.0902647153)/.05364149
    x*=1.10+.075*math.exp(-((t-.28)/.23)**2)
    f*=.86
    world=at(x,f,.0902647153+t*.038)
    v.co=head.matrix_world.inverted()@world
mod=head.modifiers.new('Smooth source bobblehead','SUBSURF');mod.levels=1;mod.render_levels=1
bpy.context.view_layer.update()
def face_point(x,z,offset=.00035):
    origin=at(x,.1,z)
    evaluated=head.evaluated_get(bpy.context.evaluated_depsgraph_get())
    inv=head.matrix_world.inverted()
    hit,loc,normal,index=evaluated.ray_cast(inv@origin,inv.to_3x3()@(-F))
    return head.matrix_world@loc+F*offset if hit else at(x,.022,z)

# Rounded, fully dimensional ears fitted to the original head envelope.
ear_profile=[(.120,.018,.010,.0048,-.003),(.127,.020,.009,.0043,-.003),(.136,.023,.0064,.0032,-.002),(.144,.026,.0027,.0018,-.001),(.149,.027,.00035,.00035,-.0005)]
def ear_dims(z):
    for lo,hi in zip(ear_profile,ear_profile[1:]):
        if lo[0]<=z<=hi[0]:
            t=(z-lo[0])/(hi[0]-lo[0]);return [lo[i]+t*(hi[i]-lo[i]) for i in range(1,5)]
    return ear_profile[-1][1:]
for side in (-1,1):
    verts=[];faces=[];n=40
    for z,cx,w,d,front in ear_profile:
        for k in range(n):
            a=2*math.pi*k/n;verts.append(at(side*(cx+w*math.sin(a)),front+d*math.cos(a),z))
    for j in range(len(ear_profile)-1):
        for k in range(n):
            a=j*n+k;b=j*n+(k+1)%n;faces.append((a,b,b+n,a+n))
    faces.extend([tuple(reversed(range(n))),tuple((len(ear_profile)-1)*n+k for k in range(n))])
    make_mesh(f'Fox ear {side} | dimensional shell',verts,faces,ORANGE,'LilHead',2)
    for width,zmin,zmax,off,mat,label in [(.82,.124,.146,.00016,BROWN,'rim'),(.65,.126,.144,.00028,GOLD,'inner ear')]:
        verts=[];faces=[];rows=28;cols=18
        for j in range(rows+1):
            z=zmin+(zmax-zmin)*j/rows;cx,w,d,front=ear_dims(z)
            rounded=math.sin(math.pi*(.05+.9*j/rows))**.18
            for k in range(cols+1):
                u=(-1+2*k/cols)*width*rounded
                verts.append(at(side*(cx+w*u),front+d*math.sqrt(1-u*u)+off,z))
        for j in range(rows):
            for k in range(cols):
                a=j*(cols+1)+k;faces.append((a,a+1,a+cols+2,a+cols+1))
        make_mesh(f'Fox ear {side} | {label}',verts,faces,mat,'LilHead',1)

# Fox muzzle and nose are modeled in front of the source head surface.
snout_surface=face_point(0,.104,0)
# The cream cheek marking supplies the muzzle on the rounded head itself.
# Keep the nose nearly flush so its top-down silhouette has no white oval lip.
nose_center=face_point(0,.1055,.0004)
# A shallow rounded triangular cushion reads as a fox nose from above, without
# the long projection and spherical button shape of the previous iteration.
outline=[(-.0032,.0011),(-.0029,.0020),(-.0017,.0024),(.0017,.0024),(.0029,.0020),(.0032,.0011),(.0027,-.0001),(.0012,-.0017),(0,-.0021),(-.0012,-.0017),(-.0027,-.0001)]
verts=[];faces=[];nose_rings=[(.0010,.65),(.0006,1),(-.0004,.95),(-.0008,.55)]
for depth,scale in nose_rings:
    for x,z in outline:verts.append(nose_center+R*(x*scale)+Z*(z*scale)+F*depth)
count=len(outline)
for j in range(len(nose_rings)-1):
    for k in range(count):
        a=j*count+k;b=j*count+(k+1)%count;faces.append((a,b,b+count,a+count))
faces += [tuple(reversed(range(count))),tuple((len(nose_rings)-1)*count+k for k in range(count))]
make_mesh('Fox | shallow rounded triangular nose',verts,faces,NOSE,'LilHead',2)
for side in (-1,1):
    coords=[face_point(side*x,z,.00055) for x,z in [(.005,.114),(.0068,.116),(.010,.1167),(.0132,.116),(.015,.114)]]
    curve(f'Fox smile eye {side}',coords,.00085,BROWN,'LilHead')
    curve(f'Fox eyebrow {side}',[face_point(side*x,z,.0004) for x,z in [(.007,.121),(.010,.1217),(.0128,.121)]],.00038,BROWN,'LilHead')
curve('Fox nose stem',[face_point(0,z,.0004) for z in (.1045,.1035,.1024)],.00038,BROWN,'LilHead')
for side in (-1,1):
    curve(f'Fox muzzle smile {side}',[face_point(side*x,z,.0004) for x,z in [(0,.1024),(.0022,.1012),(.0046,.1015),(.0061,.1032)]],.00038,BROWN,'LilHead')

# A small bushy tail attaches to the original static body, within the arm span.
tail_points=[(.010,-.004,.048),(.024,-.012,.047),(.031,-.015,.055),(.032,-.015,.067),(.027,-.014,.078),(.021,-.012,.083)]
radii=[.003,.0065,.008,.007,.0048,.0003]
def cat(points,t):
    pos=t*(len(points)-1);i=min(int(pos),len(points)-2);u=pos-i
    a=points[max(0,i-1)];b=points[i];c=points[i+1];d=points[min(len(points)-1,i+2)]
    return .5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u)
controls=[at(x,f,z,BASE-Z*BASE.z) for x,f,z in tail_points]
verts=[];faces=[];steps=54;sides=28;split=39
for j in range(steps+1):
    for k in range(sides):
        a=2*math.pi*k/sides;boundary=.72+.035*math.sin(a*3)
        t=boundary*j/split if j<=split else boundary+(1-boundary)*(j-split)/(steps-split)
        p=cat(controls,t);tan=(cat(controls,min(1,t+.001))-cat(controls,max(0,t-.001))).normalized();axis=tan.cross(F).normalized();other=tan.cross(axis).normalized();r=cat(radii,t)
        verts.append(p+axis*math.cos(a)*r+other*math.sin(a)*r*.8)
for j in range(steps):
    for k in range(sides):
        a=j*sides+k;b=j*sides+(k+1)%sides;faces.append((a,b,b+sides,a+sides))
faces += [tuple(reversed(range(sides))),tuple(steps*sides+k for k in range(sides))]
tail=make_mesh('Fox bushy tail',verts,faces,ORANGE,'Primitive077');tail.data.materials.append(CREAM)
for j in range(split,steps):
    for k in range(sides):tail.data.polygons[j*sides+k].material_index=1
tail.data.polygons[-1].material_index=1

# Join each part at its original source origin, then give the four parts one
# shared texture atlas. All three animation pivots remain separate afterwards.
part_groups={}
for name,part in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in part:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[name]
    bpy.ops.object.convert(target='MESH');bpy.ops.object.join()
    obj=bpy.context.object;obj.name=name
    vg=obj.vertex_groups.new(name='VPX_PART_'+name);vg.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    part_groups[name]=obj
bpy.ops.object.select_all(action='DESELECT')
for obj in part_groups.values():obj.select_set(True)
bpy.context.view_layer.objects.active=part_groups['LilHead'];bpy.ops.object.join();joined=bpy.context.object
joined.name='FinniFox_AtlasBake'
tri=joined.modifiers.new('Export triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.uv.smart_project(angle_limit=math.radians(75),island_margin=.0015);bpy.ops.object.mode_set(mode='OBJECT')
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
scene.cycles.device='GPU'
atlas=bpy.data.images.new('finni-fox-vpx-atlas',width=2048,height=2048,alpha=False);atlas.filepath_raw=str(OUT/'finni-fox-atlas.png');atlas.file_format='PNG'
for m in joined.data.materials:
    node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=atlas;m.node_tree.nodes.active=node
    shader=m.node_tree.nodes.get('Principled BSDF')
    emission=m.node_tree.nodes.new('ShaderNodeEmission');emission.inputs['Strength'].default_value=1
    if shader.inputs['Base Color'].is_linked:
        m.node_tree.links.new(shader.inputs['Base Color'].links[0].from_socket,emission.inputs['Color'])
    else:emission.inputs['Color'].default_value=shader.inputs['Base Color'].default_value
    m.node_tree.links.new(emission.outputs[0],m.node_tree.nodes.get('Material Output').inputs['Surface'])
scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True;scene.render.bake.margin=10
bpy.ops.object.bake(type='EMIT');atlas.save()
baked=material('Finni fox | VPX shared atlas','FFFFFF',.43)
tex=baked.node_tree.nodes.new('ShaderNodeTexImage');tex.image=atlas;baked.node_tree.links.new(tex.outputs['Color'],baked.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
final={}
for name in NAMES:
    gid=joined.vertex_groups['VPX_PART_'+name].index
    members={v.index for v in joined.data.vertices if any(g.group==gid and g.weight>.5 for g in v.groups)}
    polygons=[p for p in joined.data.polygons if all(v in members for v in p.vertices)]
    indices=sorted({v for p in polygons for v in p.vertices});mapping={v:i for i,v in enumerate(indices)}
    transform=pivots[name].inverted()@joined.matrix_world
    vertices=[transform@joined.data.vertices[i].co for i in indices]
    faces=[tuple(mapping[v] for v in p.vertices) for p in polygons]
    data=bpy.data.meshes.new(name+'_Finni');data.from_pydata(vertices,[],faces);data.update();uv=data.uv_layers.new(name='UVMap')
    for new,old in zip(data.polygons,polygons):
        new.use_smooth=True
        for a,b in zip(new.loop_indices,old.loop_indices):uv.data[a].uv=joined.data.uv_layers.active.data[b].uv
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.matrix_world=pivots[name];data.materials.append(baked);final[name]=obj
bpy.data.objects.remove(joined,do_unlink=True)

# Export individual primitives in vpxtool's extracted OBJ coordinate system.
VPX_SCALE=.053975
for name,obj in final.items():
    lines=['# Finni fox replacement derived from JP Salas / OneSharpEdge Mini Deadpool',f'o {name}']
    for v in obj.data.vertices:
        p=v.co/VPX_SCALE;lines.append(f'v {p.x:.9g} {-p.y:.9g} {-p.z:.9g}')
    uv=obj.data.uv_layers.active.data
    for loop in obj.data.loops:
        u=uv[loop.index].uv;lines.append(f'vt {u.x:.9g} {u.y:.9g}')
    for loop in obj.data.loops:
        n=obj.data.corner_normals[loop.index].vector;lines.append(f'vn {n.x:.9g} {-n.y:.9g} {-n.z:.9g}')
    for p in obj.data.polygons:
        lines.append('f '+' '.join(f'{obj.data.loops[l].vertex_index+1}/{l+1}/{l+1}' for l in p.loop_indices))
    (OUT/(name+'.obj')).write_text('\n'.join(lines)+'\n')
bpy.ops.object.select_all(action='DESELECT')
for obj in final.values():obj.select_set(True)
bpy.context.view_layer.objects.active=final['LilHead']
bpy.ops.export_scene.gltf(filepath=str(OUT/'finni-fox-vpx.glb'),export_format='GLB',use_selection=True)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'finni-table-working.blend'))
report={'source':'JP Salas Deadpool 7.0.0 / OneSharpEdge Lil Deadpool','basis':'source scale, standing pose and pivots; rebuilt smooth fox anatomy; original head reshaped with dimensional fox ears, muzzle and face','parts':{},'replaced_costume_vertices':removed,'atlas':[2048,2048],'vpx_coordinates':'primitive-local OBJ, source position/size/rotations unchanged'}
for name,obj in final.items():
    report['parts'][name]={'triangles':len(obj.data.polygons),'source_world_bounds':original_bounds[name],'original_pivot':[list(r) for r in pivots[name]],'final_pivot':[list(r) for r in obj.matrix_world]}
(OUT/'fox-fit-report.json').write_text(json.dumps(report,indent=2))
print('VPX_FOX_COMPLETE',json.dumps({name:len(obj.data.polygons) for name,obj in final.items()}))
