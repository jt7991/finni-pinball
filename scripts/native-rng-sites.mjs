// Read-only observation calls after original i64 stores. Existing instructions,
// function/type indices, data and imports remain byte-for-byte unchanged.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
export function nativeRngSites(bytes){
 const sha=b=>createHash('sha256').update(b).digest('hex');assert.equal(sha(bytes),'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 let p=8,imports=0,type,slot,codeSection;const patches=[],sites=[],signature=Buffer.from('41d0cdd303290300','hex');
 const u=()=>{let n=0,s=0,b;do{b=bytes[p++];n+=(b&127)*2**s;s+=7;}while(b&128);return n;},signed=()=>{let b;do{b=bytes[p++];}while(b&128);},str=()=>{const n=u();p+=n;},leb=n=>{const a=[];do{let b=n&127;n>>>=7;if(n)b|=128;a.push(b);}while(n);return a;},sleb=n=>{const a=[];let more;do{let b=n&127;n>>=7;more=!((n===0&&!(b&64))||(n===-1&&(b&64)));if(more)b|=128;a.push(b);}while(more);return a;};
 while(p<bytes.length){const start=p,kind=bytes[p++],sizeStart=p,size=u(),begin=p,end=begin+size;
  if(kind===1){const count=u();for(let i=0;i<count;i++){assert.equal(bytes[p++],96);const params=Array.from({length:u()},()=>bytes[p++]),results=Array.from({length:u()},()=>bytes[p++]);if(params.length===1&&params[0]===127&&!results.length)type??=i;}}
  if(kind===2){for(let n=u();n;n--){str();str();assert.equal(bytes[p++],0);u();imports++;}}
  if(kind===4){assert.equal(u(),1);assert.equal(bytes[p++],112);const flags=u();assert.ok(flags===0||flags===1);const min=u(),max=flags?u():undefined;slot=min;assert.equal(p,end);const payload=[1,112,...leb(flags),...leb(min+1),...(max===undefined?[]:leb(Math.max(max,min+1)))];patches.push({start,deleteCount:end-start,bytes:[4,...leb(payload.length),...payload]});}
  if(kind===8)throw Error('Observer requires a module without a start function');
  if(kind===10){assert.ok(type!==undefined&&slot!==undefined);codeSection={sizeStart,sizeBytes:begin-sizeStart,size};const count=u();for(let i=0;i<count;i++){
    const sizeAt=p,length=u(),bodyStart=p,bodyEnd=p+length;if(!bytes.subarray(bodyStart,bodyEnd).includes(signature)){p=bodyEnd;continue;}
    const originalSHA256=sha(bytes.subarray(bodyStart,bodyEnd)),insertions=[];for(let n=u();n;n--){u();p++;}
    while(p<bodyEnd){const at=p,op=bytes[p++];
     if([2,3,4,65,66,208].includes(op))signed();
     else if([12,13,16,32,33,34,35,36,37,38,210].includes(op))u();
     else if(op===14){for(let n=u()+1;n;n--)u();}
     else if(op===17){u();u();}
     else if(op>=40&&op<=62){const align=u(),offset=u();if(op===55&&align===3&&offset===0){const id=sites.length;sites.push({id,functionIndex:i+imports,instructionOffset:at-bodyStart,originalSHA256});insertions.push({start:p,deleteCount:0,bytes:[65,...sleb(id),65,...sleb(slot),17,...leb(type),0]});}}
     else if(op===63||op===64)u();else if(op===67)p+=4;else if(op===68)p+=8;
     else if(op===252){const sub=u();if([8,10,12,14].includes(sub)){u();u();}else if([9,11,13,15,16,17].includes(sub))u();else assert.ok(sub<=7);}
     else assert.ok(op!==253&&op!==254,'No guessed SIMD/atomic instruction lengths');
    }
    assert.equal(p,bodyEnd);assert.ok(insertions.length);const added=insertions.reduce((n,x)=>n+x.bytes.length,0);patches.push({start:sizeAt,deleteCount:bodyStart-sizeAt,bytes:leb(length+added)},...insertions);
   }assert.equal(p,end);
  }p=end;
 }
 assert.ok(codeSection&&sites.length);const added=patches.filter(x=>x.start>=codeSection.sizeStart+codeSection.sizeBytes).reduce((n,x)=>n+x.bytes.length-x.deleteCount,0);patches.push({start:codeSection.sizeStart,deleteCount:codeSection.sizeBytes,bytes:leb(codeSection.size+added)});patches.sort((a,b)=>a.start-b.start);
 const apply=()=>{const chunks=[];let at=0;for(const patch of patches){assert.ok(patch.start>=at);chunks.push(bytes.subarray(at,patch.start),Buffer.from(patch.bytes));at=patch.start+patch.deleteCount;}chunks.push(bytes.subarray(at));return Buffer.concat(chunks);},instrumented=apply();assert.ok(WebAssembly.validate(instrumented));
 return {originalSHA256:sha(bytes),instrumentedSHA256:sha(instrumented),originalBytes:bytes.length,instrumentedBytes:instrumented.length,slot,type,sites,patches,scope:'Diagnostic trace calls after unchanged original i64 stores in the eight functions loading the verified MWC64X state. JS records only actual state changes. Existing function/type/import indices and data preserved; one unused typed table slot appended. No physics, clocks or RNG writes replaced.'};
}

export function installNativeRngSites(metadata){
 const data=window.nativeRngSiteObservation={metadata,records:[],armed:false,origin:0,errors:[]};const instantiate=WebAssembly.instantiate;let installed=false,last;
 async function run(input,imports){
  const bytes=new Uint8Array(input);if(bytes.length!==metadata.originalBytes)return instantiate(input,imports);
  const digest=async buffer=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');if(await digest(bytes)!==metadata.originalSHA256)throw Error('Original native RNG observer engine hash changed');
  const patched=new Uint8Array(metadata.instrumentedBytes);let source=0,target=0;for(const patch of metadata.patches){patched.set(bytes.subarray(source,patch.start),target);target+=patch.start-source;patched.set(patch.bytes,target);target+=patch.bytes.length;source=patch.start+patch.deleteCount;}patched.set(bytes.subarray(source),target);if(await digest(patched)!==metadata.instrumentedSHA256)throw Error('Native RNG observation patch hash changed');
  const result=await instantiate(patched,imports),instance=result.instance??result,memory=instance.exports.memory,table=instance.exports.__indirect_function_table;if(!memory||!table||installed)throw Error('Unique observed native memory/table unavailable');
  const observe=site=>{const view=new DataView(memory.buffer),low=view.getUint32(7661264,true),high=view.getUint32(7661268,true);if(last?.[0]===low&&last[1]===high)return;const previous=last;last=[low,high];if(!data.armed)return;const player=view.getUint32(9191328,true),ms=view.getUint32(player+40,true)-data.origin;data.records.push({ms,site,previous,words:last});};
  const wrapper=new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,1,127,0,2,9,1,1,101,3,111,98,115,0,0,3,2,1,0,7,5,1,1,102,0,1,10,8,1,6,0,32,0,16,0,11])),{e:{obs:observe}});table.set(metadata.slot,wrapper.exports.f);installed=true;data.installed=true;return result;
 }
 WebAssembly.instantiate=async function(input,imports){if(input instanceof WebAssembly.Module)return instantiate(input,imports);return run(input,imports);};
 WebAssembly.instantiateStreaming=async function(response,imports){return run(await(await response).arrayBuffer(),imports);};
}
