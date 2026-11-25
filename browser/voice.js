import {PRESETS, processVoice} from './voice-audio.js';
import {calloutCatalog} from './recordings.js';
import {requireSession, connectSignOut, voiceRequest} from './voice-session.js';

const session = requireSession();
if (session) connectSignOut(session);
const $ = id => document.getElementById(id);
let decoded, result, savedTake, takeSaved, recorder, stream, timer, clock, recording = false, busy = false;
let settings = {...PRESETS.natural};
const urls = new Map();
let selectedCallout, addRecording;
let aiTake = null, appliedAI = null, originalWav = null, aiOptions = null, aiLoading = false;
// Comparing takes should never accidentally play two recordings on top of each other.
document.addEventListener('play', ({target}) => {
  if (!(target instanceof HTMLMediaElement)) return;
  for (const player of document.querySelectorAll('audio')) if (player !== target) player.pause();
}, true);
function message(id, text, error = false) { $(id).textContent = text; $(id).classList.toggle('error', error); }
function replaceAudio(id, blob) {
  if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
  const url = URL.createObjectURL(blob); urls.set(id, url); $(id).src = url;
}
function controls() {
  $('select-callout').hidden = !!selectedCallout;
  $('recording-controls').hidden = !selectedCallout;
  $('take-panel').hidden = !decoded;
  $('ai-controls').hidden = !aiOptions && !aiTake && !$('ai-status').textContent;
  $('download').disabled = !result || busy || recording;
  $('upload').disabled = !selectedCallout || busy || recording;
  $('record').disabled = !selectedCallout || busy;
  for (const id of ['preset','auto-trim']) $(id).disabled = !selectedCallout || busy || recording;
  $('ai-enhance').disabled = (!aiOptions && !aiTake) || !originalWav || !!appliedAI || busy || recording || aiLoading;
  $('ai-enhance').textContent = aiTake ? 'Reapply cleanup' : 'Clean up with ElevenLabs';
  $('ai-enhance').hidden = !!appliedAI || (!aiOptions && !aiTake);
  $('ai-reset').hidden = !appliedAI;
  $('ai-reset').disabled = !appliedAI || busy || recording;
  $('ai-refresh').disabled = busy || recording || aiLoading;
}
function invalidate() {
  result = null; $('processed').pause(); $('processed').removeAttribute('src'); $('processed').load();
  if (decoded) message('edit-status', 'Treatment changed. Updating your preview.');
  controls();
}
function changeTreatment() {
  settings = {...PRESETS[$('preset').value], autoTrim: $('auto-trim').checked};
  $('preset-note').textContent = settings.description;
  invalidate();
  if (decoded) render();
}
$('preset').replaceChildren();
const presetGroups = new Map();
for (const label of ['Pitch & tuning', 'Character tone', 'Studio & speakers']) {
  const group = document.createElement('optgroup'); group.label = label;
  presetGroups.set(label, group); $('preset').append(group);
}
for (const [id, preset] of Object.entries(PRESETS)) {
  let group = 'Studio & speakers';
  if (preset.pitch || preset.tuning || preset.wobble) group = 'Pitch & tuning';
  else if (['gremlin', 'plush', 'sprite', 'robot', 'villain'].includes(id)) group = 'Character tone';
  const option = document.createElement('option'); option.value = id; option.textContent = preset.name;
  presetGroups.get(group).append(option);
}
$('preset').value = 'natural';
$('preset').addEventListener('change', changeTreatment);
$('auto-trim').addEventListener('change', changeTreatment);
changeTreatment();
async function acceptAudio(blob) {
  if (blob.size > 20 * 1024 * 1024) throw new Error('Choose an audio file under 20 MB and 30 seconds.');
  const context = new AudioContext();
  let audio;
  try { audio = await context.decodeAudioData(await blob.arrayBuffer()); }
  finally { await context.close(); }
  if (!audio.duration || audio.duration > 30.1) throw new Error('Use a take of 30 seconds or less. Short lines work best.');
  decoded = audio; result = null; aiTake = null; appliedAI = null; originalWav = null;
  savedTake = selectedCallout;
  takeSaved = false;
  updateAICost();
  if (aiOptions) message('ai-status', '');
  replaceAudio('original', blob);
  message('record-status', `Take ready · ${audio.duration.toFixed(1)} seconds. You can record again to replace it.`);
}
async function render() {
  busy = true; controls(); message('edit-status', 'Preparing preview…');
  try {
    result = await processVoice(appliedAI ? aiTake : decoded, settings);
    if (!originalWav) originalWav = result.original;
    replaceAudio('processed', result.processed);
    const previewStatus = `${result.duration.toFixed(2)} seconds${appliedAI ? ' · Noise cleanup applied' : ''}`;
    message('edit-status', previewStatus);
    if (session && !takeSaved) {
      try {
        const body = new FormData();
        for (const [key, value] of Object.entries({
          contributor: session.id, speaker: session.name, line_id: savedTake.id, line_text: savedTake.text,
          status: 'pending', settings: JSON.stringify({name: settings.name}),
        })) body.append(key, value);
        body.append('original', originalWav, `${savedTake.id}-original.wav`);
        body.append('processed', result.processed, `${savedTake.id}-finni.wav`);
        const take = await voiceRequest(session, '/api/collections/voice_takes/records', {method: 'POST', body});
        takeSaved = true;
        addRecording?.(take);
      } catch {
        message('edit-status', `${previewStatus}. Could not save the recording. Download the WAV to keep it.`, true);
      }
    }
  } catch (error) { result = null; message('edit-status', `Could not process audio: ${error.message}`, true); }
  finally { busy = false; controls(); }
}
$('upload').addEventListener('change', async () => {
  const file = $('upload').files[0]; if (!file) return;
  busy = true; controls();
  try { await acceptAudio(file); busy = false; await render(); }
  catch (error) { message('record-status', error.message, true); }
  finally { busy = false; $('upload').value = ''; controls(); }
});
function releaseMic() {
  clearTimeout(timer); clearInterval(clock);
  stream?.getTracks().forEach(track => track.stop()); stream = null;
  recording = false; $('record').textContent = 'Record a take'; controls();
}
function stopRecording() {
  if (recorder?.state === 'recording') { busy = true; recorder.stop(); }
  releaseMic();
}
$('record').addEventListener('click', async () => {
  if (recording) { stopRecording(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    message('record-status', 'Microphone recording needs HTTPS or localhost and a supported browser. You can upload audio instead.', true); return;
  }
  busy = true; controls();
  try {
    stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    $('original').pause(); $('processed').pause();
    recorder = new MediaRecorder(stream); const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      try { await acceptAudio(new Blob(chunks, {type:recorder.mimeType})); busy = false; await render(); }
      catch (error) { message('record-status', `Recording could not be read. Try again or upload audio. ${error.message}`, true); }
      finally { busy = false; controls(); }
    };
    recorder.onerror = () => { releaseMic(); busy = false; controls(); message('record-status', 'Recording failed. Try again or upload audio.', true); };
    recorder.start(); recording = true; busy = false; controls(); $('record').textContent = 'Stop recording';
    const started = Date.now();
    message('record-status', 'Recording · 0 seconds. Stop when your line is finished.');
    clock = setInterval(() => message('record-status', `Recording · ${Math.floor((Date.now() - started)/1000)} / 30 seconds`), 500);
    timer = setTimeout(stopRecording, 30000);
  } catch (error) { releaseMic(); busy = false; controls(); message('record-status', 'Microphone unavailable. Allow microphone access and retry, or upload audio.', true); }
});
window.addEventListener('pagehide', () => { if (recording) stopRecording(); else releaseMic(); });
$('download').addEventListener('click', () => {
  const link = document.createElement('a'); link.href = urls.get('processed');
  link.download = `${savedTake.id}-finni.wav`; link.click();
});

function clearTake() {
  decoded = null; result = null; savedTake = null; aiTake = null; appliedAI = null; originalWav = null;
  updateAICost();
  if (aiOptions) message('ai-status', '');
  for (const id of ['original','processed']) {
    $(id).pause(); $(id).removeAttribute('src'); $(id).load();
    if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
  }
  message('record-status', 'Takes up to 30 seconds are saved to Recordings.');
  message('edit-status', 'Record or upload this line to get started.');
  controls();
}
if (session) Promise.all(['/voice-lines.json', '/voice-difficulty.json'].map(async path => {
  const response = await fetch(path);
  if (!response.ok) throw Error();
  return response.json();
})).then(([lines, difficulty]) => {
  addRecording = calloutCatalog(session, lines, difficulty, id => {
    if (busy || recording) return false;
    if (selectedCallout?.id !== id) {
      selectedCallout = {id, text: lines[id]};
      $('script').textContent = selectedCallout.text;
      clearTake();
    }
    $('record').focus();
    return true;
  });
  controls();
}).catch(() => {
  message('catalog-status', 'Callouts could not load. Reload the page to try again.', true);
});
controls();


function updateAICost() {
  if (!decoded || !aiOptions || aiTake) { $('ai-cost').textContent = ''; return; }
  const minimum = aiOptions.minimum_seconds;
  const billedDuration = Math.max(minimum, decoded.duration);
  const paddingNote = decoded.duration < minimum ? ' Padding is removed before normal trimming.' : '';
  $('ai-cost').textContent = `Sends this take to ElevenLabs for noise removal. Estimated cost $${(billedDuration / 60 * aiOptions.price_per_minute).toFixed(3)}.${paddingNote}`;
}
async function loadAIStatus(showStatus = false) {
  aiLoading = true;
  if (showStatus) message('ai-status', 'Checking ElevenLabs…');
  controls();
  try {
    const response = await fetch('/api/voice-ai/options');
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.enabled || data.tool !== 'audio_isolation') throw Error(data.message || 'ElevenLabs is unavailable.');
    aiOptions = data;
    message('ai-status', showStatus ? 'ElevenLabs is connected.' : '');
  } catch (error) {
    aiOptions = null;
    message('ai-status', showStatus ? error.message : '', showStatus);
  } finally {
    aiLoading = false;
    updateAICost();
    controls();
  }
}
$('ai-refresh').addEventListener('click', () => loadAIStatus(true));
$('ai-reset').addEventListener('click', async () => {
  if (busy || recording || !decoded) return;
  appliedAI = null;
  message('ai-status', 'Using your original recording. You can reapply the saved AI cleanup at no extra cost.');
  await render();
});
$('ai-enhance').addEventListener('click', async () => {
  if (busy || recording || !decoded || !originalWav || (!aiOptions && !aiTake) || appliedAI) return;
  if (aiTake) {
    appliedAI = true;
    await render();
    message('ai-status', result ? 'Reapplied the saved AI cleanup. No new request was sent.' : 'The saved cleanup could not be previewed. Check the preview error.', !result);
    return;
  }
  busy = true; controls();
  message('ai-status', 'ElevenLabs is cleaning your recording…');
  try {
    const response = await fetch('/api/voice-ai/enhance', {method:'POST', headers:{'Content-Type':'audio/wav'}, body: originalWav});
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw Error(data.message || `Enhancement failed (HTTP ${response.status}). Check ElevenLabs history before retrying.`);
    }
    const bytes = await response.arrayBuffer(), context = new AudioContext();
    let enhanced;
    try { enhanced = await context.decodeAudioData(bytes); }
    finally { await context.close(); }
    if (!enhanced.duration || enhanced.duration > 30.1) throw Error('The AI result is longer than 30 seconds. Use a shorter recording. This enhancement may have been billed.');
    // The bridge appends silence for short takes. Keep the original line length.
    const length = Math.min(enhanced.length, Math.ceil(decoded.duration * enhanced.sampleRate));
    const cropped = new AudioBuffer({numberOfChannels: enhanced.numberOfChannels, length, sampleRate: enhanced.sampleRate});
    for (let channel = 0; channel < enhanced.numberOfChannels; channel++) {
      cropped.copyToChannel(enhanced.getChannelData(channel).subarray(0, length), channel);
    }
    aiTake = cropped; appliedAI = true;
    updateAICost();
    await render();
    if (result) message('ai-status', 'AI cleanup applied. Your original is available in settings.');
    else message('ai-status', 'AI cleanup is saved, but the preview could not be prepared. Check the preview error before continuing.', true);
  } catch (error) {
    message('ai-status', `${error.message} Your original recording is still here.`, true);
  } finally { busy = false; controls(); }
});
loadAIStatus();
