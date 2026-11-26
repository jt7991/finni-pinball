// SPDX-License-Identifier: GPL-3.0-or-later
// One synchronous candidate search shares mesh status. Registration supplies
// a stable mesh index; begin again for every ball/substep and after events.
export class NativeQueryStatus {
  constructor(){this.revision=0;this.revisions=[];this.values=[];}
  begin(){
    if(this.revision===Number.MAX_SAFE_INTEGER){this.revisions.length=0;this.revision=1;}
    else this.revision++;
  }
  enabled(mesh,index){
    if(index===undefined)return mesh.collider.isEnabled();
    if(this.revisions[index]!==this.revision){
      // A failed backend read must remain uncached, so stamp only on success.
      const enabled=mesh.collider.isEnabled();
      this.values[index]=enabled;this.revisions[index]=this.revision;
    }
    return this.values[index];
  }
}
