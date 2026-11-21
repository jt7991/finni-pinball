"""Build a native measurement copy with explicit scatter overrides; keep the source table untouched."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import re

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-root',type=Path,required=True)
parser.add_argument('--output-root',type=Path,help='New diagnostic output directory; never overwrite a running reference.')
parser.add_argument('--instrument-timers',action='store_true',help='Build a separate diagnostic table that records actual timer callbacks.')
parser.add_argument('--instrument-spinners',action='store_true',help='Build a separate timer/plate-angle diagnostic table.')
parser.add_argument('--instrument-ball-trails',action='store_true',help='Record the source ten-slot old-position history before controlled resets.')
parser.add_argument('--instrument-rng',action='store_true',help='Emit physics-frame markers for read-only native random-state capture.')
parser.add_argument('--all-scatter-zero',action='store_true',help='Also zero every material/object scatter field in a separate reference copy.')
args=parser.parse_args()
if args.instrument_spinners or args.instrument_ball_trails or args.instrument_rng:args.instrument_timers=True
source=args.source_root.resolve()
tool=source/'.tools/vpxtool/vpxtool.exe'
table=source/'runtime/Finni-Big-Day.vpx'
out=ROOT/('.work/vpx-all-scatter'+('-timing' if args.instrument_timers else '')+'-reference' if args.all_scatter_zero else '.work/vpx-timing-reference' if args.instrument_timers else '.work/vpx-contact-reference')
if args.instrument_spinners:out=ROOT/'.work/vpx-spinner-timing-reference'
if args.instrument_ball_trails:out=ROOT/'.work/vpx-trail-timing-reference'
if args.instrument_rng:out=ROOT/'.work/vpx-rng-timing-reference'
if args.output_root:out=args.output_root.resolve()
out.mkdir(parents=True,exist_ok=True)
extracted=out/'extracted'
subprocess.run([str(tool),'extract',str(table),'-o',str(extracted),'-f'],check=True)
data_path=extracted/'gamedata.json'
data=json.loads(data_path.read_text())
overrides={'scatter':0,'default_scatter':0}
original={k:data[k] for k in overrides}
data.update(overrides)
data_path.write_text(json.dumps(data,indent=2)+'\n')
scatter_overrides=[]
if args.all_scatter_zero:
    material_path=extracted/'materials.json';materials=json.loads(material_path.read_text())
    for material in materials:
        if material.get('scatter_angle',0)!=0:
            scatter_overrides.append({'kind':'material','name':material['name'],'field':'scatter_angle','original':material['scatter_angle']})
            material['scatter_angle']=0
    material_path.write_text(json.dumps(materials,indent=2)+'\n')
    for path in sorted((extracted/'gameitems').glob('*.json')):
        value=json.loads(path.read_text());kind,item=next(iter(value.items()))
        if item.get('scatter',0)!=0:
            scatter_overrides.append({'kind':kind,'name':item['name'],'field':'scatter','original':item['scatter']})
            item['scatter']=0;path.write_text(json.dumps(value,indent=2)+'\n')
if args.instrument_timers:
    script_path=extracted/'script.vbs'
    script=script_path.read_text()
    script+='\nDim RefTraceOn,RefTrace\nRefTraceOn=False:RefTrace=""\n'
    script+='Dim RefDriveAt,RefDriveSide,RefDrivePress,RefDriveMarker,RefTraceBall,RefTraceUntil,RefStateTraceOn,RefTraceFrom\nRefDriveAt=0:RefStateTraceOn=True:RefTraceFrom=0\n'
    if args.instrument_ball_trails:
        script+='Dim RefTrailOn,RefTrailSlots(9),RefTrailBalls,RefTrailBall,RefTrailIndex,RefTrailRow,RefTrailSlot\nRefTrailOn=False\n'
    for name,marker in [('RollingTimer_Timer','ROLL'),('LeftFlipper_Timer','FLIP')]:
        pattern=r'(Sub '+name+r'\b[^\r\n]*[\r\n]+)'
        extra=f'    If RefTraceOn Then RefTrace=RefTrace & "{marker}|" & GameTime & ";"\n'
        if name=='LeftFlipper_Timer':
            extra+='''    If RefDriveAt>0 And GameTime>=RefDriveAt Then
        RefDriveAt=0
        Debug.Print RefDriveMarker & "|" & GameTime
        If RefDriveSide=1 Then
            SolLFlipper RefDrivePress
        ElseIf RefDriveSide=2 Then
            SolRFlipper RefDrivePress
        ElseIf RefDriveSide=3 Then
            Plunger.Fire
        End If
    End If
'''
        script,count=re.subn(pattern,lambda m:m[1]+extra,script,count=1,flags=re.I)
        if count!=1:raise RuntimeError(f'Missing native timer handler {name}')
    # Ball state at the end of the existing flipper timer is observed before
    # that millisecond's velocity/displacement update. Integer encoding avoids
    # the native Single formatter dropping scientific exponents.
    state_fields=['GameTime','RefTraceBall.X','RefTraceBall.Y','RefTraceBall.Z']
    state_fields+=['CLng(RefTraceBall.'+p+'*1000000)' for p in ['VelX','VelY','VelZ','AngVelX','AngVelY','AngVelZ']]
    state_fields+=['RightFlipper.CurrentAngle','RightFlipper.Strength','RightFlipper.Elasticity','RightFlipper.EOSTorque']
    state='    If RefTraceOn And RefStateTraceOn And GameTime>=RefTraceFrom And GameTime<=RefTraceUntil Then RefTrace=RefTrace & "STATE|" & '+' & "|" & '.join(state_fields)+' & ";"\n'
    if args.instrument_rng:
        state+='    If RefTraceOn Then Debug.Print "RNG_FRAME|" & GameTime\n'
    if args.instrument_spinners:
        state+='    If RefTraceOn And RefStateTraceOn And GameTime>=RefTraceFrom And GameTime<=RefTraceUntil Then RefTrace=RefTrace & "SPIN|" & GameTime & "|" & CLng(Spinner001.CurrentAngle*1000000) & "|" & CLng(Spinner002.CurrentAngle*1000000) & ";"\n'
    if args.instrument_ball_trails:
        # The timer observes the previous physics step's position. The probe
        # snapshots the final completed step before teleporting the test ball.
        state+='''    If RefTrailOn Then
        RefTrailBalls=GetBalls
        RefTrailRow=CStr(GameTime-1) & "|"
        For RefTrailIndex=0 To UBound(RefTrailBalls)
            Set RefTrailBall=RefTrailBalls(RefTrailIndex)
            RefTrailRow=RefTrailRow & RefTrailBall.ID & ":" & CStr(CDbl(RefTrailBall.X)) & ":" & CStr(CDbl(RefTrailBall.Y)) & ":" & CStr(CDbl(RefTrailBall.Z)) & ";"
        Next
        RefTrailSlot=((GameTime-1)\\10) Mod 10
        RefTrailSlots(RefTrailSlot)=RefTrailRow
    End If
'''
    script,count=re.subn(r'(Sub LeftFlipper_Timer\b.*?)(End Sub)',lambda m:m[1]+state+m[2],script,count=1,flags=re.I|re.S)
    if count!=1:raise RuntimeError('Missing flipper state instrumentation point')
    script_path.write_text(script)
copy=out/'zero-scatter.vpx'
subprocess.run([str(tool),'assemble','-f',str(extracted),str(copy)],check=True)
verify=json.loads(subprocess.check_output([str(tool),'verify','--json',str(copy)],text=True))[0]
if not verify.get('valid'):raise RuntimeError(f'Reference failed VPX verification: {verify}')
comparison=subprocess.run([str(tool),'table','diff',str(table),str(copy)],text=True,capture_output=True)
if comparison.returncode not in (0,1):raise RuntimeError(comparison.stderr)
diff=comparison.stdout
metadata={'engine':'@valknar/vpinball-wasm 0.3.4','upstreamCommit':'195f214dd4849b8ef6113fd377258b78d0dec3bf',
          'sourceSha256':hashlib.sha256(table.read_bytes()).hexdigest(),
          'controlledSha256':hashlib.sha256(copy.read_bytes()).hexdigest(),
          'controlledOverrides':overrides,'originalValues':original,'diff':diff,'verification':verify}
if args.all_scatter_zero:metadata.update({'allScatterZero':True,'scatterOverrides':scatter_overrides})
if args.instrument_timers:
    metadata['instrumentation']={
        'timerTrace':['RollingTimer_Timer','LeftFlipper_Timer'],
        'optionalStateTrace':True,
        'stateTraceWindow':True,
        'stateColumns':['ms','x','y','z','vx_micro','vy_micro','vz_micro','wx_micro','wy_micro','wz_micro','right_angle','right_strength','right_elasticity','right_eos_torque'],
        'changes':'Record native timer clocks and ball state before each physics update while RefTraceOn is true. Optional exact-clock input at RefDriveAt is delivered at the start of LeftFlipper_Timer. Authored timer bodies and rules are retained.'}
    if args.instrument_spinners:metadata['instrumentation']['spinnerTraceColumns']=['ms','spinner001_angle_micro','spinner002_angle_micro']
    if args.instrument_ball_trails:
        metadata['instrumentation']['ballTrails']={'slots':10,'bucketMilliseconds':10,'columns':['ball_id','x','y','z'],'positionPhase':'Timer observes the preceding physics step; the final completed-step position is captured before each controlled reset.'}
    if args.instrument_rng:metadata['instrumentation']['nativeRngMarkers']='RNG_FRAME emitted before each physics step; the browser probe reads the unmodified engine state synchronously when this debug message is written.'
(out/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(diff)
print(f'Controlled native reference: {copy}')
