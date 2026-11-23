// Explicit diagnostic input driver. Keep the authored native timer body and
// issue ordinary table key events at its measured 1ms callback boundaries.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
export function nativeInputSequence(source,inputs){
 assert.ok(Array.isArray(inputs)&&inputs.length>0&&inputs.length<=100);
 for(const [i,input]of inputs.entries()){
  assert.deepEqual(Object.keys(input).sort(),['action','down','ms']);assert.ok(['left','right'].includes(input.action));assert.equal(typeof input.down,'boolean');assert.ok(Number.isInteger(input.ms)&&input.ms>0);if(i)assert.ok(input.ms>=inputs[i-1].ms);
 }
 const names=['LeftFlipper_Timer','RollingTimer_Timer','LeftFlipper_Collide','RightFlipper_Collide'],originals=names.map(name=>{const matches=source.match(new RegExp('^Sub '+name+'\\b[\\s\\S]*?^End Sub','gmi'));assert.equal(matches?.length,1);return matches[0];});
 const handlers=originals.map((body,i)=>{
  if(i>1){const logger=`    If RefTraceOn Then Debug.Print "GAME_FLIPPER|" & GameTime & "|${i===2?'left':'right'}|" & CStr(CDbl(parm)) & "|" & ActiveBall.ID`,result=body.replace(/\r?\n/,match=>match+logger+match);assert.equal(result.replace(logger+'\n','').replace(logger+'\r\n',''),body);return result;}
  const marker=`If RefTraceOn Then RefTrace=RefTrace & "${i?'ROLL':'FLIP'}|" & GameTime & ";"`,bounded=marker.replace('If RefTraceOn Then','If RefTraceOn And GameTime<=RefTraceUntil Then');assert.equal(body.split(marker).length,2);
  let result=body.replace(marker,bounded);if(i===0)result=result.replace(/\r?\n/,match=>match+'    RefInputAdvance'+match);
  assert.equal(result.replace('    RefInputAdvance\n','').replace('    RefInputAdvance\r\n','').replace(bounded,marker),body,'only diagnostic input call and trace bound alter the original handler');return result;
 });
 const code=`Dim RefInputStart,RefInputIndex,RefInputTimes,RefInputActions,RefInputDowns
RefInputStart=-1:RefInputIndex=0
RefInputTimes=Array(${inputs.map(input=>input.ms)})
RefInputActions=Array(${inputs.map(input=>input.action==='left'?'LeftFlipperKey':'RightFlipperKey')})
RefInputDowns=Array(${inputs.map(input=>input.down?'True':'False')})
Sub RefInputAdvance
 If RefTraceOn And RefInputStart>=0 Then
  Do While RefInputIndex<=UBound(RefInputTimes)
   If GameTime-RefInputStart<RefInputTimes(RefInputIndex) Then Exit Do
   Debug.Print "GAME_INPUT|" & GameTime & "|" & RefInputIndex & "|" & RefInputActions(RefInputIndex)
   If RefInputDowns(RefInputIndex) Then
    Table1_KeyDown RefInputActions(RefInputIndex)
   Else
    Table1_KeyUp RefInputActions(RefInputIndex)
   End If
   RefInputIndex=RefInputIndex+1
  Loop
 End If
End Sub
Sub PulseTimer_Timer
 If RefTraceOn Then Debug.Print "GAME_PULSE|" & GameTime & "|before"
 vpmTimer.Update
 If RefTraceOn Then Debug.Print "GAME_PULSE|" & GameTime & "|after"
End Sub
${handlers.join('\n')}`;
 return {code,inputs,originalHandlers:originals.map((code,i)=>({name:names[i],code,sha256:createHash('sha256').update(code).digest('hex')})),scope:'Ordinary authored Table1_KeyDown/KeyUp in the native existing 1ms flipper timer, with each actual clock/key observed before dispatch. Original authored timer and Collide bodies preserved; Collide logging only reads the original callback arguments. The generated PulseTimer handler retains its sole original vpmTimer.Update with read-only log markers around it. Only diagnostic FLIP/ROLL string accumulation is bounded by the existing RefTraceUntil window to avoid unbounded trace overhead. No physics clocks, states or RNG results replaced.'};
}
