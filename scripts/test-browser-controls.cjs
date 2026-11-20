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
      append(){},prepend(){},replaceChildren(){},insertBefore(){},setAttribute(){},
      addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},
      focus(){focused=id;},getContext(){return {};}};
    elements.set(id,e);return e;
  }
  const document={getElementById:element,createElement:()=>element(Symbol()),
    body:element('body'),querySelectorAll(selector){return selector==='.panel'?[element('controls-panel'),element('leaderboard-panel')]:[...elements.values()].filter(e=>e.dataset.action);},
    querySelector(selector){if(selector==='.panel:popover-open')return panelOpen?{}:null;
      const match=selector.match(/data-action=(\w+)/);return match?[...elements.values()].find(e=>e.dataset.action===match[1]):element(selector);},
    addEventListener(){}};
  const context=vm.createContext({document,window:{addEventListener(type,fn){(listeners[type]??=[]).push(fn);}},
    localStorage:{getItem:()=>saved?JSON.stringify(saved):null,setItem(){}},
    matchMedia:()=>({matches:false,addEventListener(){}}),setInterval(){},setTimeout(){},clearTimeout(){},
    createLeaderboard:()=>({state(){}}),createViews:()=>({}),createDmd:()=>({draw(){}})});
  vm.runInContext(source,context);
  context.capture=script=>scripts.push(script);
  vm.runInContext('engine={ccall:(name,type,args,[script])=>capture(script)};connected=true;',context);
  function key(type,code){for(const fn of listeners[type])fn({code,target:{},preventDefault(){},stopImmediatePropagation(){}});}
  return {context,element,scripts,key,get focused(){return focused;},set panelOpen(value){panelOpen=value;}};
}
const app=setup();
app.key('keydown','Space');app.key('keydown','Space');app.key('keyup','Space');
assert.deepEqual(app.scripts,['Table1_KeyDown LockBarKey','Table1_KeyUp LockBarKey']);
app.key('keydown','KeyX');app.key('keyup','KeyX');
assert.equal(app.scripts[2],'Table1_KeyDown CenterTiltKey');
for(let game=0;game<2;game++){app.key('keydown','Digit1');app.key('keyup','Digit1');}
assert.equal(app.scripts.filter(s=>s==='bFreePlay=True:Table1_KeyDown StartGameKey').length,2);
app.element('initials-dialog').listeners.close[0]();
assert.equal(app.focused,'canvas');
vm.runInContext('updateReplay(true,false);updateReplay(false,false);',app.context);
assert.equal(app.element('play').textContent,'Play again');
assert.equal(app.element('waiting').hidden,false);
app.element('play').onclick();
assert.equal(app.element('waiting').hidden,true);
assert.equal(app.scripts.at(-1),'bFreePlay=True:Table1_KeyDown StartGameKey:Table1_KeyUp StartGameKey');
vm.runInContext('updateReplay(true,false);updateReplay(false,true);',app.context);
assert.equal(vm.runInContext('replayVisible',app.context),false);
app.panelOpen=true;app.element('leaderboard-panel').listeners.toggle.at(-1)({newState:'closed'});
app.panelOpen=false;app.element('leaderboard-panel').listeners.toggle.at(-1)({newState:'closed'});
assert.equal(app.focused,'canvas');
const migrated=setup({keys:{left:'ShiftLeft',right:'ShiftRight',launch:'Enter',start:'Digit1',nudgeLeft:'KeyZ',nudgeCenter:'Space',nudgeRight:'Slash'},latch:true});
assert.equal(vm.runInContext('settings.keys.action',migrated.context),'Space');
assert.equal(vm.runInContext('settings.keys.nudgeCenter',migrated.context),'KeyX');
assert.equal(vm.runInContext('settings.latch',migrated.context),true);
console.log('PASS: Space action, X nudge, repeat suppression, two starts, focus return, replay without engine reload, initials-entry guard, settings migration');
