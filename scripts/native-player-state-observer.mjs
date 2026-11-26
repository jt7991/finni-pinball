// Read-only authored state for continuous multiplayer reference recordings.
export const playerStateFields={player:'CurrentPlayer',players:'PlayersPlayingGame',ball:'Balls',playing:'Abs(CLng(bGameInPlay))',choosing:'Abs(CLng(bChooseBattle))',inLane:'Abs(CLng(bBallInPlungerLane))',onPlayfield:'BallsOnPlayfield',queued:'mBalls2Eject',scriptRandom:'CLng(Rnd(0)*16777216)',plungerVisible:'Plunger.Visible'};
for(let i=1;i<=4;i++)for(const[key,array]of Object.entries({score:'Score',remaining:'BallsRemaining',extra:'ExtraBallsAwards',bonus:'BonusPoints',multiplier:'BonusMultiplier',active:'Battle',wins:'BattlesWon'}))playerStateFields[`player${i}_${key}`]=`${array}(${i}${array==='Battle'?',0':''})`;

export function installPlayerStateObserver(fields){
 const data=window.nativePlayerStateObserver={fields,observations:[],errors:[]};let last=-Infinity;
 const timer=setInterval(()=>{try{
  if(nativeGameplay.done){clearInterval(timer);return;}
  const time=nativeStartup.read()?.ms;if(time===undefined||time-last<250)return;last=time;
  const names=Object.keys(fields),expressions=Object.values(fields),script='Debug.Print "PLAYER_STATE|" & GameTime & "|" & '+[...expressions.map(e=>'CStr(CDbl('+e+'))'),...expressions.map(e=>'CStr(VarType('+e+'))')].join(' & "|" & ');
  finni.evaluate(script);const line=document.getElementById('log').textContent.split('\n').findLast(s=>s.includes('PLAYER_STATE|')),match=line&&/PLAYER_STATE\|([\d.eE+|\-]+)/.exec(line);if(!match)throw Error('Missing native player-state observation');
  const numbers=match[1].split('|').map(Number),ms=numbers.shift();if(numbers.length!==names.length*2||numbers.some(v=>!Number.isFinite(v)))throw Error('Invalid native player-state observation');const values=numbers.slice(0,names.length),types=numbers.slice(names.length),input=nativePlayerInputs.at(-1);if(input.script!==script)throw Error('Player observation lost its recorded input');
  if(ms!==input.ms||ms!==time)throw Error('Native player-state marker is stale');
  input.ruleState={names,expressions,values,types,ms};data.observations.push({ms,state:Object.fromEntries(names.map((name,i)=>[name,values[i]]))});
 }catch(error){data.errors.push(String(error));clearInterval(timer);}},16);
}
