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
    streamer_peach = mat('Party | streamer peach', 'F5B18E', rough=.36)
    streamer_lilac = mat('Party | streamer lilac', 'AC93ED', rough=.36)

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
        # Rounded teardrop, knot and short ribbon: a balloon above each pop ring.
        sphere(f'Party balloon {i}', (x, y, .050), (.026, .029, .016), material)
        bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=.004, radius2=.0015,
                                       depth=.005, location=(x, y-.028, .048),
                                       rotation=(math.pi/2, 0, 0))
        finish(bpy.context.object, f'Party balloon knot {i}', material)
        tube(f'Party balloon ribbon {i}',
             [(x+.003*math.sin(t*math.pi*2), y-.030-t*.014, .044) for t in [j/24 for j in range(25)]],
             .00065, cream)

    # Remove blade silhouette, cutouts, sword guard and handle plastics.
    for name in ('Primitive042', 'Wall033Side', 'Wall033Top', 'Wall032Top',
                 'Wall034Side', 'Wall034Top', 'Wall035Side', 'Wall035Top', 'Ramp021'):
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
    # Ribbon-shaped open chute: source collision floor is z=0 here. Keep the
    # visible floor just below it, with the tall wall on cabinet-right (+X).
    half_width = ramps['Ramp013']['width_bottom']*scale/2
    profile = [(-half_width, .005), (-half_width, -.0004),
               (half_width, -.0004), (half_width+.001, .004),
               (half_width+.001, .025)]

    def ribbon_mesh(name, rows, materials, band_materials):
        width = len(rows[0])
        mesh = bpy.data.meshes.new(name+' mesh')
        mesh.from_pydata([tuple(p) for row in rows for p in row], [],
                         [(i*width+j, (i+1)*width+j, (i+1)*width+j+1, i*width+j+1)
                          for i in range(len(rows)-1) for j in range(width-1)])
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        finish(obj, name, materials[0])
        for material in materials[1:]:mesh.materials.append(material)
        for face in mesh.polygons:face.material_index = band_materials[face.index % (width-1)]
        shell = obj.modifiers.new('Molded ribbon thickness', 'SOLIDIFY')
        shell.thickness = .0008
        shell.offset = -1
        bevel = obj.modifiers.new('Rounded ribbon edges', 'BEVEL')
        bevel.width = .00035
        bevel.segments = 3
        return obj

    ribbon_mesh('Party streamer ramp | peach chute and tall right wall',
                [[c+s*x+Vector((0, 0, z)) for x,z in profile] for c,s in zip(centers,sides)],
                [streamer_peach, streamer_lilac], [0, 0, 1, 1])
    for index, label in ((0, 'low inner lip'), (-1, 'tall right wall')):
        x,z = profile[index]
        tube(f'Party streamer ramp | cream {label} edge',
             [c+s*x+Vector((0, 0, z)) for c,s in zip(centers,sides)], .00065, cream)

    # Decorative curl beyond the outside wall, never across the ball channel.
    curl_origin = centers[-1]+sides[-1]*(half_width+.001)+Vector((0,0,.025))
    tangent = (centers[-1]-centers[-2]).normalized()
    curl_rows = []
    for i in range(97):
        angle = math.tau*1.15*i/96
        radius = .013*(1-.60*i/96)
        p = curl_origin+tangent*(radius*math.sin(angle))+Vector((0,0,.013-radius*math.cos(angle)))
        curl_rows.append([p, p+sides[-1]*.006])
    ribbon_mesh('Party streamer ramp | curled outer ribbon tail', curl_rows,
                [streamer_lilac], [0])
    for j in (0, 1):
        tube(f'Party streamer ramp | curl cream edge {j}',
             [row[j] for row in curl_rows], .0005, cream)

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
                          'profile_m': profile, 'top': 'open',
                          'right_wall_height_m': .025, 'inner_lip_height_m': .005,
                          'curl_outside_channel': True},
        'scope': 'visual asset replacements; VPX collisions unchanged',
        'lock': {'shot': 'right ramp', 'implementation': 'source VPX virtual lock',
                 'kicker': 'lock', 'collision_surface': 'Ramp012',
                 'preserved': ['Lock_Hit', 'ExitLock', 'BallsInLock', 'multiball qualification and release']},
    }, indent=2))
    return hidden, cake_names
