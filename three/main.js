import {createRuntimeGame} from './game-runtime.js';
import {createView} from './scene.js';
import {createAudio,createDisplay} from './media.js';
import {createLeaderboard} from '../browser/leaderboard.js';
import {createMusic} from '../browser/music.js';
import {prepareUI} from './ui.js';
import {createPlayerFullscreen} from './player-fullscreen.js';

const $=prepareUI({release,focusGame});
let game,view,audio,display,leaderboard,paused=true,frames=0,sampleStart=0;
let tableSupportsBrowserMusic=false,browserMusicActivated=false,startingGame=false,musicTrack='',musicVolume=0;
const music=createMusic(error=>message(`Soundtrack: ${error}`),{base:import.meta.env.BASE_URL+'music/'});
function syncMusic(){music.select(musicTrack,audio?.muted?0:musicVolume);}
function musicLog(line){
  if(String(line).includes('FINNI_MUSIC_READY')){tableSupportsBrowserMusic=true;return;}
  const soundtrack=String(line).match(/FINNI_MUSIC\|(mu_[a-z0-9]+)?\|(\d+(?:\.\d+)?)/);
  if(soundtrack){musicTrack=soundtrack[1]??'';musicVolume=Number(soundtrack[2]);syncMusic();}
}
const sources=new Map(),swipes=new Map(),pointers=new Map(),physical=new Set(),buttons=[...document.querySelectorAll('[data-input]')];
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
    button.onclick=()=>{release();rebinding=action;button.textContent='Press a key';};row.append(text,button);$('bindings').append(row);
  }
  for(const button of buttons){const hint=button.querySelector('kbd');if(hint)hint.textContent=(Object.keys(keys).find(k=>keys[k]===button.dataset.input)||'').replace(/^Key|^Digit/,'').replace('ShiftLeft','L Shift').replace('ShiftRight','R Shift');}
}
bindings();
$('reset-bindings').onclick=()=>{release();for(const code of Object.keys(keys))delete keys[code];Object.assign(keys,defaultKeys);save('bindings','null');$('latch').checked=false;save('latch','false');bindings();};
$('release').onclick=release;
function rotateScreen(enabled){release();document.body.classList.toggle('portrait-rotated',enabled);$('portrait').setAttribute('aria-pressed',String(enabled));save('portrait',String(enabled));requestAnimationFrame(focusGame);}
$('portrait').onclick=()=>rotateScreen(!document.body.classList.contains('portrait-rotated'));
rotateScreen(read('portrait','false')==='true');
function message(text,seconds=3){$('message').textContent=text;messageUntil=(game?.time||0)+seconds;}
function event(e){
  if(e.type==='shake')view?.shake(e.strength);
  const lines={start:'Hold Launch, then release.',tilt:'Tilt · flippers disabled',over:'Game over'};
  if(lines[e.type])message(lines[e.type]);
  if(e.type==='message')message(e.text);
  if(e.type==='start'){if(!startingGame)pause(false);$('overlay').hidden=true;$('play').disabled=false;$('player-count').disabled=true;document.body.classList.add('playing');$('table').focus({preventScroll:true});}
  if(e.type==='over'){
    $('player-count').disabled=false;$('play').disabled=false;
    release();document.body.classList.remove('playing');$('overlay').hidden=false;
    $('load-status').textContent=`Final score: ${game.score.toLocaleString()}`;$('play').textContent='Play again';
  }
}
function input(action,down,source){
  if(action==='start'){
    if(down&&!$('overlay').hidden&&!$('play').disabled&&!$('initials-dialog').open)$('play').click();
    return;
  }
  if(!game||paused)return;
  if(down&&(!$('overlay').hidden||$('initials-dialog').open||document.querySelector('.panel:popover-open')))return;
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
function paint(){for(const b of buttons){const held=[...sources.values()].includes(b.dataset.input);b.classList.toggle('pressed',held);b.classList.toggle('held',held);b.setAttribute('aria-pressed',String(held));}}
function release(){sources.clear();swipes.clear();pointers.clear();physical.clear();game?.release();paint();}
function focusGame(){if(game&&view&&game.state!=='ready'&&!$('initials-dialog').open&&!document.querySelector('.panel:popover-open'))$('table').focus({preventScroll:true});}
function finishPointer(event,cancelled=false){
  swipes.delete(event.pointerId);
  const action=pointers.get(event.pointerId);if(!action)return;
  pointers.delete(event.pointerId);
  if(cancelled&&$('latch').checked&&['left','right'].includes(action)){
    if(sources.delete(`latched:${action}`))game?.input(action,false);paint();
  }else input(action,false,`pointer:${event.pointerId}`);
}
window.addEventListener('pointerup',event=>finishPointer(event));
window.addEventListener('pointercancel',event=>finishPointer(event,true));
for(const button of buttons){
  for(const type of ['touchstart','touchend'])button.addEventListener(type,e=>e.preventDefault(),{passive:false});
  button.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();try{button.setPointerCapture(e.pointerId);}catch{}
    pointers.set(e.pointerId,button.dataset.input);
    audio?.unlock();input(button.dataset.input,true,`pointer:${e.pointerId}`);
    if(['touch','pen'].includes(e.pointerType)&&button.parentElement===$('flip-zones')&&[...sources.values()].includes(button.dataset.input))swipes.set(e.pointerId,{x:e.clientX,y:e.clientY,nudged:false});
  });
  button.addEventListener('pointermove',e=>{
    const swipe=swipes.get(e.pointerId);if(!swipe||swipe.nudged)return;
    const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;
    if(Math.abs(dx)<24||Math.abs(dx)<=Math.abs(dy)*1.2)return;
    swipe.nudged=true;const action=dx<0?'nudgeLeft':'nudgeRight',source=`swipe:${e.pointerId}`;input(action,true,source);input(action,false,source);
  });
  button.addEventListener('pointerup',event=>finishPointer(event));
  for(const type of ['pointercancel','lostpointercapture'])button.addEventListener(type,event=>finishPointer(event,true));
  button.addEventListener('keydown',e=>{if(['Enter','Space'].includes(e.code)){e.preventDefault();if(!e.repeat)input(button.dataset.input,true,`button:${e.code}`);}});
  button.addEventListener('keyup',e=>{if(['Enter','Space'].includes(e.code)){e.preventDefault();input(button.dataset.input,false,`button:${e.code}`);}});
  // Keyboard and assistive-technology activation of the semantic buttons.
  button.addEventListener('click',e=>{if(e.detail===0){input(button.dataset.input,true,'button');input(button.dataset.input,false,'button');}});
  button.addEventListener('contextmenu',e=>e.preventDefault());
}
window.addEventListener('keydown',e=>{
  if(rebinding){
    e.preventDefault();
    if(e.repeat)return;
    if(e.code==='Escape'){rebinding=null;bindings();return;}
    if(e.ctrlKey||e.altKey||e.metaKey||/^F\d+$|^Browser|^PrintScreen$/.test(e.code)||['Tab','MetaLeft','MetaRight','ControlLeft','ControlRight','AltLeft','AltRight'].includes(e.code)){$('binding-status').textContent='Choose a key without a browser shortcut.';return;}
    if(keys[e.code]&&keys[e.code]!==rebinding){$('binding-status').textContent='That key is already in use.';return;}
    for(const [code,action]of Object.entries(keys))if(action===rebinding)delete keys[code];keys[e.code]=rebinding;rebinding=null;
    save('bindings',JSON.stringify(Object.fromEntries(Object.entries(keys).map(([code,action])=>[action,code]))));$('binding-status').textContent='Binding saved.';bindings();return;
  }
  if(e.target.closest?.('button,input,select,summary')||document.querySelector('.panel:popover-open')||$('initials-dialog').open||e.ctrlKey||e.metaKey||e.altKey)return;
  if(keys[e.code]){e.preventDefault();if(physical.has(e.code))return;physical.add(e.code);input(keys[e.code],true,`key:${e.code}`);}
});
window.addEventListener('keyup',e=>{if(!physical.delete(e.code))return;if(keys[e.code]){e.preventDefault();input(keys[e.code],false,`key:${e.code}`);}});
function pause(value){value=!!value||!game||game.state==='ready';paused=value;if(view)game?.setPaused(value);}
window.addEventListener('blur',()=>{release();pause(true);});
window.addEventListener('focus',()=>pause(document.hidden));
document.addEventListener('visibilitychange',()=>{if(document.hidden)release();pause(document.hidden);});
window.addEventListener('pagehide',release);
window.addEventListener('orientationchange',release);
window.addEventListener('resize',release);
$('settings').onclick=release;
$('controls-panel').addEventListener('close',focusGame);
$('controls-panel').addEventListener('toggle',release);
for(const panel of document.querySelectorAll('.panel'))panel.addEventListener('toggle',e=>{if(e.newState==='closed')focusGame();});
$('initials-dialog').addEventListener('close',focusGame);
const fullscreen=createPlayerFullscreen({release,focusGame});
$('play').onclick=async()=>{
  if($('play').disabled||startingGame||$('initials-dialog').open)return;
  release();const browserMusic=music.unlock();startingGame=true;
  // Resume the native context in the gesture without draining initialization.
  const activated=audio?.unlock();$('play').disabled=true;$('play').textContent='Starting game…';
  try{
    if(matchMedia('(pointer:coarse) and (max-width:1024px)').matches)void fullscreen.set(true);
    const handoff=browserMusic&&tableSupportsBrowserMusic&&!browserMusicActivated;
    await game.prepareStart(selectedPlayers(),{browserMusic:handoff});if(handoff)browserMusicActivated=true;
    await activated;await audio?.start();startingGame=false;pause(false);
  }catch(error){startingGame=false;music.select('');$('load-status').textContent=`Unable to start: ${error.message}`;$('play').disabled=false;$('play').textContent='Reload game';$('play').onclick=()=>location.reload();}
};
$('camera').value=read('camera','balanced');$('quality').value=read('quality','auto');
if($('camera').value==='')$('camera').value='balanced';
const cameraMode=()=>$('camera').value;
$('camera').onchange=()=>{release();view?.applyPlayerCamera(cameraMode());save('camera',cameraMode());focusGame();};
$('quality').onchange=()=>save('quality',$('quality').value);
$('apply-graphics').onclick=async()=>{release();save('quality',$('quality').value);try{await game?.flush();}catch{}location.reload();};
$('sound').onclick=async()=>{
  if(!audio)return;
  try{
    await audio?.unlock();audio?.setMuted(!audio.muted);syncMusic();
    $('sound').textContent=audio.muted?'Sound off':'Sound on';$('sound').setAttribute('aria-pressed',String(!audio.muted));
  }catch{message('Audio unavailable in this browser.');}
};

async function frame(now){
  try{await drawFrame(now);}catch(error){
    console.error(error);music.select('');try{release();pause(true);}catch{}paused=true;
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
    const browserMusicSupported=!!document.createElement('audio').canPlayType('audio/mpeg');
    audio=createAudio(manifest,base,{deferInitialization:true,sourceBank:true,prepareAllMusic:!browserMusicSupported});
    // Register the flipper sources alongside loading without activating audio.
    // Effects are ready before Start; native music is also ready for browsers
    // that cannot use main's continuous MPEG player.
    void audio.prepare(['fx_flipperup','fx_flipperdown']);
    game=await createRuntimeGame(base,event,{...audio,log:musicLog});
    music.preload();
    leaderboard=createLeaderboard(statement=>game.rules.execute(statement),release);
    $('load-status').textContent='Loading artwork and table model…';
    const quality=$('quality').value==='auto'?(matchMedia('(max-width:650px), (pointer:coarse) and (max-width:1024px)').matches?'performance':'detailed'):$('quality').value;
    [display,view]=await Promise.all([createDisplay($('dmd'),game.rules.objects,base),createView($('table'),game,{quality}),audio.prepareSources(),audio.whenInitialized(),audio.prepare(['fx_gion','fx_gioff'])]);view.applyPlayerCamera(cameraMode());
    const seconds=((performance.now()-startTime)/1000).toFixed(1);
    $('load-status').textContent=`Ready in ${seconds}s. Hold Launch, then release to shoot.`;
    $('play').disabled=false;$('play').textContent='Start game';$('progress').hidden=true;message('Ready to play');
    sampleStart=performance.now();
    if(import.meta.env.DEV)window.finniThree={game,view,release};
    $('table').addEventListener('webglcontextlost',e=>{e.preventDefault();pause(true);release();$('load-status').textContent='Graphics were interrupted. Reload to restart.';$('overlay').hidden=false;$('play').textContent='Reload game';$('play').onclick=()=>location.reload();});
    requestAnimationFrame(frame);
  }catch(error){
    console.error(error);music.select('');$('load-status').textContent=`Unable to load: ${error.message}`;
    $('play').disabled=false;$('play').textContent='Retry';$('play').onclick=()=>location.reload();message('Game unavailable');
  }
}
boot();
