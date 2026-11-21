// SPDX-License-Identifier: GPL-3.0-or-later
// Scalar HitQuadtree construction and traversal, Visual Pinball contributors,
// 195f214dd4849b8ef6113fd377258b78d0dec3bf, physics/quadtree.cpp.
// The pinned Emscripten wasm32 build does not enable the x86/ARM SSE path.
// See public/licenses/VPX-Physics-NOTICE.txt.
import {f} from './native-vector.js';
import {nativeBoundsOverlap} from './native-mesh-contact.js';

export class NativeTree {
  constructor(entries,bounds){
    this.entries=[...entries];this.nodesUsed=0;this.nodeCapacity=(entries.length*2+1)&~3;this.levels=0;
    this.root=this.build(0,entries.length,bounds,0,0);
  }
  build(start,count,bounds,level,emptyLevels){
    const node={start,count,children:null};this.levels=Math.max(this.levels,level);
    if(count<=4||level===127||this.nodesUsed+3>=this.nodeCapacity)return node;
    this.nodesUsed+=4;
    const x=f(f(bounds.left+bounds.right)*.5),y=f(f(bounds.top+bounds.bottom)*.5),groups=[[],[],[],[]],local=[];
    node.x=x;node.y=y;
    for(let i=start;i<start+count;i++){
      const entry=this.entries[i],b=entry.bounds;
      let octant=b.left>x?1:b.right<x?0:128;
      octant|=b.top>y?2:b.bottom<y?0:128;
      if(octant<4)groups[octant].push(entry);else local.push(entry);
    }
    // Native fills the lower two temporary partitions from their end.
    groups[2].reverse();groups[3].reverse();
    let write=start;for(const group of [local,...groups])for(const entry of group)this.entries[write++]=entry;
    node.count=local.length;
    const empty=(local.length===0?1:0)+groups.filter(group=>group.length===0).length;
    emptyLevels=empty>=4?emptyLevels+1:0;
    let next=start+local.length;
    node.children=groups.map((group,index)=>{
      const childBounds={left:index&1?x:bounds.left,right:index&1?bounds.right:x,top:index&2?y:bounds.top,bottom:index&2?bounds.bottom:y};
      const child=f(x-bounds.left)>f(.0001)&&emptyLevels<=8&&level+1<42?
        this.build(next,group.length,childBounds,level+1,emptyLevels):{start:next,count:group.length,children:null};
      next+=group.length;return child;
    });
    return node;
  }
  query(query,visit,frameCache){
    // Physics keeps this AABB fixed through a 1ms frame while the sphere center
    // changes at impacts. Reuse only the ordered AABB candidates; run the native
    // sphere test again at every query, including zero-time collisions.
    if(frameCache){
      if(frameCache.tree!==this||frameCache.box!==query.box){
        const box=query.box,region=frameCache.region;
        if(frameCache.tree!==this||!region||box.left<region.left||box.right>region.right||box.top<region.top||box.bottom>region.bottom||box.low<region.low||box.high>region.high){
          // Broad candidates may survive several frames. The enlarged box only
          // selects a superset: every new frame still applies its exact native
          // AABB, and every collision query still applies its exact sphere.
          const margin=32,bounds=frameCache.region={left:box.left-margin,right:box.right+margin,top:box.top-margin,bottom:box.bottom+margin,low:box.low-margin,high:box.high+margin};
          const broad=frameCache.broad??=[];broad.length=0;
          const collect=node=>{
            for(let i=node.start;i<node.start+node.count;i++){
              const entry=this.entries[i],b=entry.bounds;
              if(!(bounds.right<b.left||bounds.left>b.right||bounds.bottom<b.top||bounds.top>b.bottom||bounds.high<b.low||bounds.low>b.high))broad.push(entry);
            }
            if(!node.children)return;
            const left=bounds.left<=node.x,right=bounds.right>=node.x;
            if(bounds.top<=node.y){if(left)collect(node.children[0]);if(right)collect(node.children[1]);}
            if(bounds.bottom>=node.y){if(left)collect(node.children[2]);if(right)collect(node.children[3]);}
          };collect(this.root);
        }
        frameCache.tree=this;frameCache.box=box;
        const candidates=frameCache.entries??=[];candidates.length=0;
        for(const entry of frameCache.broad){const b=entry.bounds;if(!(box.right<b.left||box.left>b.right||box.bottom<b.top||box.top>b.bottom||box.high<b.low||box.low>b.high))candidates.push(entry);}
      }
      for(const entry of frameCache.entries)if(nativeBoundsOverlap(entry.bounds,query,true))visit(entry);
      return;
    }
    const box=query.box,walk=node=>{
      for(let i=node.start;i<node.start+node.count;i++){
        const entry=this.entries[i];if(nativeBoundsOverlap(entry.bounds,query))visit(entry);
      }
      if(!node.children)return;
      const left=box.left<=node.x,right=box.right>=node.x;
      if(box.top<=node.y){if(left)walk(node.children[0]);if(right)walk(node.children[1]);}
      if(box.bottom>=node.y){if(left)walk(node.children[2]);if(right)walk(node.children[3]);}
    };
    walk(this.root);
  }
}
