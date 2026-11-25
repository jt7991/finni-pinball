// Match browser/app.js's main-player fullscreen API and toolbar lifecycle.
export function createPlayerFullscreen({release,focusGame}){
  const button=document.getElementById('fullscreen'),note=document.getElementById('screen-message');
  let pending=false,toolbarTimer,messageTimer;
  const active=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
  function message(text){
    note.textContent=text;note.hidden=false;clearTimeout(messageTimer);
    messageTimer=setTimeout(()=>{note.hidden=true;},7000);
  }
  function showToolbar(){
    document.body.classList.add('toolbar-visible');clearTimeout(toolbarTimer);
    toolbarTimer=setTimeout(()=>document.body.classList.remove('toolbar-visible'),1600);
  }
  function sync(){
    release();const fullscreen=active();document.body.classList.toggle('fullscreen-play',fullscreen);
    button.setAttribute('aria-pressed',String(fullscreen));button.setAttribute('aria-label',fullscreen?'Exit full screen':'Enter full screen');button.title=fullscreen?'Exit full screen':'Full screen';
    if(fullscreen)note.hidden=true;focusGame();showToolbar();
  }
  async function set(fullscreen){
    if(fullscreen===active()||pending)return;
    pending=true;release();const target=document.documentElement;
    try{
      if(!fullscreen){const exit=document.exitFullscreen||document.webkitExitFullscreen;if(exit)await exit.call(document);}
      else{
        const enter=target.requestFullscreen||target.webkitRequestFullscreen;
        if(!enter){message('This browser does not support full screen for games.');return;}
        if(target.requestFullscreen)await enter.call(target,{navigationUI:'hide'});else await enter.call(target);
      }
      sync();
    }catch{message(`Could not ${fullscreen?'enter':'exit'} full screen. Tap the full screen button to try again.`);}
    finally{pending=false;}
  }
  button.onclick=()=>set(!active());
  for(const name of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(name,sync);
  for(const name of ['fullscreenerror','webkitfullscreenerror'])document.addEventListener(name,()=>{pending=false;message('Could not change full screen. Tap the full screen button to try again.');});
  window.addEventListener('pointermove',event=>{
    const atTop=document.body.classList.contains('portrait-rotated')?event.clientX>innerWidth-24:event.clientY<24;
    if(document.fullscreenElement&&atTop)showToolbar();
  });
  const toolbar=document.querySelector('.toolbar');toolbar.addEventListener('pointerenter',showToolbar);toolbar.addEventListener('focusin',showToolbar);
  return {set};
}
