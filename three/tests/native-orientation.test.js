import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {NativeOrientation} from '../native-orientation.js';

test('native matrix integration preserves handedness, identity and the reflected render rotation',()=>{
  const rotation=new NativeOrientation();rotation.advance({x:0,y:0,z:0},250,.001);
  assert.deepEqual([...rotation.matrix],[1,0,0,0,1,0,0,0,1]);assert.deepEqual(rotation.rotation(),{x:0,y:0,z:0,w:1});
  rotation.advance({x:250,y:0,z:0},250,.01);
  const q=rotation.rotation();assert.ok(q.x<0,'VPX X spin reflects into negative world X');assert.ok(q.y===0&&q.z===0);assert.ok(Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)<1e-15);
});

test('the direct native displacement path retains every measured ball orientation matrix bit for bit',()=>{
  const [report]=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-target-events.mjs','three/tests/fixtures/vpx-orientation-native-state.json','--check','--json','--body-audit','--report=.work/three-review/orientation-regression-comparison.json'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:3*1024*1024}));
  const bodies=report.nativeBodyAudit.flatMap(frame=>frame.bodies);assert.equal(bodies.length,204);
  for(const body of bodies){assert.equal(body.orientationError,0);assert.equal(body.positionError,0);assert.ok(body.velocityError<2e-9);}
  assert.ok(report.nativeRandomAudit.every(row=>row.agrees));
});
