// SPDX-License-Identifier: GPL-3.0-or-later
// Scalar HitKD, Visual Pinball contributors, revision
// 195f214dd4849b8ef6113fd377258b78d0dec3bf, physics/kdtree.cpp.
// See public/licenses/VPX-Physics-NOTICE.txt.
import {f} from './native-vector.js';
import {nativeBoundsOverlap} from './native-mesh-contact.js';
const keys=[['left','right'],['top','bottom'],['low','high']];
export class NativeDynamicTree {
  constructor(){this.maximum=0;this.entries=[];}
  update(records,query){
    this.entries=records.map(record=>({record,bounds:query(record).box}));this.rebuild();
  }
  sync(records,query){
    if(records.length===this.order.length&&records.every((r,i)=>r===this.order[i]))return;
    const old=new Map(this.entries.map(e=>[e.record,e.bounds]));this.entries=records.map(record=>({record,bounds:old.get(record)??query(record).box}));this.rebuild();
  }
  rebuild(){
    this.order=this.entries.map(e=>e.record);this.maximum=Math.max(this.maximum,this.entries.length);this.capacity=(this.maximum*2+1)&~1;this.used=0;
    const bounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity,low:Infinity,high:-Infinity};
    for(const {bounds:b}of this.entries)for(const [low,high]of keys){bounds[low]=Math.min(bounds[low],b[low]);bounds[high]=Math.max(bounds[high],b[high]);}
    this.root=this.build(0,this.entries.length,bounds,0,0);
  }
  build(start,count,bounds,level,empty){
    const node={start,count,bounds,children:null};if(count<=4||level>=64)return node;
    const d=keys.map(([low,high])=>f(bounds[high]-bounds[low])),axis=d[0]>d[1]&&d[0]>d[2]?0:d[1]>d[2]?1:2;
    if(d[axis]<f(.0001)||this.used+1>=this.capacity)return node;this.used+=2;
    const [low,high]=keys[axis],center=f(f(bounds[low]+bounds[high])*.5),groups=[[],[],[]];
    for(let i=start;i<start+count;i++){const e=this.entries[i];groups[e.bounds[high]<center?1:e.bounds[low]>center?2:0].push(e);}
    empty=groups.filter(g=>g.length===0).length>=2?empty+1:0;if(empty>8){this.used-=2;return node;}
    let at=start;for(const group of groups)for(const e of group)this.entries[at++]=e;
    node.count=groups[0].length;node.axis=axis;node.center=center;at=start+node.count;
    node.children=groups.slice(1).map((group,i)=>{const b={...bounds,[i?low:high]:center},child=this.build(at,group.length,b,level+1,empty);at+=group.length;return child;});return node;
  }
  query(query,record,visit){
    const walk=node=>{
      for(let i=node.start;i<node.start+node.count;i++){const e=this.entries[i];if(e.record!==record&&!e.record.removed&&nativeBoundsOverlap(e.bounds,query,true))visit(e.record);}
      if(!node.children)return;const [low,high]=keys[node.axis];
      if(query.box[low]<=node.center)walk(node.children[0]);if(query.box[high]>=node.center)walk(node.children[1]);
    };walk(this.root);
  }
}
