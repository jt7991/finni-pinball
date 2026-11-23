// Host-owned storage only: every original body/rod field is retained as a
// Float64, exactly representing native Float32 values and Uint32 identities.
export function nativePackedCapture(bodies,plunger){
 const pageLength=65536,reserve=2624,pages=[];let page,at=pageLength,lastIDs=[];
 const validation={samples:0,leaves:0};
 function same(a,b,path='snapshot'){
  if(a&&typeof a==='object'){
   if(!b||Object.keys(a).length!==Object.keys(b).length)throw Error('Packed native shape differs at '+path);
   for(const key of Object.keys(a))same(a[key],b[key],path+'.'+key);
  }else{if(!Object.is(a,b))throw Error('Packed native value differs at '+path+': '+a+' / '+b);validation.leaves++;}
 }
 function unpack(index){
  const source=pages[Math.floor(index/pageLength)],offset=index%pageLength,body=bodies.unpackPacked(source,offset),rod=plunger.unpackPacked(source,body.end),state=body.state;
  state.plunger=rod.state;const scriptRandom=source[rod.end];if(scriptRandom>=0)state.scriptRandom=scriptRandom;return state;
 }
 function capture(scriptRandom){
  let newPage=false;if(at+reserve>pageLength){page=new Float64Array(pageLength);pages.push(page);at=0;newPage=true;}
  const start=at,index=(pages.length-1)*pageLength+start;
  at=bodies.readPacked(page,at);at=plunger.readPacked(page,at);page[at++]=scriptRandom??-1;
  if(at>pageLength)throw Error('Native packed page capacity exceeded');
  const count=page[start+5];let changed=count!==lastIDs.length;
  for(let i=0;i<count;i++)if(page[start+6+i*26]!==lastIDs[i])changed=true;
  if(validation.samples<32||newPage||changed){
   const expected=bodies.read();if(scriptRandom!==undefined)expected.scriptRandom=scriptRandom;
   same(expected,unpack(index));validation.samples++;
  }
  if(changed){lastIDs=[];for(let i=0;i<count;i++)lastIDs.push(page[start+6+i*26]);}
  return index;
 }
 function exportPage(index){
  if(!Number.isInteger(index)||!pages[index])throw Error('Native packed page unavailable');
  if(new Uint8Array(new Uint16Array([0x0102]).buffer)[0]!==2)throw Error('Native packed transport requires a little-endian host');
  const bytes=new Uint8Array(pages[index].buffer);let result='';for(let i=0;i<bytes.length;i+=0x8000)result+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(result);
 }
 return {capture,unpack,validation,exportPage,hydrate(row){if(row.packed===undefined)return row;const {packed,...rest}=row;return {...rest,internals:unpack(packed)};},summary(){return {...validation,pages:pages.length,bytes:pages.length*pageLength*8,scope:'Same original native read fields packed into host Float64 pages, then decoded after recording. Original object reader verifies every scalar at the first32boundaries, every page boundary and every roster change, including signed zero and inactive NaN. No source clock, callback, body, native memory or random state is written.'};}};
}
