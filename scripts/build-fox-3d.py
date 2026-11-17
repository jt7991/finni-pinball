"""Build a real, textured Finni-inspired fox mesh and studio renders in Blender.

This is modeled geometry. It does not turn a picture into a flat card.
The normalized model is not fitted to VPX until the source table is available.
"""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'fox-3d-v1'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, roughness=.38):
    def linear(c):
        c = int(c, 16) / 255
        return c / 12.92 if c < .04045 else ((c + .055) / 1.055) ** 2.4
    rgba = tuple(linear(color[i:i+2]) for i in (0,2,4)) + (1,)
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = rgba
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Specular IOR Level'].default_value = .3
    return mat

ORANGE = material('Finni | tangerine vinyl', 'F58A18')
CREAM = material('Finni | warm cream', 'FFF0C6')
BROWN = material('Finni | cocoa outlines and paws', '713A12')
EAR = material('Finni | toasted ear edge', 'B96618')
GOLD = material('Finni | golden inner ears', 'FFB13D')
NOSE = material('Finni | polished cocoa nose', '66310E', .23)
PINK = material('Finni | warm cheek blush', 'EF9B4C')
parts = []

def finish(obj, name, mat, subdiv=0):
    obj.name = name
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if subdiv:
        mod = obj.modifiers.new('Sculpt surface', 'SUBSURF')
        mod.levels = subdiv
        mod.render_levels = subdiv
    parts.append(obj)
    return obj

def ellipsoid(name, center, scale, mat, rotation=None, segments=40, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj=bpy.context.object
    obj.scale=scale
    if rotation:
        obj.rotation_euler=rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj,name,mat)

def mesh(name, vertices, faces, mat, subdiv=0):
    data=bpy.data.meshes.new(name)
    data.from_pydata(vertices,[],faces)
    data.update()
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    return finish(obj,name,mat,subdiv)

def line(name, coords, radius, mat):
    data=bpy.data.curves.new(name,'CURVE')
    data.dimensions='3D'
    data.resolution_u=16
    data.bevel_depth=radius
    data.bevel_resolution=4
    data.use_fill_caps=True
    spline=data.splines.new('BEZIER')
    spline.bezier_points.add(len(coords)-1)
    for point,xyz in zip(spline.bezier_points,coords):
        point.co=xyz
        point.handle_left_type='AUTO'
        point.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    parts.append(obj)
    return obj

# Body: a seated four-pawed fox, rather than a head mounted on a flat card.
ellipsoid('Body | seated pear', (0,.15,1.2), (.82,.65,1.02), ORANGE)
ellipsoid('Neck | rounded ruff', (0,.03,1.95), (.68,.55,.71), ORANGE)
ellipsoid('Chest | cream bib', (0,-.468,1.38), (.48,.22,.88), CREAM)
for side in (-1,1):
    ellipsoid(f'Haunch {side}', (side*.71,.27,.63), (.49,.55,.62), ORANGE)
    ellipsoid(f'Rear paw {side}', (side*.83,-.02,.22), (.40,.55,.23), BROWN)
    ellipsoid(f'Foreleg {side}', (side*.48,-.42,.87), (.23,.27,.79), ORANGE, (0,side*.065,0))
    ellipsoid(f'Front paw {side}', (side*.50,-.66,.19), (.28,.39,.20), BROWN)
    for toe in (-1,0,1):
        ellipsoid(f'Front toe {side} {toe}', (side*.5+toe*.135,-.925,.17), (.088,.12,.105), BROWN, segments=24,rings=16)

# Fuse the orange body surfaces into a continuous sculpt instead of leaving
# intersecting ellipsoids and horizontal neck seams in the finished model.
body_parts=[p for p in parts if p.name.startswith(('Body |','Neck |','Haunch ','Foreleg '))]
parts=[p for p in parts if p not in body_parts]
bpy.ops.object.select_all(action='DESELECT')
for obj in body_parts: obj.select_set(True)
bpy.context.view_layer.objects.active=body_parts[0]
bpy.ops.object.join()
body=bpy.context.object
body.name='Body | fused seated sculpt'
body.data.remesh_voxel_size=.035
bpy.ops.object.voxel_remesh()
smooth=body.modifiers.new('Smooth fused contours','SMOOTH')
smooth.factor=.7; smooth.iterations=5
bpy.ops.object.modifier_apply(modifier=smooth.name)
for poly in body.data.polygons: poly.use_smooth=True
parts.append(body)

# Swept bushy tail, with its cream tip integrated into the mesh material regions.
tail_controls=[Vector(p) for p in [(.62,.46,.47),(1.13,.66,.46),(1.68,.76,.69),(2.04,.73,1.10),(2.15,.66,1.58),(1.99,.50,2.01),(1.70,.35,2.30)]]
tail_radii=[.15,.34,.47,.49,.40,.26,.025]
def catmull(points,t):
    pos=t*(len(points)-1)
    i=min(int(pos),len(points)-2)
    u=pos-i
    a=points[max(0,i-1)]; b=points[i]; c=points[i+1]; d=points[min(len(points)-1,i+2)]
    return .5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u)
tail_verts=[]; tail_faces=[]; tail_steps=72; tail_sides=32
for j in range(tail_steps+1):
    for k in range(tail_sides):
        angle=2*math.pi*k/tail_sides
        boundary=.735+.025*math.sin(angle*3)+.012*math.sin(angle*6)
        t=boundary*j/53 if j<=53 else boundary+(1-boundary)*(j-53)/(tail_steps-53)
        p=catmull(tail_controls,t)
        tangent=(catmull(tail_controls,min(1,t+.001))-catmull(tail_controls,max(0,t-.001))).normalized()
        axis=tangent.cross(Vector((0,1,0))).normalized()
        other=tangent.cross(axis).normalized()
        rad=catmull(tail_radii,t)
        offset=axis*math.cos(angle)*rad+other*math.sin(angle)*rad*.86
        tail_verts.append(tuple(p+offset))
for j in range(tail_steps):
    for k in range(tail_sides):
        a=j*tail_sides+k; b=j*tail_sides+(k+1)%tail_sides
        tail_faces.append((a,b,b+tail_sides,a+tail_sides))
tail_faces.extend([tuple(reversed(range(tail_sides))),tuple(tail_steps*tail_sides+k for k in range(tail_sides))])
tail=mesh('Tail | sculpted curl with cream tip',tail_verts,tail_faces,ORANGE)
tail.data.materials.append(CREAM)
for j in range(tail_steps):
    for k in range(tail_sides):
        if j>=53:
            tail.data.polygons[j*tail_sides+k].material_index=1
tail.data.polygons[-1].material_index=1

# Custom head loft: a broad forehead, swept cheek points and a tapered chin.
HEAD=[(2.40,.08,.10,-.04),(2.45,.44,.32,-.06),(2.53,.80,.49,-.07),(2.70,1.20,.64,-.06),(2.88,1.61,.73,-.045),(3.04,1.53,.78,-.03),(3.28,1.42,.80,-.01),(3.54,1.33,.77,.015),(3.77,1.15,.65,.035),(3.93,.84,.49,.05),(4.02,.40,.26,.06),(4.04,.06,.06,.06)]
def head_dims(z):
    z=max(HEAD[0][0],min(z,HEAD[-1][0]))
    for low,high in zip(HEAD,HEAD[1:]):
        if low[0]<=z<=high[0]:
            f=(z-low[0])/(high[0]-low[0])
            return tuple(low[k]+f*(high[k]-low[k]) for k in (1,2,3))
    return HEAD[-1][1:]
def head_point(angle,z,offset=0):
    width,depth,cy=head_dims(z)
    return ((width+offset)*math.sin(angle),cy-(depth+offset)*math.cos(angle),z)
verts=[]; faces=[]; sides=128; head_rows=48
boundaries=[]
for i in range(sides):
    angle=-math.pi+2*math.pi*i/sides
    a=abs(angle)
    upper=2.91+.29*math.sin(min(a,1.53)*1.45)-.14*(min(a,1.53)/1.53)**5
    if a>1.43:
        upper=2.402+(upper-2.402)*max(0,1-(a-1.43)/.4)
    boundaries.append(upper)
    for j in range(head_rows+1):
        z=2.40+(upper-2.40)*j/16 if j<=16 else upper+(4.04-upper)*(j-16)/(head_rows-16)
        verts.append(head_point(angle,z))
for i in range(sides):
    for j in range(head_rows):
        a=i*(head_rows+1)+j; b=((i+1)%sides)*(head_rows+1)+j
        faces.append((a,b,b+1,a+1))
faces += [tuple(reversed([i*(head_rows+1) for i in range(sides)])),tuple(i*(head_rows+1)+head_rows for i in range(sides))]
head=mesh('Head | continuous orange and cream sculpt',verts,faces,ORANGE,1)
head.data.materials.append(CREAM)
for i in range(sides):
    angle=-math.pi+2*math.pi*(i+.5)/sides
    if abs(angle)<1.83:
        for j in range(16): head.data.polygons[i*head_rows+j].material_index=1

# Ears are tapered volumes with rounded backs and curved inner surfaces.
EAR_PROFILE=[(3.50,1.03,.43,.29,.04),(3.77,1.10,.44,.28,.06),(4.10,1.19,.37,.235,.08),(4.43,1.28,.26,.18,.10),(4.72,1.37,.14,.105,.12),(4.91,1.40,.035,.03,.13),(4.94,1.40,.005,.005,.13)]
def ear_dims(z):
    for lo,hi in zip(EAR_PROFILE,EAR_PROFILE[1:]):
        if lo[0]<=z<=hi[0]:
            f=(z-lo[0])/(hi[0]-lo[0])
            return tuple(lo[k]+f*(hi[k]-lo[k]) for k in (1,2,3,4))
    return EAR_PROFILE[-1][1:]
def ear_shell(side):
    vertices=[]; faces=[]; n=48
    for z,x,w,d,cy in EAR_PROFILE:
        for k in range(n):
            angle=2*math.pi*k/n
            vertices.append((side*(x+w*math.sin(angle)),cy-d*math.cos(angle),z))
    for j in range(len(EAR_PROFILE)-1):
        for k in range(n):
            a=j*n+k; b=j*n+(k+1)%n
            faces.append((a,b,b+n,a+n))
    faces += [tuple(reversed(range(n))),tuple((len(EAR_PROFILE)-1)*n+k for k in range(n))]
    return mesh(f'Ear {side} | rounded tapered shell',vertices,faces,EAR,2)
def ear_inset(side,zmin,zmax,width,offset,mat,name):
    vertices=[]; faces=[]; cols=24; rows=32
    for j in range(rows+1):
        z=zmin+(zmax-zmin)*j/rows
        cx,w,d,cy=ear_dims(z)
        soften=math.sin(math.pi*(.04+.92*j/rows))**.20
        for k in range(cols+1):
            u=(-1+2*k/cols)*width*soften
            vertices.append((side*(cx+w*u),cy-d*math.sqrt(max(0,1-u*u))-offset,z))
    for j in range(rows):
        for k in range(cols):
            a=j*(cols+1)+k
            faces.append((a,a+1,a+cols+2,a+cols+1))
    return mesh(f'Ear {side} | {name}',vertices,faces,mat,1)
for side in (-1,1):
    ear_shell(side)
    ear_inset(side,3.72,4.83,.82,.012,BROWN,'cocoa inner edge')
    ear_inset(side,3.80,4.76,.65,.022,GOLD,'curved golden inset')

# A real protruding muzzle, nose, and sculpted smiling features.
ellipsoid('Muzzle | left cream pad',(-.245,-.81,2.83),(.49,.36,.29),CREAM)
ellipsoid('Muzzle | right cream pad',(.245,-.81,2.83),(.49,.36,.29),CREAM)
ellipsoid('Nose bridge',(0,-.965,2.99),(.29,.28,.22),CREAM)
nose=ellipsoid('Nose | rounded cocoa triangle',(0,-1.22,3.03),(.245,.16,.165),NOSE)
for vertex in nose.data.vertices:
    # Narrow the bottom into the familiar fox nose rather than a round button.
    ratio=(vertex.co.z/.165+1)/2
    vertex.co.x*=.55+.45*ratio
def front_y(x,z):
    w,d,cy=head_dims(z)
    return cy-d*math.sqrt(max(.02,1-(x/w)**2))-.023
for side in (-1,1):
    coords=[]
    for x,z in [(.40,3.29),(.48,3.39),(.64,3.425),(.80,3.39),(.88,3.30)]:
        coords.append((side*x,front_y(side*x,z),z))
    line(f'Eye {side} | sculpted closed smile',coords,.046,BROWN)
    coords=[]
    for x,z in [(.48,3.66),(.61,3.70),(.76,3.67)]:
        coords.append((side*x,front_y(side*x,z),z))
    line(f'Eyebrow {side}',coords,.022,BROWN)
line('Mouth | nose stem',[(0,-1.34,3.0),(0,-1.22,2.91),(0,-1.17,2.82)],.025,BROWN)
for side in (-1,1):
    line(f'Mouth | smile {side}',[(0,-1.169,2.82),(side*.13,-1.167,2.73),(side*.29,-1.143,2.74),(side*.40,-1.10,2.83)],.026,BROWN)

# Prepare a joined mesh and a separate game mesh with one baked material.
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active=head
bpy.ops.object.convert(target='MESH')
bpy.ops.object.join()
fox=bpy.context.object
fox.name='FinniFox_Master'
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
# Fix normals on mirrored ear pieces and the tail loft.
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')
master_collection=bpy.data.collections.new('MASTER | original modeled surfaces')
bpy.context.scene.collection.children.link(master_collection)
for col in list(fox.users_collection): col.objects.unlink(fox)
master_collection.objects.link(fox)

game=fox.copy(); game.data=fox.data.copy(); game.name='FinniFox_GameMesh'
bpy.context.scene.collection.objects.link(game)
fox.hide_render=True; fox.hide_set(True)
bpy.ops.object.select_all(action='DESELECT')
game.select_set(True); bpy.context.view_layer.objects.active=game
dec=game.modifiers.new('VPX game mesh reduction','DECIMATE')
triangles=sum(len(p.vertices)-2 for p in game.data.polygons)
dec.ratio=min(1,28000/max(1,triangles))
bpy.ops.object.modifier_apply(modifier=dec.name)
tri=game.modifiers.new('Game triangulation','TRIANGULATE')
bpy.ops.object.modifier_apply(modifier=tri.name)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.012)
bpy.ops.object.mode_set(mode='OBJECT')

scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=48
scene.cycles.use_denoising=True
scene.cycles.device='GPU'
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type='OPTIX'
    prefs.get_devices()
    for device in prefs.devices:
        device.use=device.type=='OPTIX'
    if not any(d.use for d in prefs.devices): scene.cycles.device='CPU'
except Exception:
    scene.cycles.device='CPU'

atlas=bpy.data.images.new('finni-fox-basecolor',width=2048,height=2048,alpha=False)
atlas.filepath_raw=str(OUT/'finni-fox-basecolor.png')
atlas.file_format='PNG'
for mat in game.data.materials:
    node=mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image=atlas
    mat.node_tree.nodes.active=node
scene.render.bake.use_pass_direct=False
scene.render.bake.use_pass_indirect=False
scene.render.bake.use_pass_color=True
scene.render.bake.margin=12
bpy.ops.object.bake(type='DIFFUSE')
atlas.save()
baked=material('FinniFox | baked VPX material','FFFFFF',.36)
node=baked.node_tree.nodes.new('ShaderNodeTexImage'); node.image=atlas
baked.node_tree.links.new(node.outputs['Color'],baked.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
game.data.materials.clear(); game.data.materials.append(baked)
for poly in game.data.polygons: poly.material_index=0

# Export real mesh formats before adding presentation objects.
bpy.ops.export_scene.gltf(filepath=str(OUT/'finni-fox.glb'),export_format='GLB',use_selection=True,export_apply=True)
bpy.ops.wm.obj_export(filepath=str(OUT/'finni-fox.obj'),export_selected_objects=True,forward_axis='Y',up_axis='Z',export_triangulated_mesh=True,path_mode='AUTO')

groundmat=material('Studio | cream','F1E9DD',.7)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025))
ground=bpy.context.object; ground.name='Studio ground'; ground.data.materials.append(groundmat)
scene.world.color=(.28,.28,.28)
scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.73,.76,.82,1)
scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.3
def area(name,loc,energy,size,color):
    data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size; data.color=color
    obj=bpy.data.objects.new(name,data); scene.collection.objects.link(obj); obj.location=loc
    obj.rotation_euler=(Vector((0,0,2.1))-obj.location).to_track_quat('-Z','Y').to_euler()
area('Key | large softbox',(-4,-6,9),800,5,(1,.91,.80))
area('Fill | softbox',(5,-2,5),500,4,(.80,.85,1))
area('Rim | warm',(-1,5,7),900,4,(1,.91,.77))
camera_data=bpy.data.cameras.new('Studio camera')
camera=bpy.data.objects.new('Studio camera',camera_data)
scene.collection.objects.link(camera); scene.camera=camera
camera_data.type='ORTHO'; camera_data.ortho_scale=6.8
scene.render.resolution_x=1400; scene.render.resolution_y=1400; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=-.4
def render(name,location,target=(.23,0,2.45)):
    camera.location=location
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/name)
    bpy.ops.render.render(write_still=True)
render('finni-fox-3d.png',(7,-12,7))
render('finni-fox-front.png',(0,-14,4.5))
render('finni-fox-rear.png',(7,11,6))
camera.location=(7,-12,7)
camera.rotation_euler=(Vector((.23,0,2.45))-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.select_all(action='DESELECT')
game.select_set(True)
bpy.context.view_layer.objects.active=game
bpy.ops.file.pack_all()
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'finni-fox.blend'))
manifest={'type':'real modeled 3D mesh','source':'modeled from the current Finni website mascot references','triangles':len(game.data.polygons),'vertices':len(game.data.vertices),'texture':[2048,2048],'dimensions':list(game.dimensions),'coordinates':'Z up; faces -Y; paws at Z=0','vpx_fit':'pending the source VPX; dimensions normalized, not yet fitted','exports':['finni-fox.blend','finni-fox.glb','finni-fox.obj','finni-fox.mtl','finni-fox-basecolor.png'],'renders':['finni-fox-3d.png','finni-fox-front.png','finni-fox-rear.png']}
(OUT/'model-info.json').write_text(json.dumps(manifest,indent=2))
print('FINNI_3D_COMPLETE',json.dumps(manifest))
