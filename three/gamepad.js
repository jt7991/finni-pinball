// Match master's Standard Gamepad mapping. Input ownership stays in the player
// so disconnecting a controller cannot release a keyboard/touch-held flipper.
export const gamepadBindings=[
  ['left',[4,6]],['right',[5,7]],['launch',[0]],['action',[2]],
  ['nudgeLeft',[14]],['nudgeForward',[12]],['nudgeRight',[15]],['start',[9]],
];
export function createGamepadControls({input,releaseSource,releaseAll,host=window,doc=document,nav=navigator}){
  const pressedByPad=new Map();let focusLost=false;
  function disconnect(index){
    if(pressedByPad.delete(index))releaseSource(`gamepad:${index}`);
  }
  function sample(){
    if(doc.hidden||!doc.hasFocus())return;
    let pads;
    try{pads=nav.getGamepads();}catch{for(const index of pressedByPad.keys())disconnect(index);return;}
    for(const index of pressedByPad.keys())if(!pads[index]?.connected||pads[index].mapping!=='standard')disconnect(index);
    for(const pad of pads){
      if(!pad?.connected||pad.mapping!=='standard')continue;
      const pressed=pressedByPad.get(pad.index)||new Set();pressedByPad.set(pad.index,pressed);
      for(const [action,buttons]of gamepadBindings){
        const down=buttons.some(index=>pad.buttons[index]?.pressed);
        if(down===pressed.has(action))continue;
        if(down)pressed.add(action);else pressed.delete(action);
        // Already-held buttons on refocus must be released and pressed anew.
        if(!down||!focusLost)input(action,down,`gamepad:${pad.index}`);
      }
    }
    focusLost=false;
  }
  const loseFocus=()=>{focusLost=true;releaseAll();};
  const visibility=()=>{if(doc.hidden)loseFocus();};
  const disconnected=event=>disconnect(event.gamepad.index);
  let frame,disposed=false;
  function poll(){if(disposed)return;sample();frame=host.requestAnimationFrame(poll);}
  if(typeof nav.getGamepads==='function'){
    host.addEventListener('gamepaddisconnected',disconnected);
    host.addEventListener('blur',loseFocus);host.addEventListener('pagehide',loseFocus);
    doc.addEventListener('visibilitychange',visibility);frame=host.requestAnimationFrame(poll);
  }
  return {sample,dispose(){disposed=true;host.cancelAnimationFrame(frame);for(const index of pressedByPad.keys())disconnect(index);host.removeEventListener('gamepaddisconnected',disconnected);host.removeEventListener('blur',loseFocus);host.removeEventListener('pagehide',loseFocus);doc.removeEventListener('visibilitychange',visibility);}};
}
