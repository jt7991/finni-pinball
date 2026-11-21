"""Export a simplified, unlit-budget table from the saved accepted Blender scene.

blender --background --python scripts/export-three-model.py
No original texture bundle is shipped: retain only Finni's atlas and flat hardware colors.
"""
import bpy
import re
import numpy as np
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'three/public'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'output/vpx-v1/finni-table-scene.blend'))
palette = {}
def material(name, color, metal=0):
    if name not in palette:
        m = bpy.data.materials.new('Web ' + name)
        linear=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in color)
        m.diffuse_color = (*linear, 1)
        m.use_nodes = True
        s = m.node_tree.nodes.get('Principled BSDF')
        s.inputs['Base Color'].default_value = (*linear, 1)
        s.inputs['Metallic'].default_value = metal
        s.inputs['Roughness'].default_value = .38 if metal else .6
        palette[name] = m
    return palette[name]

selected = []
fox = {'LilHead', 'LilLeftArm', 'LilRightArm', 'Primitive077'}
for obj in list(bpy.data.objects):
    obj.select_set(False)
    if obj.type != 'MESH' or obj.hide_render:
        continue
    name = obj.name.lower()
    if any(s in name for s in ('flipper','insert','_bulb','_socket','presentation','playfield','lightinserts','backwall','backglass')):
        continue
    bounds = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    center = sum(bounds,Vector())/8
    if center.x < -.02 or center.x > .54 or center.y < -1.15 or center.y > .025:
        continue
    # A huge flat source floor is replaced by the lightweight WebP plane.
    if obj.dimensions.x > .45 and obj.dimensions.y > .9:
        continue
    if obj.name not in fox:
        for slot in obj.material_slots:
            source = slot.material
            label = source.name.lower() if source else ''
            if source and source.use_nodes:
                label += ' ' + ' '.join(n.image.name.lower() for n in source.node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
            mask=next((n.image for n in source.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.name.lower().startswith('plastics')),None) if source and source.use_nodes else None
            if mask:
                key='plastic-mask-'+mask.name
                if key not in palette:
                    m=material(key,(20/255,38/255,81/255));m.surface_render_method='DITHERED'
                    image=mask.copy();factor=min(1,512/max(image.size));image.scale(max(1,int(image.size[0]*factor)),max(1,int(image.size[1]*factor)))
                    pixels=np.array(image.pixels[:],dtype=np.float32).reshape(-1,4);pixels[:,:3]=(20/255,38/255,81/255);image.pixels[:]=pixels.ravel()
                    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
                    shader=m.node_tree.nodes.get('Principled BSDF');m.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color']);m.node_tree.links.new(tex.outputs['Alpha'],shader.inputs['Alpha'])
                slot.material=palette[key]
            elif 'balloon' in label:
                color = (.01,.22,.95) if 'lilac' in label else (.95,.73,.01) if 'mint' in label else (1,.015,.24)
                slot.material = material(label,color)
            elif 'frost' in label or 'cake' in label or 'icing' in label:
                slot.material = material('cake',(.95,.02,.27))
            elif 'metal' in label or 'wire' in label or 'steel' in label:
                slot.material = material('steel',(.5,.58,.65),.65)
            elif 'rubber' in label or 'cream' in label:
                slot.material = material('rubber',(.82,.78,.64))
            elif 'glass' in label or 'clear' in label:
                slot.material = material('steel',(.5,.58,.65),.65)
            else:
                slot.material = material('navy',(20/255,38/255,81/255))
    if len(obj.data.polygons)>500:
        mod = obj.modifiers.new('Mobile mesh budget','DECIMATE')
        mod.ratio = max(.08,min(.5,1000/len(obj.data.polygons)))
    selected.append(obj)

for img in bpy.data.images:
    if img.size[0]>512 or img.size[1]>512:
        factor=512/max(img.size)
        img.scale(max(1,int(img.size[0]*factor)),max(1,int(img.size[1]*factor)))

# Bake modifiers and combine static geometry to share material draw calls.
bpy.ops.object.select_all(action='DESELECT')
for obj in selected:
    obj.hide_set(False)
    obj.select_set(True)
bpy.context.view_layer.objects.active = selected[0]
bpy.ops.object.convert(target='MESH')
dynamic=[obj for obj in selected if obj.name in fox or re.match(r'(?i)(target|spinner|gate\d|discoball)',obj.name)]
for obj in dynamic:obj.select_set(False)
static=[obj for obj in selected if obj not in dynamic]
bpy.context.view_layer.objects.active=static[0]
bpy.ops.object.join()
for obj in dynamic:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / 'table.glb'),export_format='GLB',use_selection=True,
                         export_animations=False,export_cameras=False,export_lights=False,
                         export_image_format='AUTO',export_apply=True,
                         export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
print('THREE_MODEL_BYTES', (OUT/'table.glb').stat().st_size)
