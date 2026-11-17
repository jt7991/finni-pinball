"""Save a compact standalone fox .blend with the original template retained."""
import bpy
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root/'output/vpx-v1'
bpy.ops.wm.open_mainfile(filepath=str(out/'finni-fox-source-fit.blend'))
names={'LilHead','LilLeftArm','LilRightArm','Primitive077','Presentation ground','Finni camera'}
for obj in list(bpy.data.objects):
    if obj.name not in names and not obj.name.startswith(('REFERENCE_', 'Party cake')) and obj.type!='LIGHT':
        bpy.data.objects.remove(obj,do_unlink=True)
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'finni-fox.blend'))
print('STANDALONE_FOX_SAVED')
