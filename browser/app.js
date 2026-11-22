import {createLeaderboard} from './leaderboard.js';
import {createViews,createDmd} from './views.js';
import {prepareRenderer,configureRenderer,startTable} from './renderer.js';
const actions = [
  ['left','Left flipper','ShiftLeft'],['right','Right flipper','ShiftRight'],
  ['launch','Launch','Enter'],['start','Start','Digit1'],
  ['nudgeLeft','Nudge left','KeyZ'],['nudgeCenter','Nudge forward','KeyX'],['nudgeRight','Nudge right','Slash'],
  ['action','Action','Space'],
];
const $ = id => document.getElementById(id);
const defaults = Object.fromEntries(actions.map(([id,,key])=>[id,key]));
let settings = {keys:{...defaults},latch:false,showTouch:true};
try {
  const saved=JSON.parse(localStorage.getItem('finni-controls-v1'));
  if(saved && !saved.keys?.action && saved.keys){
    // Upgrade existing controls without discarding custom bindings.
    const used=new Set(Object.values(saved.keys));
    if(saved.keys.nudgeCenter==='Space'){
      saved.keys.nudgeCenter=['KeyX','KeyC','KeyV','KeyN','KeyB','KeyM','KeyG','KeyH'].find(key=>!used.has(key));
      used.delete('Space');used.add(saved.keys.nudgeCenter);
    }
    saved.keys.action=['Space','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','KeyG'].find(key=>!used.has(key));
  }
  if(saved && actions.every(([id])=>typeof saved.keys?.[id]==='string') && new Set(Object.values(saved.keys)).size===actions.length) settings={...settings,...saved};
} catch {}
let listening=null, connected=false, engine=null, hasPlayed=false, replayVisible=false, enginePhase='Loading game';
const held=new Map(), physical=new Set(), pointers=new Map();
const message=text=>$('message').textContent=text;
function save(){try{localStorage.setItem('finni-controls-v1',JSON.stringify(settings));}catch{message('Browser storage is unavailable. Settings apply for this session.');}}
function label(code){return code.replace(/^Key|^Digit/,'').replace('ShiftLeft','Left Shift').replace('ShiftRight','Right Shift').replace('Arrow','');}
function render(){
  $('bindings').replaceChildren();
  for(const [id,name] of actions){
    const row=document.createElement('div');row.className='binding';
    const text=document.createElement('span');text.textContent=name;
    const button=document.createElement('button');button.textContent=listening===id?'Press a key…':label(settings.keys[id]);
    button.classList.toggle('listening',listening===id);button.setAttribute('aria-label',`Change ${name}: ${label(settings.keys[id])}`);
    button.onclick=()=>{release();listening=id;message('Press a key to bind. Escape cancels.');render();};
    row.append(text,button);$('bindings').append(row);
  }
  $('latch').checked=settings.latch;$('showTouch').checked=settings.showTouch;$('touch').hidden=!settings.showTouch;
  $('flip-zones').hidden=!settings.showTouch;
  $('nudge-zone').hidden=!settings.showTouch;
  $('control-hint').textContent=`${label(settings.keys.start)} start · ${label(settings.keys.action)} action · Hold ${label(settings.keys.launch)}, then release to launch`;
}
function release(){held.clear();physical.clear();pointers.clear();paint();send();}
function setAction(id,down,source){
  if(!connected)return;
  if(down&&(!$('waiting').hidden||$('initials-dialog').open||document.querySelector('.panel:popover-open')))return;
  const sources=held.get(id)||new Set();
  if(settings.latch && ['left','right'].includes(id)){
    if(!down)return;
    if(sources.size)sources.clear();else sources.add('toggle');
  }else{if(down)sources.add(source);else sources.delete(source);}
  if(sources.size)held.set(id,sources);else held.delete(id);
  paint();send();
}
function paint(){document.querySelectorAll('[data-action]').forEach(b=>{const pressed=held.has(b.dataset.action);b.classList.toggle('pressed',pressed);b.setAttribute('aria-pressed',String(pressed));b.disabled=!connected;});}
function finishPointer(event,cancelled=false){
  const id=pointers.get(event.pointerId);
  if(!id)return;
  pointers.delete(event.pointerId);
  if(cancelled&&settings.latch&&['left','right'].includes(id)){
    held.delete(id);paint();send();
  }else setAction(id,false,`pointer:${event.pointerId}`);
}
window.addEventListener('pointerup',event=>finishPointer(event));
window.addEventListener('pointercancel',event=>finishPointer(event,true));
for(const [id,name] of actions){
  const button=document.createElement('button');button.textContent=name;button.dataset.action=id;button.disabled=true;
  // Cancelling contextmenu is too late to stop Android's long-press haptic.
  // Cancel the native touch gesture; pointer events still drive game input.
  for(const type of ['touchstart','touchend'])button.addEventListener(type,e=>e.preventDefault(),{passive:false});
  button.addEventListener('contextmenu',e=>e.preventDefault());
  button.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    e.preventDefault();
    try{button.setPointerCapture(e.pointerId);}catch{}
    pointers.set(e.pointerId,id);setAction(id,true,`pointer:${e.pointerId}`);
  });
  button.addEventListener('pointerup',event=>finishPointer(event));
  for(const type of ['pointercancel','lostpointercapture'])button.addEventListener(type,event=>finishPointer(event,true));
  button.addEventListener('keydown',e=>{if(['Enter','Space'].includes(e.code)){e.preventDefault();if(!e.repeat)setAction(id,true,'button');}});
  button.addEventListener('keyup',e=>{if(['Enter','Space'].includes(e.code)){e.preventDefault();setAction(id,false,'button');}});
  (id.startsWith('nudge')?$('nudges'):$('touch')).append(button);
}
const phoneLayout=matchMedia('(max-width:650px), (pointer:coarse) and (max-width:1024px)');
let graphics='auto';
try{const saved=localStorage.getItem('finni-graphics-v1');if(['auto','performance','detailed'].includes(saved))graphics=saved;}catch{}
$('graphics').value=graphics;
$('apply-graphics').onclick=()=>{
  release();
  try{localStorage.setItem('finni-graphics-v1',$('graphics').value);}catch{message('Browser storage is unavailable. Graphics could not be saved.');return;}
  location.reload();
};
function placeFlippers(){
  release();
  const buttons=['left','right'].map(id=>document.querySelector(`[data-action=${id}]`));
  const nudge=document.querySelector('[data-action=nudgeCenter]');
  if(phoneLayout.matches)buttons.forEach(button=>$('flip-zones').append(button));
  else buttons.reverse().forEach(button=>$('touch').prepend(button));
  if(phoneLayout.matches)$('nudge-zone').append(nudge);
  else $('nudges').insertBefore(nudge,document.querySelector('[data-action=nudgeRight]'));
  $('flip-zones').hidden=!settings.showTouch;
  $('nudge-zone').hidden=!settings.showTouch;
}
phoneLayout.addEventListener('change',placeFlippers);
window.addEventListener('resize',release);
window.addEventListener('keydown',e=>{
  if(listening){e.preventDefault();e.stopPropagation();if(e.repeat)return;
    if(e.code==='Escape'){listening=null;message('Binding cancelled.');render();return;}
    if(e.metaKey||e.ctrlKey||e.altKey||['MetaLeft','MetaRight','Tab','ControlLeft','ControlRight','AltLeft','AltRight'].includes(e.code)){message('Choose a key without Ctrl, Alt, Command, or Tab.');return;}
    const conflict=actions.find(([id])=>id!==listening&&settings.keys[id]===e.code);
    if(conflict){message(`Already used by ${conflict[1]}. Choose another key.`);return;}
    settings.keys[listening]=e.code;listening=null;save();message('Control saved.');render();return;
  }
  if(e.target.closest?.('button,input,select,summary')||document.querySelector('.panel:popover-open')||$('initials-dialog').open||e.ctrlKey||e.metaKey||e.altKey)return;
  const action=actions.find(([id])=>settings.keys[id]===e.code);if(!action)return;
  e.preventDefault();if(physical.has(e.code))return;physical.add(e.code);setAction(action[0],true,`key:${e.code}`);
});
window.addEventListener('keyup',e=>{if(!physical.delete(e.code))return;const action=actions.find(([id])=>settings.keys[id]===e.code);if(action){e.preventDefault();setAction(action[0],false,`key:${e.code}`);}});
window.addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
window.addEventListener('pagehide',release);
$('latch').onchange=e=>{release();settings.latch=e.target.checked;save();};
$('showTouch').onchange=e=>{release();settings.showTouch=e.target.checked;save();render();$('flip-zones').hidden=!settings.showTouch;$('nudge-zone').hidden=!settings.showTouch;};
$('reset').onclick=()=>{release();listening=null;settings={keys:{...defaults},latch:false,showTouch:true};save();render();message('Default controls restored.');};
$('release').onclick=release;
let toolbarTimer, screenMessageTimer, fullscreenPending=false;
function screenMessage(text){
  $('screen-message').textContent=text;$('screen-message').hidden=false;
  clearTimeout(screenMessageTimer);
  screenMessageTimer=setTimeout(()=>$('screen-message').hidden=true,7000);
}
function showToolbar(){
  document.body.classList.add('toolbar-visible');
  clearTimeout(toolbarTimer);
  toolbarTimer=setTimeout(()=>document.body.classList.remove('toolbar-visible'),1600);
}
function syncFullscreen(){
  release();
  const fullscreen=!!(document.fullscreenElement||document.webkitFullscreenElement);
  document.body.classList.toggle('fullscreen-play',fullscreen);
  $('fullscreen').setAttribute('aria-pressed',String(fullscreen));
  $('fullscreen').setAttribute('aria-label',fullscreen?'Exit full screen':'Enter full screen');
  $('fullscreen').title=fullscreen?'Exit full screen':'Full screen';
  if(fullscreen)$('screen-message').hidden=true;
  if(connected)$('canvas').focus({preventScroll:true});
  showToolbar();
}
async function setFullscreen(fullscreen){
  if(fullscreen===!!(document.fullscreenElement||document.webkitFullscreenElement))return;
  if(fullscreenPending)return;
  fullscreenPending=true;
  release();
  const target=document.documentElement;
  try{
    if(!fullscreen){
      const exit=document.exitFullscreen||document.webkitExitFullscreen;
      if(exit)await exit.call(document);
    }else{
      const enter=target.requestFullscreen||target.webkitRequestFullscreen;
      if(!enter){screenMessage('This browser does not support full screen for games.');return;}
      if(target.requestFullscreen)await enter.call(target,{navigationUI:'hide'});
      else await enter.call(target);
    }
    syncFullscreen();
  }catch{
    screenMessage(`Could not ${fullscreen?'enter':'exit'} full screen. Tap the full screen button to try again.`);
  }finally{fullscreenPending=false;}
}
$('fullscreen').onclick=()=>setFullscreen(!(document.fullscreenElement||document.webkitFullscreenElement));
document.addEventListener('fullscreenchange',syncFullscreen);
document.addEventListener('webkitfullscreenchange',syncFullscreen);
for(const type of ['fullscreenerror','webkitfullscreenerror'])document.addEventListener(type,()=>{
  fullscreenPending=false;
  screenMessage('Could not change full screen. Tap the full screen button to try again.');
});
window.addEventListener('pointermove',e=>{
  const atTop=document.body.classList.contains('portrait-rotated')?e.clientX>innerWidth-24:e.clientY<24;
  if(document.fullscreenElement&&atTop)showToolbar();
});
document.querySelector('.toolbar').addEventListener('pointerenter',showToolbar);
document.querySelector('.toolbar').addEventListener('focusin',showToolbar);
const nativeKeys=['LeftFlipperKey','RightFlipperKey','PlungerKey','StartGameKey','LeftTiltKey','CenterTiltKey','RightTiltKey','LockBarKey'];
const applied=new Set();
function evaluate(script){
  try{return engine?.ccall('vpinball_wasm_eval_script','number',['string'],[script]);}
  catch(error){if(!connected)throw error;fail(error);}
}
function send(){
  if(!connected)return;
  for(let i=0;i<actions.length;i++){
    const id=actions[i][0], down=held.has(id);
    if(down!==applied.has(id)){
      evaluate(`${id==='start'&&down?'bFreePlay=True:':''}Table1_Key${down?'Down':'Up'} ${nativeKeys[i]}`);
      if(!connected)return;
      if(down)applied.add(id);else applied.delete(id);
    }
  }
}
// Our remapping owns keyboard input. Prevent SDL's default bindings from also firing.
for(const type of ['keydown','keyup'])window.addEventListener(type,e=>e.stopImmediatePropagation());
const logs=[];
const leaderboard=createLeaderboard(evaluate,release);
const views=createViews(evaluate,()=>connected,release);
const dmd=createDmd();
// Dialogs and popovers restore focus to toolbar buttons. Return it to the
// playfield so the next Start key reaches the game rather than a focused tool.
function focusGame(){if(connected&&!$('initials-dialog').open&&!document.querySelector('.panel:popover-open'))$('canvas').focus({preventScroll:true});}
async function replay(){
  if($('play').disabled)return;
  $('play').disabled=true;
  await setFullscreen(true);
  release();
  evaluate('bFreePlay=True:Table1_KeyDown StartGameKey:Table1_KeyUp StartGameKey');
  if(!connected)return;
  $('waiting').hidden=true;replayVisible=false;focusGame();
}
function updateReplay(playing,entering){
  if(playing){hasPlayed=true;if(replayVisible){$('waiting').hidden=true;replayVisible=false;}return;}
  if(!connected||!hasPlayed||entering||replayVisible)return;
  release();replayVisible=true;
  document.querySelector('#waiting h2').textContent='Game over';
  document.querySelector('#waiting .start-content > p').textContent='Start a new game on this table.';
  $('play').disabled=false;$('play').textContent='Play again';$('play').onclick=replay;
  $('loading').textContent='Ready to play again.';$('waiting').hidden=false;
}
$('initials-dialog').addEventListener('close',focusGame);
for(const panel of document.querySelectorAll('.panel'))panel.addEventListener('toggle',e=>{if(e.newState==='closed')focusGame();});
$('touch-help').onclick=()=>{
  release();
  const showing=document.body.classList.toggle('show-touch-guide');
  $('touch-help').setAttribute('aria-pressed',String(showing));$('touch-guide').hidden=!showing;
  if(!showing)focusGame();
};
$('dismiss-touch-guide').onclick=()=>{document.body.classList.remove('show-touch-guide');$('touch-guide').hidden=true;$('touch-help').setAttribute('aria-pressed','false');focusGame();};
function log(line){
  const display=String(line).match(/FINNI_DMD\|([^']*)/);
  if(display){dmd.draw(display[1]);return;}
  const match=String(line).match(/FINNI_STATE\|([^']*)/);
  if(match){
    const s=match[1].split('|');
    document.body.classList.toggle('game-in-play',s[3]==='True');
    document.body.classList.toggle('ball-in-plunger',s[11]==='True');
    $('score').textContent=Number(s[0]||0).toLocaleString();$('ball').textContent=s[1]==='0'?'—':s[1];
    leaderboard.state({playing:s[3]==='True',entering:s[4]==='True',player:Number(s[5]),players:Number(s[6]),scores:s.slice(7,11).map(Number)});
    updateReplay(s[3]==='True',s[4]==='True');
    return;
  }
  logs.push(String(line).replace(/\u001b\[[0-9;]*[a-zA-Z]/g,''));if(logs.length>120)logs.shift();$('log').textContent=logs.join('\n');
}
function describeEngineError(error,depth=0){
  if(depth>3)return '';
  if(typeof error==='string')return error==='[object Object]'?'':error;
  if(typeof error==='number')return `Engine exception ${error}`;
  if(!error||typeof error!=='object')return '';
  const message=describeEngineError(error.message,depth+1)||describeEngineError(error.reason,depth+1)||describeEngineError(error.error,depth+1)||describeEngineError(error.cause,depth+1);
  const code=error.errno!==undefined?`errno ${error.errno}`:error.code!==undefined?`code ${error.code}`:'';
  const name=typeof error.name==='string'&&error.name!=='Error'?error.name:'';
  return [message||name,code&&`(${code})`].filter(Boolean).join(' ');
}
function fail(error){
  document.body.classList.add('engine-error');
  const detail=describeEngineError(error)||'The game stopped without an error message.';
  log(`${enginePhase}: ${detail}`);
  if(error&&typeof error==='object'){
    const seen=new WeakSet();
    try{log(JSON.stringify(error,(key,value)=>{
      if(typeof value==='bigint')return String(value);
      if(value&&typeof value==='object'){if(seen.has(value))return '[circular]';seen.add(value);}
      return value;
    }));}catch{}
    if(typeof error.stack==='string')log(error.stack);
  }
  connected=false;held.clear();physical.clear();pointers.clear();applied.clear();paint();
  $('waiting').hidden=false;$('progress').hidden=true;
  $('loading').textContent=`${enginePhase}: ${detail}`;$('status').textContent='Game unavailable';
  $('play').disabled=false;$('play').textContent='Reload and retry';$('play').onclick=()=>location.reload();
}
$('canvas').addEventListener('webglcontextlost',e=>{
  e.preventDefault();fail(new Error('Graphics context lost. Reload to restart the game.'));
});
async function boot(){
  try{
    const probe=document.createElement('canvas').getContext('webgl2');
    if(!probe)throw Error('WebGL 2 is required. Enable graphics acceleration or try a current browser.');
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    const [factory, response]=await Promise.all([import('/engine/vpinball.js'),fetch('/table.vpx')]);
    if(!response.ok)throw Error('The Finni VPX table is missing. Build it first (see README).');
    let table=await response.arrayBuffer();enginePhase='Preparing engine';$('progress').value=55;$('loading').textContent='Preparing the VPX engine…';
    engine=await factory.default({canvas:$('canvas'),preRun:[module=>configureRenderer(module,{mobile:phoneLayout.matches,quality:graphics})],locateFile:path=>`/engine/${path}`,print:log,printErr:log,onAbort:fail,setStatus:text=>{if(text)$('loading').textContent=text;}});
    prepareRenderer(engine);
    // MEMFS can own the download buffer; avoid a second ~166 MB copy on phones.
    engine.FS.mkdirTree('/tables');engine.FS.writeFile('/tables/finni.vpx',new Uint8Array(table),{canOwn:true});table=null;
    $('progress').value=100;$('progress').hidden=true;$('loading').textContent='Table loaded.';$('play').disabled=false;$('play').textContent='Start game';$('status').textContent='Ready to play';
    $('play').onclick=async()=>{
      enginePhase='Starting table';$('play').disabled=true;$('loading').textContent='Starting the table…';
      // Queue fullscreen from the click before SDL startup; SDL otherwise exits
      // fullscreen if it has already settled while the native window is created.
      void setFullscreen(true);
      try{
        const result=startTable(engine,'/tables/finni.vpx');
        if(result!==1)throw Error(`VPX could not start this table (code ${result}). See the engine log.`);
        // Legacy tables can import their own trail preference over the global
        // setting. Keep one sharp ball even when the packed table requests it.
        evaluate('Table1.BallTrail=0');
        // New game balls retain their chrome texture without the source
        // table's dense scratch overlay, which sparkles into a ghostly rim.
        evaluate('Table1.BallFrontDecal=""');
        // The native table now owns its decoded art/audio. Replay uses the
        // running player, so retaining the packed upload only wastes memory.
        engine.FS.unlink('/tables/finni.vpx');
        evaluate('Dim FinniDmdDigit, FinniDmdState : bFreePlay=True : For Each FinniDmdDigit In Digits : FinniDmdDigit.Visible=False : Next : digitgrid.Visible=False : DMDFlush : ShowTableInfo');
        connected=true;document.body.classList.add('playing');$('waiting').hidden=true;$('progress').hidden=true;$('status').textContent='Playing';document.title='Finni’s Big Day';paint();$('canvas').focus();
        views.apply();
        evaluate('Table1_KeyDown StartGameKey:Table1_KeyUp StartGameKey');
        enginePhase='Playing';
      }catch(error){fail(error);}
    };
    // Exposes real table scripting for compatibility diagnostics and smoke checks.
    window.finni={evaluate,engine};
  }catch(error){fail(error);}
}
render();paint();placeFlippers();boot();
setInterval(()=>{if(connected&&!document.hidden)evaluate('Debug.Print "FINNI_STATE|" & Score(CurrentPlayer) & "|" & Balls & "|" & Credits & "|" & bGameInPlay & "|" & hsbModeActive & "|" & CurrentPlayer & "|" & PlayersPlayingGame & "|" & Score(1) & "|" & Score(2) & "|" & Score(3) & "|" & Score(4) & "|" & bBallInPlungerLane');},250);
setInterval(()=>{if(connected&&!document.hidden)evaluate('FinniDmdState="":For Each FinniDmdDigit In Digits:FinniDmdState=FinniDmdState & FinniDmdDigit.ImageA & "|":Next:Debug.Print "FINNI_DMD|" & FinniDmdState');},phoneLayout.matches?100:50);

