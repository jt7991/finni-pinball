// Preserve a complete independent recording, with strict all-body/RNG gates.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';
const [input,output]=process.argv.slice(2);assert.ok(input&&output,'Supply capture and compressed fixture paths');
const bytes=fs.readFileSync(input),fixture=JSON.parse(bytes);assert.equal(fixture.probeKind,'spinners');assert.equal(fixture.cases.length,1);assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
const scenario=fixture.cases[0],frames=scenario.samples.at(-1)[0];assert.ok(scenario.initialBallTrails?.length===10);assert.ok(scenario.initialNativeInternals?.plunger);assert.ok(scenario.initialNativeInternals.balls.every(b=>b.orientation?.length===9));assert.ok(Number.isInteger(scenario.initialScriptRandom));
for(let i=0;i<frames;i++){const row=scenario.nativeRandomFrames[i];assert.equal(row[0],i+1);assert.equal(row[3].balls.length,4);assert.ok(Number.isInteger(row[3].scriptRandom));}
fixture.captureSHA256=createHash('sha256').update(bytes).digest('hex');fixture.nativeRandom.requireContinuity=true;fixture.nativeRandom.continuityThroughMilliseconds=frames;fixture.nativeScriptRandom={requireContinuity:true};
fixture.nativeBodyRegression={frames,positionError:0,velocityError:0,momentumError:0,orientationError:0};
// Public COM samples use six-decimal strings; memory comparisons above require
// exact Float32 body values independently of that formatting precision.
fixture.regressionLimits={[scenario.name]:{angle:.00001,position:.0001,velocity:.000001}};
fixture.scope='Complete native spinner strike/coast, initial four-body, plunger, ten trail slots, orientation and both RNG states. Observe every body before every physics frame. Captured states are diagnostic inputs only.';
fs.writeFileSync(output,gzipSync(JSON.stringify(fixture),{level:9}));console.log(JSON.stringify({scenario:scenario.name,frames,bodies:frames*4,output}));
