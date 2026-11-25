// Isolated original Spinner::UpdatePlate and Gate::Render vertex routines.
// The spinner receives its supported explicit output pointer. For the gate,
// only GPU Lock/Unlock and DrawMesh are scratch-buffer/no-op stubs; all matrix,
// trigonometry and vertex-loop instructions remain original.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export async function nativeMoverVertices(){
  const bytes=fs.readFileSync('.work/three-review/reference-engine.wasm'),sha=x=>createHash('sha256').update(x).digest('hex');
  const engineSHA256=sha(bytes);assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  const functions={spinner:4116,gate:3051},gpuStubs={lock:4582,unlock:4575,draw:4681},hashes={};
  const imported=WebAssembly.Module.imports(new WebAssembly.Module(bytes)).length;let p=8;
  const u=()=>{let n=0,s=0,b;do{b=bytes[p++];n+=(b&127)*2**s;s+=7;}while(b&128);return n;};
  const leb=n=>{const out=[];do{let b=n&127;n>>>=7;if(n)b|=128;out.push(b);}while(n);return Buffer.from(out);};
  const str=s=>Buffer.concat([leb(s.length),Buffer.from(s)]),section=(kind,b)=>Buffer.concat([Buffer.from([kind]),leb(b.length),b]),parts=[bytes.subarray(0,8)];
  while(p<bytes.length){const begin=p,kind=bytes[p++],size=u(),end=p+size;assert.notEqual(kind,8);
    if(kind===7){const count=u();parts.push(section(7,Buffer.concat([leb(count+2),bytes.subarray(p,end),...Object.entries(functions).flatMap(([name,index])=>[str('ref_'+name),Buffer.from([0]),leb(index)])])));}
    else if(kind===10){const count=u(),bodies=[leb(count)];for(let i=0;i<count;i++){const size=u(),body=bytes.subarray(p,p+size),index=i+imported;p+=size;if([...Object.values(functions),...Object.values(gpuStubs)].includes(index))hashes[index]=sha(body);
      const replacement=index===gpuStubs.lock?Buffer.from([0,32,1,32,0,40,2,32,54,2,0,11]):[gpuStubs.unlock,gpuStubs.draw].includes(index)?Buffer.from([0,11]):body;
      bodies.push(leb(replacement.length),replacement);
    }parts.push(section(10,Buffer.concat(bodies)));}
    else parts.push(bytes.subarray(begin,end));p=end;
  }
  assert.deepEqual(hashes,{'3051':'36d0348811ac39bc7955c1178f6f199b53dba3b1b573a939d2312a3a53ca9521','4116':'3cfb1f53edd8269eb306a417674ff23a06a92ca4322db149e2b21c3d45f69b20','4575':'49e9713f1745064db29d886fd1ebcf1ff3598b2ec7e12804f1c498f66d9f6126','4582':'6d6a69601ae2fc3c3ada176e5430a5d0fb16d5afe925110c569d63ad66b33c88','4681':'d840aa1cec2f99b7dd08e97fb598522884f1af7be23ff0b609eb1e7324ba60a9'});
  const module=new WebAssembly.Module(Buffer.concat(parts)),imports={};for(const item of WebAssembly.Module.imports(module)){assert.equal(item.kind,'function');(imports[item.module]??={})[item.name]=()=>{throw Error('Unexpected mover vertex import '+item.name);};}
  const {exports:n}=await WebAssembly.instantiate(module,imports),base=64*1024*1024;
  if(n.memory.buffer.byteLength<base+98304)n.memory.grow(Math.ceil((base+98304-n.memory.buffer.byteLength)/65536));
  const v=new DataView(n.memory.buffer),fp=(at,value)=>v.setFloat32(at,value,true),ptr=(at,value)=>v.setUint32(at,value,true);
  const spinner=base,spinnerHit=base+4096,spinnerOutput=base+8192,gate=base+16384,gateHit=base+20480,gateOutput=base+24576,renderer=base+32768,device=base+40960,mesh=base+49152,buffer=base+53248,templateAt=base+57344,indexBuffer=base+65536;
  return {engineSHA256,functions,gpuStubs,hashes,spinnerTemplate:()=>new Float32Array(n.memory.buffer,1382464,228*8).slice(),
    reset(kind,spec,template,surface=0){
      if(kind==='spinner'){
        ptr(spinner+404,spinnerHit);fp(spinner+412,NaN);fp(spinner+264,spec.center.x);fp(spinner+268,spec.center.y);fp(spinner+272,spec.length);fp(spinner+276,spec.rotation);fp(spinner+400,Math.fround(Math.fround(spec.height)+Math.fround(surface)));
      }else{
        assert.equal(kind,'gate');assert.equal(template.length,186*8);
        fp(gate+264,spec.center.x);fp(gate+268,spec.center.y);fp(gate+272,spec.length);fp(gate+276,spec.height);fp(gate+280,spec.rotation);fp(gate+388,surface);fp(gate+336,NaN);v.setUint8(gate+256,1);v.setUint8(gate+317,Number(spec.two_way));
        ptr(gate+328,gateHit);ptr(gate+320,renderer);ptr(renderer+408,device);ptr(gate+340,mesh);ptr(mesh+12,buffer);ptr(buffer+32,gateOutput);ptr(mesh+20,indexBuffer);ptr(indexBuffer+4,516);ptr(gate+372,templateAt);ptr(gate+380,186);ptr(gate+384,516);
        new Float32Array(n.memory.buffer,templateAt,template.length).set(template);new Float32Array(n.memory.buffer,gateOutput,template.length).fill(0);
      }
    },vertices(kind,angle){
      if(kind==='spinner'){fp(spinnerHit+268,angle);n.ref_spinner(spinner,spinnerOutput);return new Float32Array(n.memory.buffer,spinnerOutput,228*8).slice();}
      fp(gateHit+76,angle);n.ref_gate(gate,64);return new Float32Array(n.memory.buffer,gateOutput,186*8).slice();
    }
  };
}
