// Keep the main player's DOM and CSS as the shared visual contract.
export function prepareUI({release=()=>{},focusGame=()=>{}}={}){
  const byId=id=>document.getElementById(id);
  const names={left:'Left flipper',right:'Right flipper',launch:'Launch',start:'Start',action:'Action',nudgeLeft:'Nudge left',nudgeForward:'Nudge up',nudgeRight:'Nudge right'};
  function button(action,parent){
    const b=document.createElement('button');b.textContent=names[action];b.dataset.input=action;b.dataset.action=action;
    b.setAttribute('aria-label',names[action]);if(action==='launch')b.id='launch';parent.append(b);return b;
  }
  for(const action of ['left','start','action','launch','right'])button(action,byId('touch'));
  for(const action of ['nudgeLeft','nudgeForward','nudgeRight'])button(action,byId('nudges'));
  const phone=matchMedia('(max-width:650px), (pointer:coarse) and (max-width:1024px)');
  const picker=byId('camera-view').closest('label'),anchor=document.createComment('camera picker');picker.before(anchor);
  function placeControls(){
    for(const action of ['left','right']){
      const b=document.querySelector(`[data-input=${action}]`);
      (phone.matches?byId('flip-zones'):byId('touch')).append(b);
    }
    const nudge=document.querySelector('[data-input=nudgeForward]');(phone.matches&&byId('nudge-zone')?byId('nudge-zone'):byId('nudges')).append(nudge);
    if(phone.matches){byId('camera-controls').append(picker);picker.classList.add('in-controls');}
    else{anchor.after(picker);picker.classList.remove('in-controls');}
  }
  phone.addEventListener('change',placeControls);placeControls();
  byId('touch').classList.add('flips');
  const panel=byId('controls-panel');
  Object.defineProperty(panel,'open',{get:()=>panel.matches(':popover-open')});
  panel.showModal=()=>panel.showPopover();panel.close=()=>panel.hidePopover();
  panel.addEventListener('toggle',()=>{if(!panel.open)panel.dispatchEvent(new Event('close'));});
  const settings=document.querySelector('nav [popovertarget="controls-panel"]');settings.id='settings';
  const charge=document.createElement('div');charge.id='charge';charge.hidden=true;charge.append(document.createElement('span'));document.querySelector('.screen').append(charge);
  const sound=document.createElement('button');sound.id='sound';sound.textContent='Sound on';sound.setAttribute('aria-pressed','true');byId('controls-panel').querySelector('.panel-actions').append(sound);
  byId('touch-help').onclick=()=>{
    release();
    const visible=document.body.classList.toggle('show-touch-guide');byId('touch-guide').hidden=!visible;byId('touch-help').setAttribute('aria-pressed',String(visible));
    if(!visible)focusGame();
  };
  byId('dismiss-touch-guide').onclick=()=>{document.body.classList.remove('show-touch-guide');byId('touch-guide').hidden=true;byId('touch-help').setAttribute('aria-pressed','false');focusGame();};
  byId('showTouch').onchange=()=>{byId('release').click();for(const id of ['touch','flip-zones','nudge-zone'])if(byId(id))byId(id).hidden=!byId('showTouch').checked;};
  let toolbarTimer;
  const revealToolbar=()=>{document.body.classList.add('toolbar-visible');clearTimeout(toolbarTimer);toolbarTimer=setTimeout(()=>document.body.classList.remove('toolbar-visible'),1600);};
  document.addEventListener('fullscreenchange',revealToolbar);
  document.addEventListener('pointermove',event=>{if(document.fullscreenElement&&(document.body.classList.contains('portrait-rotated')?event.clientX>innerWidth-24:event.clientY<24))revealToolbar();});
  const aliases={table:'canvas',overlay:'waiting','load-status':'loading','ball-number':'ball',camera:'camera-view',quality:'graphics','reset-bindings':'reset','binding-status':'message','screen-note':'screen-message',metrics:'status'};
  return id=>byId(aliases[id]??id);
}
