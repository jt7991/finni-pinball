"""Check delivered party scene visibility and portable mesh export in Blender."""
import bpy, json, math, struct, hashlib
from mathutils import Vector
from pathlib import Path

out = Path(__file__).resolve().parents[1]/'output/vpx-v1'
bpy.ops.wm.open_mainfile(filepath=str(out/'finni-table-scene.blend'))
report = json.loads((out/'party-hardware-report.json').read_text())
for name in report['hidden_source_objects']:
    assert bpy.data.objects[name].hide_render, name
for name in report['new_objects']:
    obj = bpy.data.objects[name]
    assert obj.type == 'MESH' and not obj.hide_render, name
    assert all(math.isfinite(c) for v in obj.data.vertices for c in v.co), name
for name in ('LilHead', 'LilLeftArm', 'LilRightArm', 'Primitive077'):
    assert not bpy.data.objects[name].hide_render, name
raw = (out/'finni-party-hardware.glb').read_bytes()
assert raw[:4] == b'glTF'
length = struct.unpack_from('<I', raw, 12)[0]
gltf = json.loads(raw[20:20+length])
exported = {node.get('name') for node in gltf['nodes']}
assert set(report['new_objects']).issubset(exported)
assert {'LilHead', 'LilLeftArm', 'LilRightArm', 'Primitive077'}.issubset(exported)
assert not any('trough' in name for name in report['new_objects'])
streamer = report['streamer_ramp']
assert streamer['top'] == 'open'
assert not streamer['solid_floor'] and not streamer['solid_walls']
assert len(streamer['rail_profile_m']) == 4
assert len([n for n in report['new_objects'] if n.startswith('Party wire ramp | rail ')]) == 4
assert not any(n.startswith('Party streamer ramp') for n in report['new_objects'])
assert len([n for n in report['new_objects'] if 'underslung brace' in n]) == len(streamer['brace_indices'])
assert all(z <= -.003 for x,z in streamer['brace_profile_m'][1:3])
assert all(not bpy.data.objects.get(n) or bpy.data.objects[n].hide_render for n in ('Ramp012','Ramp013'))
assert bpy.data.objects['Party wire ramp | rail 1'].data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value == 1
assert len([name for name in report['new_objects'] if name.startswith('Party sling cover') and name.endswith('panel')]) == 2
for name in report['sling_covers']['source_visuals_hidden']:
    assert bpy.data.objects[name].hide_render, name
root = out.parents[1]
art = root/json.loads((root/'design/current-assets.json').read_text())['playfield_directory']/'finni-playfield-base.png'
playfield_images = [n.image for m in bpy.data.materials if m.use_nodes
                   for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image
                   and 'finni-playfield-base' in n.image.name and n.image.users]
assert playfield_images
for image in playfield_images:
    assert Path(bpy.path.abspath(image.filepath)).resolve() == art.resolve(), image.filepath
    assert image.packed_file and hashlib.sha256(image.packed_file.data).digest() == hashlib.sha256(art.read_bytes()).digest()
assert streamer['source_paths'] == ['Ramp013', 'Ramp012']
assert report['cake_scope'] == 'small round cake on original toy platform'
assert not bpy.data.objects['wallxxx007Top'].hide_render
assert bpy.data.objects['Party cake | vanilla sponge'].dimensions.x < .065
assert report['fox_reshaped'] is False
names = ['LilHead','LilLeftArm','LilRightArm','Primitive077']
with bpy.data.libraries.load(str(out/'finni-table-layout-source.blend'), link=False) as (data_from,data_to):
    data_to.objects = names.copy()
for source in data_to.objects:bpy.context.scene.collection.objects.link(source)
bpy.context.view_layer.update()
offset = Vector(report['fox_world_translation'])
for name, source in zip(names, data_to.objects):
    current = bpy.data.objects[name]
    assert len(current.data.vertices) == len(source.data.vertices)
    assert max(((current.matrix_world@a.co)-(source.matrix_world@b.co)-offset).length
               for a,b in zip(current.data.vertices,source.data.vertices)) < .0000001, name
for path in (root/'.work/deadpool-extracted/gameitems').glob('Kicker.*.json'):
    kicker = json.loads(path.read_text())['Kicker']
    if kicker['name'].lower() == 'lock':break
assert kicker['surface'] == 'Ramp012' and kicker['is_enabled']
lock_xy = (kicker['center']['x']*.00053975, -kicker['center']['y']*.00053975)
assert min(math.dist(p[:2], lock_xy) for p in streamer['centerline']) < .006
result = {'hidden_source_objects': len(report['hidden_source_objects']),
          'visible_replacement_meshes': len(report['new_objects']),
          'portable_export_contains_all_replacements': True,
          'geometry_finite': True, 'vpx_gameplay_tested': False,
          'current_texture_packed': True, 'streamer_ramp_matches_source_lock_route': True,
          'plain_triangular_sling_covers': True,
          'small_cake_and_original_platform_restored': True,
          'fox_matches_latest_saved_sculpture_without_deformation': True}
(out/'party-hardware-validation.json').write_text(json.dumps(result, indent=2))
print('PARTY_HARDWARE_VALID', json.dumps(result))
