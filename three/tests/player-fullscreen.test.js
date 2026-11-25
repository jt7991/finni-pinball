import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const sha=b=>createHash('sha256').update(b).digest('hex'),bytes=fs.readFileSync(new URL('fixtures/main-player-fullscreen-source.json.gz',import.meta.url));
assert.equal(sha(bytes),'86bb78f2c52f46e8ec8cfb1126c9fde6f3d7ce97d9bbd6df7ddf6954249e4de1');
const reference=JSON.parse(gunzipSync(bytes)),port=fs.readFileSync(new URL('../player-fullscreen.js',import.meta.url),'utf8');
assert.equal(reference.sourceSHA256,'7bfc18344699ceedd88ad672719cec0dfb2ce5802c4079f4d6a81b3c758f88ad');
assert.equal(reference.servedCRLFSHA256,'3608d26828ea120a3a56437746d74054b7f69abe019d9b9ec4f21288b1a4389f');
assert.equal(sha(reference.block),'081ca9a13c87fdce7aa1b811d9ad608353ba6b29f069b305e4e9855f8103686d');

// These are declared DOM/API component inputs. They do not pretend that the
// headless browser accepted fullscreen, or that an iOS device was exercised.
function environment(mode,connected){
  const trace=[],elements=new Map(),document=new EventTarget(),window=new EventTarget();let time=0,next=0;
  const timers=new Map(),resolvers=[];
  const element=id=>{
    const node=new EventTarget(),classes=new Set(),attributes={};
    node.hidden=false;node.textContent='';node.title='';
    node.classList={add:value=>classes.add(value),remove:value=>classes.delete(value),contains:value=>classes.has(value),toggle(value,on){if(on)classes.add(value);else classes.delete(value);}};
    node.setAttribute=(name,value)=>{attributes[name]=value;};
    node.focus=()=>{document.activeElement=node;trace.push({focus:id});};
    node.state=()=>({classes:[...classes].sort(),attributes:{...attributes},title:node.title,hidden:node.hidden,text:node.textContent});
    elements.set(id,node);return node;
  };
  const root=element('root');document.documentElement=root;document.body=element('body');document.body.classList.add('playing');
  for(const id of ['fullscreen','screen-message','canvas','toolbar'])element(id);
  elements.get('screen-message').hidden=true;
  document.getElementById=id=>elements.get(id);document.querySelector=selector=>{assert.equal(selector,'.toolbar');return elements.get('toolbar');};
  document.fullscreenElement=null;document.webkitFullscreenElement=null;
  const prefix=mode==='prefixed',enterName=prefix?'webkitRequestFullscreen':'requestFullscreen',exitName=prefix?'webkitExitFullscreen':'exitFullscreen',field=prefix?'webkitFullscreenElement':'fullscreenElement';
  if(mode!=='missing'){
    root[enterName]=function(...args){
      assert.equal(this,root);trace.push({api:enterName,args});
      if(mode==='rejected')return Promise.reject(Error('Declared browser policy rejection'));
      if(mode==='pending')return new Promise(resolve=>resolvers.push(()=>{document[field]=root;resolve();}));
      document[field]=root;return Promise.resolve();
    };
    document[exitName]=function(...args){assert.equal(this,document);trace.push({api:exitName,args});document[field]=null;return Promise.resolve();};
  }
  const release=()=>trace.push({release:true}),focusGame=()=>{if(connected)elements.get('canvas').focus();};
  const setTimeout=(callback,ms)=>{const id=++next;timers.set(id,{callback,at:time+ms});return id;},clearTimeout=id=>timers.delete(id);
  const advance=ms=>{time+=ms;for(const[id,timer]of [...timers])if(timer.at<=time){timers.delete(id);timer.callback();}};
  const snapshot=()=>({trace:structuredClone(trace),active:!!(document.fullscreenElement||document.webkitFullscreenElement),body:document.body.state(),button:elements.get('fullscreen').state(),note:elements.get('screen-message').state(),timers:[...timers.values()].map(t=>t.at-time).sort((a,b)=>a-b)});
  return {document,window,elements,trace,resolvers,release,focusGame,setTimeout,clearTimeout,advance,snapshot};
}
function controller(native,e,connected){
  if(native)return new Function('$','document','window','release','connected','setTimeout','clearTimeout','innerWidth',reference.block+'\nreturn {set:setFullscreen};')(e.document.getElementById,e.document,e.window,e.release,connected,e.setTimeout,e.clearTimeout,1600);
  assert.ok(port.includes('export function createPlayerFullscreen'));
  return new Function('document','window','setTimeout','clearTimeout','innerWidth',port.replace('export function createPlayerFullscreen','function createPlayerFullscreen')+'\nreturn createPlayerFullscreen;')(e.document,e.window,e.setTimeout,e.clearTimeout,1600)({release:e.release,focusGame:e.focusGame});
}
async function sequence(native,mode,connected){
  const e=environment(mode,connected),c=controller(native,e,connected),states=[];
  const first=c.set(true);
  if(mode==='pending'){
    await c.set(true);states.push(e.snapshot());assert.equal(e.resolvers.length,1,'concurrent request is ignored');e.resolvers.shift()();
  }
  await first;states.push(e.snapshot());
  e.document.dispatchEvent(new Event(mode==='prefixed'?'webkitfullscreenchange':'fullscreenchange'));states.push(e.snapshot());
  if(mode==='standard'||mode==='prefixed'){
    await e.elements.get('fullscreen').onclick();states.push(e.snapshot());
    await e.elements.get('fullscreen').onclick();states.push(e.snapshot());
  }
  e.advance(1600);states.push(e.snapshot());
  e.window.dispatchEvent(Object.assign(new Event('pointermove'),{clientX:1,clientY:1}));states.push(e.snapshot());
  e.elements.get('toolbar').dispatchEvent(new Event('focusin'));states.push(e.snapshot());
  e.document.dispatchEvent(new Event(mode==='prefixed'?'webkitfullscreenerror':'fullscreenerror'));states.push(e.snapshot());
  e.advance(7000);states.push(e.snapshot());
  return states;
}
for(const mode of ['standard','prefixed','missing','rejected','pending'])for(const connected of [false,true])test(`fullscreen ${mode}, connected=${connected}, matches original main on declared API/event inputs`,async()=>{
  assert.deepEqual(await sequence(false,mode,connected),await sequence(true,mode,connected));
});
