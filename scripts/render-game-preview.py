"""Render the scripted preview with real-time shading for a short review clip."""
import bpy,sys
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'output/game-preview'
bpy.ops.wm.open_mainfile(filepath=str(out/'finni-game-preview.blend'))
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE_NEXT'
scene.eevee.taa_render_samples=16;scene.eevee.use_raytracing=False
for obj in bpy.data.objects:
    if obj.type=='LIGHT' and obj.name.startswith(('Preview GI','Preview bumper','Preview celebration')):obj.data.use_shadow=False
scene.render.resolution_x=480;scene.render.resolution_y=810
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(out/'lighting-preview-eevee.png')
if '--movie' not in sys.argv:
    bpy.ops.render.render(write_still=True)
else:
    scene.render.image_settings.file_format='FFMPEG'
    scene.render.ffmpeg.format='MPEG4';scene.render.ffmpeg.codec='H264'
    scene.render.ffmpeg.constant_rate_factor='MEDIUM';scene.render.ffmpeg.ffmpeg_preset='GOOD'
    scene.render.ffmpeg.audio_codec='AAC';scene.render.ffmpeg.audio_bitrate=128
    editor=scene.sequence_editor_create()
    events=[(0,'fx_plunger.wav'),(2.8,'fx_flipperup.wav'),(2.95,'fx_flipperdown.wav'),
            (5.5,'fx_flipperup.wav'),(5.65,'fx_flipperdown.wav'),
            (6.65,'fx_kicker_enter.wav'),(7.5,'fx_kicker.wav'),(8.9,'fx_flipperup.wav')]
    events += [(t,'fx_bumper.wav') for t in (9.3,9.6,10,11.6,12,12.5,13.1)]
    events += [(t,'fx_flipperup.wav') for t in (10.6,11.1,12.7,13.65)]
    events += [(15,'fx_target.wav'),(17.5,'fx_target.wav')]
    for channel,(t,filename) in enumerate(events,1):
        strip=editor.strips.new_sound('Preview '+filename,str(out.parents[1]/'.work/deadpool-extracted/sounds'/filename),channel=channel,frame_start=int(t*20)+1)
        strip.volume=.45
    if '--test' in sys.argv:scene.frame_end=3
    scene.render.filepath=str(out/'finni-game-preview.mp4')
    bpy.ops.render.render(animation=True)
print('PREVIEW_RENDER_COMPLETE',flush=True)
