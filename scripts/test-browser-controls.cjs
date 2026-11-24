// Exercise real app event handlers with a small DOM/engine fixture.
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync('browser/app.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('placeFlippers();boot();','placeFlippers();');
function setup(saved){
  const elements=new Map(), listeners={}, scripts=[];
  let focused, panelOpen=false;
  function element(id){
    if(elements.has(id))return elements.get(id);
    const e={dataset:{},classList:{add(){},toggle(){}},listeners:{},
      append(){},prepend(){},replaceChildren(){},insertBefore(){},setAttribute(){},removeAttribute(){},
      addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},
      focus(){focused=id;},getContext(){return {};}};
    elements.set(id,e);return e;
  }
  const document={getElementById:element,createElement:()=>element(Symbol()),
    body:element('body'),fullscreenElement:element('canvas'),querySelectorAll(selector){return selector==='.panel'?[element('controls-panel'),element('leaderboard-panel')]:[...elements.values()].filter(e=>e.dataset.action);},
    querySelector(selector){if(selector==='.panel:popover-open')return panelOpen?{}:null;
      const match=selector.match(/data-action=(\w+)/);return match?[...elements.values()].find(e=>e.dataset.action===match[1]):element(selector);},
    addEventListener(){}};
  const context=vm.createContext({document,window:{addEventListener(type,fn){(listeners[type]??=[]).push(fn);}},
    localStorage:{getItem:()=>saved?JSON.stringify(saved):null,setItem(){}},
    matchMedia:()=>({matches:false,addEventListener(){}}),setInterval(){},setTimeout,clearTimeout,
    requestAnimationFrame:fn=>setTimeout(fn,0),cancelAnimationFrame:clearTimeout,
    createLeaderboard:()=>({state(){}}),createViews:()=>({}),createDmd:()=>({draw(){}}),createMusic:()=>({select(){}})});
  vm.runInContext(source,context);
  context.capture=script=>scripts.push(script);
  vm.runInContext('engine={ccall:(name,type,args,[script])=>capture(script)};connected=true;$("waiting").hidden=true;',context);
  function key(type,code){for(const fn of listeners[type])fn({code,target:{},preventDefault(){},stopImmediatePropagation(){}});}
  return {context,element,scripts,key,get focused(){return focused;},set panelOpen(value){panelOpen=value;}};
}
const app=setup();
app.key('keydown','Space');app.key('keydown','Space');app.key('keyup','Space');
assert.deepEqual(app.scripts,['Table1_KeyDown LockBarKey','Table1_KeyUp LockBarKey']);
app.key('keydown','KeyX');app.key('keyup','KeyX');
assert.equal(app.scripts[2],'Table1_KeyDown CenterTiltKey');
for(let game=0;game<2;game++){app.key('keydown','Digit1');app.key('keyup','Digit1');}
assert.equal(app.scripts.filter(s=>s.includes('StartGameKey')).length,0);
app.element('initials-dialog').listeners.close[0]();
assert.equal(app.focused,'canvas');
async function verifyReplay(){
  vm.runInContext('updateReplay(true,false);updateReplay(false,false);',app.context);
  assert.equal(app.element('play').textContent,'Play again');
  assert.equal(app.element('waiting').hidden,false);
  await app.element('play').onclick();
  assert.equal(app.element('waiting').hidden,true);
  assert.equal(app.scripts.at(-1),'bFreePlay=True:Table1_KeyDown StartGameKey:Table1_KeyUp StartGameKey');
  vm.runInContext('updateReplay(true,false);updateReplay(false,true);',app.context);
  assert.equal(vm.runInContext('replayVisible',app.context),false);
  app.panelOpen=true;app.element('leaderboard-panel').listeners.toggle.at(-1)({newState:'closed'});
  app.panelOpen=false;app.element('leaderboard-panel').listeners.toggle.at(-1)({newState:'closed'});
  assert.equal(app.focused,'canvas');
}
void verifyReplay().then(()=>console.log('PASS: replay without engine reload, initials-entry guard, panel focus return'));
const migrated=setup({keys:{left:'ShiftLeft',right:'ShiftRight',launch:'Enter',start:'Digit1',nudgeLeft:'KeyZ',nudgeCenter:'Space',nudgeRight:'Slash'},latch:true});
assert.equal(vm.runInContext('settings.keys.action',migrated.context),'Space');
assert.equal(vm.runInContext('settings.keys.nudgeCenter',migrated.context),'KeyX');
assert.equal(vm.runInContext('settings.latch',migrated.context),true);
console.log('PASS: Space action, X nudge, repeat suppression, Start ignored during play, focus return, settings migration');
for(const [error,expected] of [
  ['{message:"Unable to allocate memory",code:"ENOMEM"}','Unable to allocate memory (code ENOMEM)'],
  ['{name:"ErrnoError",errno:44}','ErrnoError (errno 44)'],
  ['{error:{message:"Shader compilation failed"}}','Shader compilation failed'],
  ['{cause:{message:"Network request failed"}}','Network request failed'],
  ['{}','The game stopped without an error message.'],
]){
  const failure=setup();
  vm.runInContext(`enginePhase='Starting table';held.set('left',new Set(['pointer:1']));fail(${error});`,failure.context);
  assert.equal(failure.element('loading').textContent,`Starting table: ${expected}`);
  assert.equal(failure.element('play').textContent,'Reload and retry');
  assert.equal(failure.element('play').disabled,false);
  assert.equal(vm.runInContext('held.size',failure.context),0);
}
const cyclic=setup();
vm.runInContext('const cyclicError={message:"GPU reset"};cyclicError.cause=cyclicError;fail(cyclicError);',cyclic.context);
assert.ok(cyclic.element('loading').textContent.includes('GPU reset'));
console.log('PASS: object-shaped and nested errors, engine error codes, circular diagnostics, retry state and input cleanup');
