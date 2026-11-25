import test from 'node:test';
import assert from 'node:assert/strict';
import {backdropStateReader} from '../backdrop-state-reader.js';

function context(){
  const clone=v=>Array.isArray(v)||ArrayBuffer.isView(v)?v.slice():v;
  const gl={VIEWPORT:2978,COLOR_WRITEMASK:3107,DEPTH_WRITEMASK:2930,DEPTH_FUNC:2932,DEPTH_RANGE:2928,ACTIVE_TEXTURE:34016,MAX_VIEWPORT_DIMS:3386,MAX_COMBINED_TEXTURE_IMAGE_UNITS:35661,TEXTURE0:33984,CURRENT_PROGRAM:35725,NEVER:512,ALWAYS:519,BLEND:3042,DEPTH_TEST:2929,CULL_FACE:2884,SCISSOR_TEST:3089,STENCIL_TEST:2960,POLYGON_OFFSET_FILL:32823,RASTERIZER_DISCARD:35977,DITHER:3024,SAMPLE_ALPHA_TO_COVERAGE:32926,SAMPLE_COVERAGE:32928,
    values:new Map(),enabled:new Set(),errors:[],reads:[],events:new Map(),lost:false,
    canvas:{addEventListener(name,callback){gl.events.set(name,callback);}},
    getParameter(key){this.reads.push(key);return this.lost?null:clone(this.values.get(key));},
    isEnabled(cap){this.reads.push('enabled:'+cap);return !this.lost&&this.enabled.has(cap);},
    viewport(x,y,w,h){if(this.lost)return;[x,y,w,h]=[x,y,w,h].map(v=>Number(v)|0);if(w<0||h<0){this.errors.push('INVALID_VALUE');return;}this.values.set(this.VIEWPORT,new Int32Array([x,y,Math.min(w,4096),Math.min(h,4096)]));},
    colorMask(...values){if(!this.lost)this.values.set(this.COLOR_WRITEMASK,values.map(Boolean));},
    depthMask(value){if(!this.lost)this.values.set(this.DEPTH_WRITEMASK,!!value);},
    depthFunc(value){if(this.lost)return;value=Number(value)>>>0;if(value<512||value>519){this.errors.push('INVALID_ENUM');return;}this.values.set(this.DEPTH_FUNC,value);},
    depthRange(near,far){if(this.lost)return;near=Number(near);far=Number(far);if(near>far){this.errors.push('INVALID_OPERATION');return;}this.values.set(this.DEPTH_RANGE,new Float32Array([near,far].map(v=>Math.max(0,Math.min(1,v)))));},
    activeTexture(value){if(this.lost)return;value=Number(value)>>>0;if(value<this.TEXTURE0||value>=this.TEXTURE0+16){this.errors.push('INVALID_ENUM');return;}this.values.set(this.ACTIVE_TEXTURE,value);},
    enable(cap){if(!this.lost)this.enabled.add(Number(cap)>>>0);},disable(cap){if(!this.lost)this.enabled.delete(Number(cap)>>>0);},
  };
  for(const [key,value]of [[gl.VIEWPORT,new Int32Array([0,0,640,480])],[gl.COLOR_WRITEMASK,[true,true,true,true]],[gl.DEPTH_WRITEMASK,true],[gl.DEPTH_FUNC,513],[gl.DEPTH_RANGE,new Float32Array([0,1])],[gl.ACTIVE_TEXTURE,gl.TEXTURE0],[gl.MAX_VIEWPORT_DIMS,new Int32Array([4096,4096])],[gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS,16],[gl.CURRENT_PROGRAM,{}]])gl.values.set(key,value);
  return gl;
}

test('observed scalar writes avoid repeat GL queries and snapshot arrays stay independent',()=>{
  const gl=context(),reader=backdropStateReader(gl);assert.equal(backdropStateReader(gl),reader);
  gl.viewport(2,3,120,240);gl.colorMask(false,true,false,true);gl.depthMask(false);gl.depthFunc(gl.ALWAYS);gl.depthRange(.1,.9);gl.activeTexture(gl.TEXTURE0+7);gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);
  const fields=[gl.VIEWPORT,gl.COLOR_WRITEMASK,gl.DEPTH_WRITEMASK,gl.DEPTH_FUNC,gl.DEPTH_RANGE,gl.ACTIVE_TEXTURE],before=gl.reads.length;
  for(let i=0;i<20;i++)for(const field of fields)assert.deepEqual(reader.getParameter(field),gl.values.get(field));
  for(let i=0;i<20;i++){assert.equal(reader.isEnabled(gl.BLEND),false);assert.equal(reader.isEnabled(gl.DEPTH_TEST),true);}
  assert.equal(gl.reads.length,before,'normal repeated copy state reads require no GL queries');
  const snapshot=reader.getParameter(gl.VIEWPORT);gl.viewport(0,0,2,2);assert.deepEqual([...snapshot],[2,3,120,240]);snapshot[0]=999;assert.deepEqual([...reader.getParameter(gl.VIEWPORT)],[0,0,2,2]);
  const program=gl.values.get(gl.CURRENT_PROGRAM);assert.equal(reader.getParameter(gl.CURRENT_PROGRAM),program);assert.equal(reader.getParameter(gl.CURRENT_PROGRAM),program);assert.equal(gl.reads.length,before+2,'resource bindings are always queried');
});

test('uncertain or invalid writes re-query GL without clearing errors or assuming coercion',()=>{
  const gl=context(),reader=backdropStateReader(gl);
  for(const [write,key]of [[()=>gl.viewport(0,0,-1,2),gl.VIEWPORT],[()=>gl.viewport(0,0,8192,3),gl.VIEWPORT],[()=>gl.viewport(.5,1.5,4.5,8.5),gl.VIEWPORT],[()=>gl.depthFunc(999),gl.DEPTH_FUNC],[()=>gl.depthRange(-1,2),gl.DEPTH_RANGE],[()=>gl.depthRange(.8,.2),gl.DEPTH_RANGE],[()=>gl.activeTexture(gl.TEXTURE0+99),gl.ACTIVE_TEXTURE]]){
    reader.getParameter(key);write();const before=gl.reads.length;assert.deepEqual(reader.getParameter(key),gl.values.get(key));assert.equal(gl.reads.length,before+1);
  }
  assert.equal(gl.errors.length,4,'invalid GL calls still leave their errors pending');
  gl.disable(gl.BLEND);reader.isEnabled(gl.BLEND);gl.enable(String(gl.BLEND));const before=gl.reads.length;assert.equal(reader.isEnabled(gl.BLEND),true);assert.equal(gl.reads.length,before+1);
});

test('context loss and cross-context setter calls invalidate cached scalar observations',()=>{
  const a=context(),b=context(),ra=backdropStateReader(a),rb=backdropStateReader(b);
  ra.getParameter(a.VIEWPORT);rb.getParameter(b.VIEWPORT);
  a.viewport.call(b,2,4,6,8);assert.deepEqual([...rb.getParameter(b.VIEWPORT)],[2,4,6,8]);assert.deepEqual([...ra.getParameter(a.VIEWPORT)],[0,0,640,480]);
  a.lost=true;a.events.get('webglcontextlost')();a.viewport(0,0,2,2);assert.equal(ra.getParameter(a.VIEWPORT),null);
  a.lost=false;a.values.set(a.VIEWPORT,new Int32Array([1,3,5,7]));a.events.get('webglcontextrestored')();assert.deepEqual([...ra.getParameter(a.VIEWPORT)],[1,3,5,7]);
});
