import assert from 'node:assert/strict';
import {startTable} from '../browser/renderer.js';

const descriptor=Object.getOwnPropertyDescriptor(globalThis,'devicePixelRatio');
try{
  Object.defineProperty(globalThis,'devicePixelRatio',{configurable:true,value:2.625});
  const before=Object.getOwnPropertyDescriptor(globalThis,'devicePixelRatio');
  const getContext=()=>null,canvas=Object.create({getContext});
  const engine={canvas,finniRenderDensity:1.5,ccall(...args){
    assert.equal(globalThis.devicePixelRatio,1.5);
    assert.equal(canvas.getContext('webgl2'),null);
    assert.deepEqual(args,['vpinball_wasm_start','number',['string'],['/tables/test.vpx']]);
    return 1;
  }};
  assert.equal(startTable(engine,'/tables/test.vpx'),1);
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'devicePixelRatio'),before);
  assert.equal(canvas.getContext,getContext);
  assert.equal(Object.hasOwn(canvas,'getContext'),false);
  engine.ccall=()=>{assert.equal(globalThis.devicePixelRatio,1.5);throw Error('Native startup failed')};
  assert.throws(()=>startTable(engine,'/tables/test.vpx'),/Native startup failed/);
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'devicePixelRatio'),before);
  assert.equal(canvas.getContext,getContext);
  console.log('PASS: SDL startup sees the render budget; real browser density is restored on success and failure.');
}finally{
  if(descriptor)Object.defineProperty(globalThis,'devicePixelRatio',descriptor);
  else delete globalThis.devicePixelRatio;
}
