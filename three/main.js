import {createRuntimeGame} from './game-runtime.js';
import {createView} from './scene.js';
import {createAudio,createDisplay} from './media.js';
import {createLeaderboard} from '../browser/leaderboard.js';
import {prepareUI} from './ui.js';

const $=prepareUI();
let game,view,audio,display,leaderboard,paused=true,frames=0,sampleStart=0;
const sources=new Map(),swipes=new Map(),buttons=[...document.querySelectorAll('[data-input]')];
const selectedPlayers=()=>Number($('player-count')?.value??1);
const defaultKeys={ShiftLeft:'left',ShiftRight:'right',Enter:'launch',Digit1:'start',Space:'action',KeyZ:'nudgeLeft',KeyX:'nudgeForward',Slash:'nudgeRight'},keys={...defaultKeys};
const read=(key,fallback)=>{try{return localStorage.getItem(`finni-three-${key}`)||fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(`finni-three-${key}`,value);}catch{}};
const startTime=performance.now();
let messageUntil=0;
let rebinding=null;
try{const bindings=JSON.parse(read('bindings','null'));if(bindings&&Object.keys(bindings).length===8&&new Set(Object.values(bindings)).size===8){for(const k of Object.keys(keys))delete keys[k];for(const [action,code]of Object.entries(bindings))keys[code]=action;}}catch{}
$('latch').checked=read('latch','false')==='true';
$('latch').onchange=()=>{release();save('latch',String($('latch').checked));};
const actionNames={left:'Left flipper',right:'Right flipper',launch:'Launch',start:'Start',action:'Action',nudgeLeft:'Nudge left',nudgeForward:'Nudge up',nudgeRight:'Nudge right'};
function bindings(){
  $('bindings').replaceChildren();
  for(const [action,label]of Object.entries(actionNames)){
    const row=document.createElement('div'),text=document.createElement('span'),button=document.createElement('button');
    row.className='binding';text.textContent=label;button.type='button';button.textContent=Object.keys(keys).find(k=>keys[k]===action)||'Unbound';
    button.onclick=()=>{rebinding=action;button.textContent='Press a key';};row.append(text,button);$('bindings').append(row);
  }
  for(const button of buttons){const hint=button.querySelector('kbd');if(hint)hint.textContent=(Object.keys(keys).find(k=>keys[k]===button.dataset.input)||'').replace(/^Key|^Digit/,'').replace('ShiftLeft','L Shift').replace('ShiftRight','R Shift');}
}
bindings();
$('reset-bindings').onclick=()=>{release();for(const code of Object.keys(keys))delete keys[code];Object.assign(keys,defaultKeys);save('bindings','null');$('latch').checked=false;save('latch','false');bindings();};
$('release').onclick=release;
function rotateScreen(enabled){release();document.body.classList.toggle('portrait-rotated',enabled);$('portrait').setAttribute('aria-pressed',String(enabled));save('portrait',String(enabled));}
$('portrait').onclick=()=>rotateScreen(!document.body.classList.contains('portrait-rotated'));
rotateScreen(read('portrait','false')==='true');
function message(text,seconds=3){$('message').textContent=text;messageUntil=(game?.time||0)+seconds;}
function event(e){
  if(e.type==='shake')view?.shake(e.strength);
  const lines={start:'Hold Launch, then release.',tilt:'Tilt · flippers disabled',over:'Game over'};
  if(lines[e.type])message(lines[e.type]);
  if(e.type==='message')message(e.text);
  if(e.type==='start'){pause(false);$('overlay').hidden=true;$('play').disabled=false;$('player-count').disabled=true;document.body.classList.add('playing');$('table').focus({preventScroll:true});}
  if(e.type==='over'){
    $('player-count').disabled=false;$('play').disabled=false;
    release();document.body.classList.remove('playing');$('overlay').hidden=false;
    $('load-status').textContent=`Final score: ${game.score.toLocaleString()}`;$('play').textContent='Play again';
  }
}
function input(action,down,source){
  if(!game||paused)return;
  if(action==='start'){
    if(down&&!$('overlay').hidden&&!$('play').disabled&&!$('initials-dialog').open)$('play').click();
    return;
  }
  if($('latch').checked&&(action==='left'||action==='right')){
    if(down){const key=`latched:${action}`,held=sources.has(key);if(held)sources.delete(key);else sources.set(key,action);game.input(action,!held);paint();}
    return;
  }
  const before=[...sources.values()].includes(action);
  if(down)sources.set(source,action);else sources.delete(source);
  const held=[...sources.values()].includes(action);
  if(before!==held)game.input(action,held);
  paint();
}
function paint(){for(const b of buttons){const held=[...sources.values()].includes(b.dataset.input);b.classList.toggle('pressed',held);b.classList.toggle('held',held);}}
function release(){sources.clear();swipes.clear();game?.release();paint();}
for(const button of buttons){
  button.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;e.preventDefault();button.setPointerCapture(e.pointerId);
    audio?.unlock();input(button.dataset.input,true,`pointer:${e.pointerId}`);
    if(['touch','pen'].includes(e.pointerType)&&button.parentElement===$('flip-zones')&&['left','right'].includes(button.dataset.input))swipes.set(e.pointerId,{x:e.clientX,y:e.clientY,nudged:false});
  });
  button.addEventListener('pointermove',e=>{
    const swipe=swipes.get(e.pointerId);if(!swipe||swipe.nudged)return;
    const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;
    if(Math.abs(dx)<24||Math.abs(dx)<=Math.abs(dy)*1.2)return;
    swipe.nudged=true;const action=dx<0?'nudgeLeft':'nudgeRight',source=`swipe:${e.pointerId}`;input(action,true,source);input(action,false,source);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>{
    swipes.delete(e.pointerId);
    if(type==='pointerup')input(button.dataset.input,false,`pointer:${e.pointerId}`);
    else if(sources.has(`pointer:${e.pointerId}`))release();
  });
  // Keyboard and assistive-technology activation of the semantic buttons.
  button.addEventListener('click',e=>{if(e.detail===0){input(button.dataset.input,true,'button');input(button.dataset.input,false,'button');}});
  button.addEventListener('contextmenu',e=>e.preventDefault());
}
window.addEventListener('keydown',e=>{
  if(rebinding){
    e.preventDefault();
    if(e.code==='Escape'){rebinding=null;bindings();return;}
    if(e.ctrlKey||e.altKey||e.metaKey||/^F\d+$|^Browser|^PrintScreen$/.test(e.code)||['Tab','MetaLeft','MetaRight','ControlLeft','ControlRight','AltLeft','AltRight'].includes(e.code)){$('binding-status').textContent='Choose a key without a browser shortcut.';return;}
    if(keys[e.code]&&keys[e.code]!==rebinding){$('binding-status').textContent='That key is already in use.';return;}
    for(const [code,action]of Object.entries(keys))if(action===rebinding)delete keys[code];keys[e.code]=rebinding;rebinding=null;
    save('bindings',JSON.stringify(Object.fromEntries(Object.entries(keys).map(([code,action])=>[action,code]))));$('binding-status').textContent='Binding saved.';bindings();return;
  }
  if(e.target.closest?.('button,input,select,summary')||$('controls-panel').open||$('initials-dialog').open||e.ctrlKey||e.metaKey||e.altKey)return;
  if(keys[e.code]&&!e.repeat){e.preventDefault();input(keys[e.code],true,`key:${e.code}`);}
});
window.addEventListener('keyup',e=>{if(keys[e.code]){e.preventDefault();input(keys[e.code],false,`key:${e.code}`);}});
function pause(value){paused=value;if(view)game?.setPaused(value);}
window.addEventListener('blur',()=>{release();pause(true);});
window.addEventListener('focus',()=>pause($('controls-panel').open||document.hidden));
document.addEventListener('visibilitychange',()=>{release();pause(document.hidden||$('controls-panel').open);});
window.addEventListener('orientationchange',release);
$('settings').onclick=()=>{release();pause(true);};
$('controls-panel').addEventListener('close',()=>{pause(document.hidden);$('table').focus({preventScroll:true});});
$('controls-panel').addEventListener('toggle',()=>{release();pause($('controls-panel').open||document.hidden);});
$('initials-dialog').addEventListener('close',()=>$('table').focus({preventScroll:true}));
$('play').onclick=()=>{release();audio?.unlock();$('play').disabled=true;$('play').textContent='Starting game…';game?.start(selectedPlayers());};
$('camera').value=read('camera','balanced');$('quality').value=read('quality','auto');
if($('camera').value==='')$('camera').value='balanced';
const cameraMode=()=>$('camera').value;
for(const name of ['camera','quality'])$(name).onchange=()=>{save(name,$(name).value);if(name==='camera')view?.applyPlayerCamera(cameraMode());};
$('apply-graphics').onclick=async()=>{release();save('quality',$('quality').value);try{await game?.flush();}catch{}location.reload();};
$('sound').onclick=async()=>{
  try{
    await audio?.unlock();audio?.setMuted(!audio.muted);
    $('sound').textContent=audio.muted?'Sound off':'Sound on';$('sound').setAttribute('aria-pressed',String(!audio.muted));
  }catch{message('Audio unavailable in this browser.');}
};
$('fullscreen').onclick=async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else throw Error('unsupported');}
  catch{message('Full screen unavailable. You can use Add to Home Screen.');$('screen-note').textContent='This browser cannot enter full screen here. On iPhone, use Safari’s Add to Home Screen for a standalone view.';}
};
document.addEventListener('fullscreenchange',()=>{release();document.body.classList.toggle('fullscreen-play',!!document.fullscreenElement);$('fullscreen').setAttribute('aria-pressed',String(!!document.fullscreenElement));$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen');});

async function frame(now){
  try{await drawFrame(now);}catch(error){
    console.error(error);try{release();pause(true);}catch{}paused=true;
    $('overlay').hidden=false;$('load-status').textContent='The game stopped. Reload to restart.';
    $('play').disabled=false;$('play').textContent='Reload game';$('play').onclick=()=>location.reload();message('Game stopped');
  }
}
async function drawFrame(now){
  if(game.error)throw game.error;
  game.setPaused(paused);
  // VPX updates target motion and its rule events in PrepareFrame. Wait for
  // that ordered worker snapshot before drawing the corresponding frame.
  await game.prepareSubmissionFrame();
  // Hold prepared visual state while submitting later physical ball data.
  // Physics keeps running; queued snapshots become visible after the draw.
  try{view.render(1);display?.draw();}finally{game.finishSubmissionFrame();}
  if(game.gameState)leaderboard?.state(game.gameState);
  $('score').textContent=game.score.toLocaleString();$('ball-number').textContent=game.ballNumber||'—';
  const power=Math.round(game.charge/1.2*100);
  $('charge').classList.toggle('active',power>0);$('charge').setAttribute('aria-valuenow',String(power));$('charge').firstElementChild.style.height=`${power}%`;
  $('launch').disabled=game.state!=='playing'||!game.inLane;
  document.body.classList.toggle('game-in-play',game.state==='playing');
  document.body.classList.toggle('ball-in-plunger',game.inLane);
  if(game.state==='playing'&&game.time>messageUntil)message(game.tilted?'Tilt · flippers disabled':game.inLane?'Hold Launch, then release.':game.rules.value('bChooseBattle')?'Flippers choose · Action confirms':`Player ${game.player}`,30);
  frames++;
  if(now-sampleStart>1500){
    const fps=Math.round(frames*1000/(now-sampleStart));frames=0;sampleStart=now;
    $('metrics').textContent=`Three.js · ${fps} FPS · ${view.renderer.info.render.calls} draw calls`;
  }
  requestAnimationFrame(frame);
}

async function boot(){
  try{
    const base=import.meta.env.BASE_URL;
    const load=async(name,json=true)=>{const response=await fetch(`${base}${name}`);if(!response.ok)throw Error(`${name} could not be loaded.`);return json?response.json():response.text();};
    const manifest=await load('audio.json');
    audio=createAudio(manifest,base);game=await createRuntimeGame(base,event,audio);
    leaderboard=createLeaderboard(statement=>game.rules.execute(statement),release);
    display=await createDisplay($('dmd'),game.rules.objects,base);
    $('load-status').textContent='Loading artwork and table model…';
    const quality=$('quality').value==='auto'?(matchMedia('(max-width:650px), (pointer:coarse) and (max-width:1024px)').matches?'performance':'detailed'):$('quality').value;
    view=await createView($('table'),game,{quality});view.applyPlayerCamera(cameraMode());
    const seconds=((performance.now()-startTime)/1000).toFixed(1);
    $('load-status').textContent=`Ready in ${seconds}s. Hold Launch, then release to shoot.`;
    $('play').disabled=false;$('play').textContent='Start game';$('progress').hidden=true;message('Ready to play');
    sampleStart=performance.now();
    if(import.meta.env.DEV)window.finniThree={game,view,release};
    $('table').addEventListener('webglcontextlost',e=>{e.preventDefault();pause(true);release();$('load-status').textContent='Graphics were interrupted. Reload to restart.';$('overlay').hidden=false;$('play').textContent='Reload game';$('play').onclick=()=>location.reload();});
    requestAnimationFrame(frame);
  }catch(error){
    console.error(error);$('load-status').textContent=`Unable to load: ${error.message}`;
    $('play').disabled=false;$('play').textContent='Retry';$('play').onclick=()=>location.reload();message('Game unavailable');
  }
}
boot();
