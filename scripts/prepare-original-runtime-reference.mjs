// Reuse diagnostic callbacks through the native runtime evaluator. The original
// VPX table bytes, material scatter and authored object settings stay intact.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [sourceRoot,output]=process.argv.slice(2);
assert.ok(sourceRoot&&output,'Supply read-only original checkout and a new metadata filename');
assert.equal(fs.existsSync(output),false,'Do not replace a running reference');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const template=JSON.parse(fs.readFileSync('.work/vpx-animation-frame-rng-reference/metadata.json'));
const instrumented=fs.readFileSync('.work/vpx-animation-frame-rng-reference/extracted/script.vbs','utf8').replaceAll('\r\n','\n');
const authored=fs.readFileSync('three/public/rules.vbs','utf8').replaceAll('\r\n','\n');
const sub=(source,name)=>{const matches=source.match(new RegExp('^Sub '+name+'\\b[^\\n]*\\n[\\s\\S]*?^End Sub','gmi'));assert.equal(matches?.length,1,name);return matches[0];};
const original=sub(authored,'LeftFlipper_Timer'),observed=sub(instrumented,'LeftFlipper_Timer');
const first=observed.indexOf('\n')+1,begin=observed.indexOf("    'Start Of Stroke"),end=observed.indexOf('    If RefTraceOn And RefStateTraceOn');
const prolog=observed.slice(first,begin),epilog=observed.slice(end,observed.lastIndexOf('End Sub'));
assert.equal(observed.replace(prolog,'').replace(epilog,''),original,'Every authored flipper timer statement is preserved byte-for-byte');
const rolling=sub(instrumented,'RollingTimer_Timer'),rollingMarker='    If RefTraceOn Then RefTrace=RefTrace & "ROLL|" & GameTime & ";"\n';
assert.equal(rolling.replace(rollingMarker,''),sub(authored,'RollingTimer_Timer'),'Every authored rolling timer statement is preserved byte-for-byte');
const declarations=instrumented.slice(instrumented.indexOf('\nDim RefTraceOn,RefTrace')).trim();
assert.ok(declarations.endsWith('RefTrailOn=False'));
assert.ok(!/^Sub Target010_(?:Timer|Hit)\b/mi.test(authored),'Observers occupy previously empty callbacks');
const code=declarations+'\n'+observed+'\n'+rolling+'\nTarget010.TimerInterval=-1:Target010.TimerEnabled=True\n';
const table=fs.readFileSync(sourceRoot+'/runtime/Finni-Big-Day.vpx'),tableSHA256=sha(table);
assert.equal(tableSHA256,template.sourceSha256,'Original source table, not the zero-scatter copy');
const metadata={engine:template.engine,upstreamCommit:template.upstreamCommit,nativePhysicsMaxLoops:template.nativePhysicsMaxLoops,sourceSha256:tableSHA256,controlledSha256:tableSHA256,controlledOverrides:{},instrumentation:template.instrumentation,runtimeMarkers:{code,authoredHandlerSHA256:sha(original),observedHandlerSHA256:sha(observed),tableSHA256,scope:'Original table file served byte-for-byte. Diagnostic declarations installed after ordinary startup through the native evaluator. LeftFlipper_Timer retains every original statement, with the same existing marker/input/history observers used by zero-scatter captures. Previously unused Target010 frame timer is enabled at runtime for read-only animation observations. No table/material/object scatter fields, geometry, engine instructions, clocks or random results are replaced. This is a post-initialization gameplay reference, not a startup-equivalence claim.'}};
fs.writeFileSync(output,JSON.stringify(metadata,null,2));
console.log(JSON.stringify({output,tableSHA256,codeBytes:Buffer.byteLength(code),authoredHandlerSHA256:metadata.runtimeMarkers.authoredHandlerSHA256}));
