"""Record only the running VPX window through Windows Graphics Capture."""
from pathlib import Path
import sys,subprocess,wave,json,time,argparse
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'.tools/recording-pydeps'))
import soundcard as sc
import numpy as np
OUT=ROOT/'output/live-vpx';FF=ROOT/'.tools/pydeps/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v9.0.2.exe'
parser=argparse.ArgumentParser();parser.add_argument('--seconds',type=int,default=60)
parser.add_argument('--name',default='finni-live-vpx-gameplay')
parser.add_argument('--kind',choices=['gameplay','light-check'],default='gameplay');args=parser.parse_args()
seconds=args.seconds
video_file=OUT/(args.name+'-video.mp4');audio_file=OUT/(args.name+'-audio.wav');final_file=OUT/(args.name+'.mp4')
before=(OUT/'gameplay-status.txt').read_text()
command=[str(FF),'-hide_banner','-loglevel','warning','-f','lavfi','-i',
    'gfxcapture=window_title=^Visual Pinball Player$:max_framerate=30:capture_cursor=0',
    '-vf','hwdownload,format=bgra,scale=1280:720,format=yuv420p','-r','30','-t',str(seconds),
    '-c:v','libx264','-preset','veryfast','-crf','20','-movflags','+faststart','-y',str(video_file)]
speaker=sc.default_speaker();loopback=sc.get_microphone(id=str(speaker.name),include_loopback=True)
assert loopback.isloopback  # Never capture a microphone.
with (OUT/'capture.log').open('w') as log:
    process=subprocess.Popen(command,stdout=log,stderr=log)
    audio=loopback.record(samplerate=48000,numframes=seconds*48000)
    result=process.wait(timeout=30)
    assert result==0,(OUT/'capture.log').read_text()
with wave.open(str(audio_file),'wb') as wav:
    wav.setnchannels(audio.shape[1]);wav.setsampwidth(2);wav.setframerate(48000)
    wav.writeframes((np.clip(audio,-1,1)*32767).astype('<i2').tobytes())
subprocess.run([str(FF),'-hide_banner','-loglevel','error','-i',str(video_file),
    '-i',str(audio_file),'-c:v','copy','-c:a','aac','-b:a','160k',
    '-shortest','-movflags','+faststart','-y',str(final_file)],check=True)
after=(OUT/'gameplay-status.txt').read_text()
(OUT/(args.name+'-info.json')).write_text(json.dumps({'type':'actual Visual Pinball X '+args.kind+' screen recording',
    'seconds':seconds,'resolution':[1280,720],'fps':30,'capture':'VPX window only; Windows Graphics Capture',
    'audio':'speaker loopback, no microphone',
    'controls':'automatic launcher/flipper inputs; real VPX physics and rules' if args.kind=='gameplay' else 'controlled sequence of the seven mission lamps, no gameplay driver',
    'status_before':before if args.kind=='gameplay' else None,'status_after':after if args.kind=='gameplay' else None},indent=2))
print('REAL_VPX_RECORDING_READY',flush=True)
