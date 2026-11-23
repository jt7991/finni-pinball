// Scores come from the real table. The server validates sessions; it cannot
// prove that browser-side simulation was unmodified.
export function createLeaderboard(evaluate, release) {
  const $=id=>document.getElementById(id);
  let run=null, starting=null, wasPlaying=false, nativePrompt=false, collecting=false;
  let names=new Map(), finalScores=[], current=null, generation=0, saving=false;
  const nameStorageKey='finni-player-names';
  let rememberedNames={};
  try{
    const stored=JSON.parse(localStorage.getItem(nameStorageKey));
    for(let player=1;player<=4;player++){
      if(typeof stored?.[player]==='string'&&/^[A-Z0-9]{1,12}$/.test(stored[player]))rememberedNames[player]=stored[player];
    }
  }catch{} // Storage may be unavailable; score entry still works.

  async function api(path, data){
    const response=await fetch(`/api/${path}`,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(12000)});
    if(!response.ok){let error;try{error=(await response.json()).message;}catch{}throw Error(error||'The leaderboard is unavailable. Try again.');}
    return response.json();
  }
  async function refresh(){
    $('leaderboard-status').textContent='Loading high scores…';
    try{
      const {items}=await api('leaderboard');$('leaderboard-rows').replaceChildren();
      items.forEach((entry,index)=>{const row=document.createElement('tr');for(const value of [index+1,entry.initials,Number(entry.score).toLocaleString()]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}$('leaderboard-rows').append(row);});
      $('leaderboard-table').hidden=!items.length;$('leaderboard-status').textContent=items.length?'':'No scores yet. Play a game to submit a score.';
    }catch(error){$('leaderboard-table').hidden=true;$('leaderboard-status').textContent=error.message;}
  }
  $('refresh-scores').onclick=refresh;
  $('leaderboard-panel').addEventListener('toggle',e=>{if(e.newState==='open'){release();refresh();}});
  $('controls-panel').addEventListener('toggle',e=>{if(e.newState==='open')release();});

  function prompt(entry,native){
    if($('initials-dialog').open)return;
    release();current={...entry,native};
    $('final-score').textContent=`Player ${entry.player} · ${entry.score.toLocaleString()} points`;
    $('initials').value=names.get(entry.player)||rememberedNames[entry.player]||'';$('submit-status').textContent='';
    $('skip-score').disabled=false;$('save-score').disabled=false;$('save-score').textContent=native?'Continue':'Save score';
    $('initials-dialog').showModal();$('initials').focus();$('initials').select();
  }
  function commitNative(initials){
    // Feed initials through the table's existing entry handler, with fixed,
    // validated characters only. This retains its score sorting/end-ball flow.
    const text=initials.slice(0,3).padEnd(3,' ');
    evaluate('hsCurrentDigit=0:'+text.split('').map(char=>`hsCurrentLetter=InStr(hsValidLetters,"${char}"):Table1_KeyDown PlungerKey`).join(':'));
  }
  function showScores(){
    release();$('leaderboard-panel').showPopover();
  }
  async function finish(){
    if(saving)return;
    if(!finalScores.length){collecting=false;showScores();return;}
    const next=finalScores.find(entry=>!names.has(entry.player));
    if(next){$('initials-dialog').close();prompt(next,false);return;}
    if(!$('initials-dialog').open)prompt(finalScores[0],false);
    saving=true;$('skip-score').disabled=true;$('save-score').disabled=true;$('submit-status').textContent='Saving…';
    try{
      if(starting)await starting;
      if(!run)throw Error('No online session was available for this game. This score could not be saved.');
      await api('scores',{...run,scores:finalScores.map(entry=>({...entry,initials:names.get(entry.player)}))});
      collecting=false;run=null;finalScores=[];$('initials-dialog').close();
      current=null;showScores();
    }catch(error){$('submit-status').textContent=error.message;$('save-score').disabled=false;$('save-score').textContent='Retry saving';}
    finally{saving=false;$('skip-score').disabled=false;}
  }
  $('initials').addEventListener('input',()=>{$('initials').value=$('initials').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);});
  $('initials-form').onsubmit=e=>{
    e.preventDefault();const initials=$('initials').value.trim().toUpperCase();if(saving||!/^[A-Z0-9]{1,12}$/.test(initials)||!current)return;
    names.set(current.player,initials);
    rememberedNames[current.player]=initials;
    try{localStorage.setItem(nameStorageKey,JSON.stringify(rememberedNames));}catch{}
    if(current.native){commitNative(initials);$('initials-dialog').close();current=null;}
    else{finish();}
  };
  function skip(){
    if(saving)return;
    const native=current?.native;
    if(native)commitNative('YOU');
    else{collecting=false;finalScores=[];run=null;}
    current=null;$('initials-dialog').close();
    if(!native)showScores();
  }
  $('skip-score').onclick=skip;$('initials-dialog').addEventListener('cancel',e=>{e.preventDefault();skip();});

  function state(s){
    if(s.playing&&!wasPlaying){
      const version=++generation;names=new Map();run=null;finalScores=[];collecting=false;
      starting=api('runs',{}).then(result=>{if(version===generation)run={run:result.id,token:result.token};}).catch(()=>{}).finally(()=>{starting=null;});
    }
    if(s.playing&&s.entering&&!nativePrompt){prompt({player:s.player,score:s.scores[s.player-1]},true);}
    nativePrompt=s.entering;
    if(!s.playing&&wasPlaying&&!collecting){
      collecting=true;finalScores=s.scores.slice(0,s.players).map((score,index)=>({player:index+1,score})).filter(entry=>entry.score>0);
      finish();
    }
    wasPlaying=s.playing;
  }
  return {state};
}
