import bpy,json,math
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'output/game-preview'
bpy.ops.wm.open_mainfile(filepath=str(out/'finni-game-preview.blend'))
scene=bpy.context.scene
assert scene.frame_end==400 and scene.render.fps==20
names=['LilHead','LilLeftArm','LilRightArm']
scene.frame_set(280)
rest={name:bpy.data.objects[name].rotation_euler.copy() for name in names}
body=bpy.data.objects['Primitive077'].matrix_world.copy()
for frame in (303,353):
    scene.frame_set(frame)
    for name in names:
        assert max(abs(a-b) for a,b in zip(rest[name],bpy.data.objects[name].rotation_euler))>.05,name
    assert bpy.data.objects['Primitive077'].matrix_world==body
scene.frame_set(301)
ball=bpy.data.objects['Preview ball 1']
assert abs(ball.location.x-.326)<.00001 and abs(ball.location.y+.387)<.00001
scene.frame_set(400)
for name in names:
    assert max(abs(a-b) for a,b in zip(rest[name],bpy.data.objects[name].rotation_euler))<.01,name
scene.frame_set(303)
scene.render.engine='CYCLES';scene.cycles.samples=12
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(out/'fox-bobble-closeup.png')
bpy.ops.render.render(write_still=True)
(out/'animation-validation.json').write_text(json.dumps({'seconds':20,'target_hits':[15,17.5],
    'head_and_both_arms_bobble':True,'body_static':True,'damped_settling':True,
    'source_trigger':'Target012_Hit -> LilDPShake 5','type':'scripted approximation'},indent=2))
print('BOBBLE_ANIMATION_VALID',flush=True)
