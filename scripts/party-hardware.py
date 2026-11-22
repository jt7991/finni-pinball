"""Party replacements for the extracted table; called by render-vpx-concepts.

These are visual meshes. The source VPX collision objects are not changed.
"""
import bpy, math, json
from mathutils import Vector


def build_party_hardware(out, mat, forward, right):
    hidden = []
    created = []

    def hide(name):
        obj = bpy.data.objects.get(name)
        if obj:
            obj.hide_render = True
            obj.hide_set(True)
            hidden.append(name)

    def finish(obj, name, material):
        obj.name = name
        obj.data.materials.clear()
        obj.data.materials.append(material)
        for p in obj.data.polygons:
            p.use_smooth = True
        created.append(obj)
        return obj

    def sphere(name, pos, scale, material):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=24, location=pos)
        obj = bpy.context.object
        obj.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        return finish(obj, name, material)

    def cylinder(name, pos, radius, depth, material):
        bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=radius, depth=depth, location=pos)
        obj = finish(bpy.context.object, name, material)
        bevel = obj.modifiers.new('Soft molded edges', 'BEVEL')
        bevel.width = .0012
        bevel.segments = 3
        obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
        return obj

    def tube(name, points, radius, material):
        data = bpy.data.curves.new(name, 'CURVE')
        data.dimensions = '3D'
        data.bevel_depth = radius
        data.bevel_resolution = 3
        data.use_fill_caps = True
        spline = data.splines.new('POLY')
        spline.points.add(len(points)-1)
        for p, co in zip(spline.points, points):
            p.co = (*co, 1)
        obj = bpy.data.objects.new(name, data)
        bpy.context.scene.collection.objects.link(obj)
        data.materials.append(material)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')
        obj = bpy.context.object
        created.append(obj)
        return obj

    cream = mat('Party | vanilla frosting', 'FFF0CD', rough=.4)
    violet = mat('Party | lavender icing', 'AC93ED', rough=.36)
    peach = mat('Party | peach balloon', 'F6A45D', rough=.23)
    lilac = mat('Party | lilac balloon', 'A28AE8', rough=.23)
    mint = mat('Party | mint balloon', '8DCDB9', rough=.23)
    wire_metal = mat('Party | stainless ramp wire', 'DCE2E5', metal=1, rough=.24)

    # Simple rounded triangular covers over the existing three mounting posts.
    # The source sling walls, moving rubbers, switches and posts stay in place.
    for name in ('Wall138Top', 'Wall138Side', 'Wall039Top', 'Wall039Side'):
        hide(name)
    sling_layouts = {
        'left': [(172.75403, 1446.9797), (172.84, 1595.7), (241.92555, 1643.9072)],
        'right': [(693.9772, 1447.1729), (623.6932, 1643.9072), (693.66, 1595.82)],
    }
    sling_scale = .00053975
    sling_outlines = {}
    for side, posts in sling_layouts.items():
        corners = [Vector((x*sling_scale, -y*sling_scale)) for x, y in posts]
        outline = []
        for i, corner in enumerate(corners):
            previous = corner-corners[(i-1)%3]
            following = corners[(i+1)%3]-corner
            normal_a = Vector((previous.y, -previous.x)).normalized()
            normal_b = Vector((following.y, -following.x)).normalized()
            start = math.atan2(normal_a.y, normal_a.x)
            sweep = (math.atan2(normal_b.y, normal_b.x)-start) % math.tau
            for j in range(13):
                angle = start+sweep*j/12
                outline.append(corner+Vector((math.cos(angle), math.sin(angle)))*(.00053975*13))
        sling_outlines[side] = [list(p) for p in outline]
        count = len(outline)
        verts = [(p.x, p.y, height*sling_scale) for height in (52, 55) for p in outline]
        faces = [tuple(reversed(range(count))), tuple(range(count, count*2))]
        faces.extend((i, (i+1)%count, (i+1)%count+count, i+count) for i in range(count))
        mesh = bpy.data.meshes.new(f'Party sling cover | {side} mesh')
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(f'Party sling cover | {side} panel', mesh)
        bpy.context.scene.collection.objects.link(obj)
        finish(obj, obj.name, mint)
        for face in mesh.polygons:
            face.use_smooth = False
        bevel = obj.modifiers.new('Soft plastic edge', 'BEVEL')
        bevel.width = .00035
        bevel.segments = 2
        obj.modifiers.new('Flat cover normals', 'WEIGHTED_NORMAL')
        tube(f'Party sling cover | {side} cream rim',
             [(p.x, p.y, 55.15*sling_scale) for p in outline+[outline[0]]], .0005, cream)

    # Replace both layers of the star caps and the exposed red center domes.
    for obj in list(bpy.data.objects):
        if obj.name.lower().startswith('bumpertop'):
            hide(obj.name)
    for i, material in enumerate((peach, lilac, mint), 1):
        base = bpy.data.objects[f'Bumper{i}Base']
        x, y = base.matrix_world.translation.xy
        hide(base.name)
        cylinder(f'Party balloon support {i}', (x, y, .022), .011, .036, cream)
        socket = bpy.data.objects.get(f'Bumper{i}Socket')
        if socket:
            socket.data.materials.clear()
            socket.data.materials.append(violet)
        # Full crown and a drawn-in neck, readable from the playing camera.
        # The old flattened ellipsoid read as a round bumper cap.
        body = sphere(f'Party balloon {i}', (x, y+.004, .053), (.026, .036, .022), material)
        for vertex in body.data.vertices:
            along = vertex.co.y / .036
            taper = .82 + .22 * along
            vertex.co.x *= taper
            vertex.co.z *= taper
        body.data.update()
        sphere(f'Party balloon tied neck {i}', (x, y-.032, .053), (.0025, .0035, .0025), material)
        bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=.0015, radius2=.0045,
                                       depth=.006, location=(x, y-.037, .053),
                                       rotation=(math.pi/2, 0, 0))
        finish(bpy.context.object, f'Party balloon knot {i}', material)
        tube(f'Party balloon ribbon {i}',
             [(x+.004*math.sin(t*math.pi*2), y-.040-t*.025, .052-t*.009)
              for t in [j/40 for j in range(41)]], .0008, cream)

    # Remove blade silhouette, cutouts, sword guard and handle plastics.
    for name in ('Primitive042', 'Wall033Side', 'Wall033Top', 'Wall032Top',
                 'Wall034Side', 'Wall034Top', 'Wall035Side', 'Wall035Top', 'Ramp021',
                 'Ramp012', 'Ramp013'):
        hide(name)
    # Match the actual return and lock collision paths, including their heights.
    root = out.parents[1]
    ramps = {}
    for path in (root/'.work/deadpool-extracted/gameitems').glob('Ramp.*.json'):
        data = json.loads(path.read_text())['Ramp']
        if data['name'] in {'Ramp012', 'Ramp013'}:ramps[data['name']] = data
    points = []
    scale = .00053975
    for name in ('Ramp013', 'Ramp012'):
        ramp = ramps[name]
        drag = ramp['drag_points']
        for i, p in enumerate(drag):
            height = ramp['height_bottom']+(ramp['height_top']-ramp['height_bottom'])*i/(len(drag)-1)
            v = Vector((p['x']*scale, -p['y']*scale, height*scale))
            if not points or (points[-1]-v).length > .00001:points.append(v)
    centers = []
    for i in range(len(points)-1):
        a,b,c,d = points[max(0,i-1)],points[i],points[i+1],points[min(len(points)-1,i+2)]
        for j in range(12):
            t=j/12
            centers.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    centers.append(points[-1])
    sides = []
    for i in range(len(centers)):
        tangent = centers[min(len(centers)-1, i+1)]-centers[max(0, i-1)]
        sides.append(Vector((tangent.y, -tangent.x, 0)).normalized())
    # Open four-wire return following the exact existing collision route.
    # Lower rails support the ball visually; raised outer rails and sparse
    # underslung U braces leave the printed scene visible through the channel.
    half_width = ramps['Ramp013']['width_bottom']*scale/2
    rail_profile = [(-.0075, -.0011), (.0075, -.0011),
                    (-half_width, .012), (half_width, .012)]
    for index, (x, z) in enumerate(rail_profile):
        tube(f'Party wire ramp | rail {index+1}',
             [c+s*x+Vector((0,0,z)) for c,s in zip(centers,sides)], .0011, wire_metal)
    brace_indices = [0]
    distance = 0.
    for i in range(1, len(centers)):
        distance += (centers[i]-centers[i-1]).length
        if distance >= .055:
            brace_indices.append(i)
            distance = 0.
    if brace_indices[-1] != len(centers)-1:
        brace_indices.append(len(centers)-1)
    brace_profile = [(-half_width, .012), (-half_width, -.003),
                     (half_width, -.003), (half_width, .012)]
    for number, i in enumerate(brace_indices):
        tube(f'Party wire ramp | underslung brace {number:02}',
             [centers[i]+sides[i]*x+Vector((0,0,z)) for x,z in brace_profile],
             .0008, wire_metal)

    # Preserve the latest saved fox sculpture exactly; only raise it onto the cake.
    toy_names = {'LilHead', 'LilLeftArm', 'LilRightArm', 'Primitive077'}
    for name in toy_names:
        obj = bpy.data.objects[name]
        inverse = obj.matrix_world.inverted()
        offset = inverse.to_3x3() @ Vector((0, 0, .0215))
        for vertex in obj.data.vertices:vertex.co += offset
        obj.data.update()
    center = Vector((.337, -.365, 0))
    cylinder('Party cake | plate', center+Vector((0, 0, .034)), .036, .0025, violet)
    cylinder('Party cake | vanilla sponge', center+Vector((0, 0, .044)), .032, .019, cream)
    cylinder('Party cake | lavender frosting', center+Vector((0, 0, .053)), .033, .004, violet)
    for i in range(24):
        a = i*math.tau/24
        p = center+Vector((math.cos(a)*.031, math.sin(a)*.031, .051))
        sphere(f'Party cake | icing drip {i:02}', p, (.003, .003, .0035+(i%3)*.001), violet)
        p.z = .0365
        sphere(f'Party cake | piped pearl {i:02}', p, (.0024, .0024, .0024), cream)
    for i in range(18):
        a = i*math.tau/18
        p = center+Vector((math.cos(a)*.0322, math.sin(a)*.0322, .044))
        sphere(f'Party cake | confetti {i:02}', p, (.0009, .0009, .0016), (peach, lilac, mint)[i%3])

    # Export a portable set of the replacement geometry as well as the scene.
    print('PARTY_GEOMETRY_COMPLETE',len(created),flush=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in created:
        obj.select_set(True)
    for name in toy_names:
        bpy.data.objects[name].select_set(True)
    bpy.context.view_layer.objects.active = bpy.data.objects['LilHead']
    bpy.ops.export_scene.gltf(filepath=str(out/'finni-party-hardware.glb'),
                              export_format='GLB', use_selection=True)
    cake_names = {o.name for o in created if o.name.startswith('Party cake')}
    (out/'party-hardware-report.json').write_text(json.dumps({
        'hidden_source_objects': hidden, 'new_objects': [o.name for o in created],
        'balloons': 3, 'fox_pose': 'original saved sculpture, raised onto small cake',
        'sling_covers': {'count': 2, 'shape': 'three straight edges with rounded corners',
                        'source_visuals_hidden': ['Wall138Top', 'Wall138Side', 'Wall039Top', 'Wall039Side'],
                        'mounting_posts_vpx': sling_layouts, 'outlines_m': sling_outlines,
                        'collision_and_animation': 'original sling walls and moving rubbers retained'},
        'cake_scope': 'small round cake on original toy platform',
        'fox_source': 'finni-table-layout-source.blend; latest short-muzzle / flat-nose revision',
        'fox_world_translation': [0, 0, .0215],
        'fox_reshaped': False,
        'streamer_ramp': {'source_paths': ['Ramp013', 'Ramp012'],
                          'centerline': [list(p) for p in centers],
                          'construction': 'open stainless four-wire ramp',
                          'rail_profile_m': rail_profile, 'rail_radius_m': .0011,
                          'brace_indices': brace_indices, 'brace_profile_m': brace_profile,
                          'brace_radius_m': .0008, 'top': 'open',
                          'solid_floor': False, 'solid_walls': False},
        'scope': 'visual asset replacements; VPX collisions unchanged',
        'lock': {'shot': 'right ramp', 'implementation': 'source VPX virtual lock',
                 'kicker': 'lock', 'collision_surface': 'Ramp012',
                 'preserved': ['Lock_Hit', 'ExitLock', 'BallsInLock', 'multiball qualification and release']},
    }, indent=2))
    return hidden, cake_names
