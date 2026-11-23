import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudio} from '../media.js';

// Native AudioPlayer::StopSound stops all matching SoundPlayers; Stop queues
// stop+seek on each player. Loading a web buffer must not resurrect a stopped
// playback request. Exercise the real public API with a delayed decoder.
for(const action of ['named stop','stop all','mute then unmute'])test(`a pending decoded sound cannot survive ${action}`,async()=>{
  const originals={Audio:globalThis.Audio,AudioContext:globalThis.AudioContext,fetch:globalThis.fetch};
  const decoding=Promise.withResolvers(),decoded=Promise.withResolvers(),sources=[];
  const chain={connect(){return this;}};
  globalThis.Audio=class{play(){return Promise.resolve();}pause(){}load(){}};
  globalThis.AudioContext=class{
    currentTime=0;destination={};resume(){return Promise.resolve();}
    decodeAudioData(){decoding.resolve();return decoded.promise;}
    createBufferSource(){const source={...chain,playbackRate:{value:1},start(){source.started=true;},stop(){source.stopped=true;}};sources.push(source);return source;}
    createGain(){return {...chain,gain:{value:1}};}createStereoPanner(){return {...chain,pan:{value:0}};}
  };
  globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)});
  try{
    const audio=createAudio({effect:{file:'effect.m4a',sampleRate:22050}},'/three/');await audio.unlock();
    const pending=audio.play('effect');await decoding.promise;
    if(action==='named stop')audio.stop('EFFECT');
    else if(action==='stop all')audio.stop();
    else{audio.setMuted(true);audio.setMuted(false);}
    decoded.resolve({sampleRate:48000,length:480,numberOfChannels:1});await pending;
    assert.equal(sources.filter(source=>source.started).length,0,'a request cancelled before decode completion must remain silent');
    await audio.play('effect');assert.equal(sources.filter(source=>source.started).length,1,'a later request can reuse the decoded buffer');audio.stop();
  }finally{Object.assign(globalThis,originals);}
});
