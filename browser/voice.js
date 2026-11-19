import {PRESETS, processVoice} from './voice-audio.js';
const $ = id => document.getElementById(id);
let decoded, result, renderedSettings, recorder, stream, timer, clock, recording = false, busy = false;
let token = '', member, page = 1, settings = {...PRESETS.party};
const urls = new Map();
function message(id, text, error = false) { $(id).textContent = text; $(id).classList.toggle('error', error); }
function replaceAudio(id, blob) {
  if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
  const url = URL.createObjectURL(blob); urls.set(id, url); $(id).src = url;
}
function controls() {
  $('render').disabled = !decoded || busy || recording;
  $('download').disabled = !result || busy || recording;
  $('submit').disabled = !result || !token || busy || recording;
  $('upload').disabled = busy || recording;
  $('record').disabled = busy;
  for (const id of ['preset','pitch','compression','line','script']) $(id).disabled = busy || recording;
}
function invalidate() {
  result = null; $('processed').pause(); $('processed').removeAttribute('src'); $('processed').load();
  if (decoded) message('edit-status', 'Sound changed. Apply sound to update your preview.');
  controls();
}
function updateSettings() {
  settings.pitch = Number($('pitch').value); settings.compression = Number($('compression').value);
  $('pitch-value').value = `${settings.pitch > 0 ? '+' : ''}${settings.pitch} semitones`;
  $('compression-value').value = `${settings.compression}%`;
  invalidate();
}
$('preset').addEventListener('change', () => {
  settings = {...PRESETS[$('preset').value]};
  $('pitch').value = settings.pitch; $('compression').value = settings.compression;
  $('preset-note').textContent = settings.pitch ? 'A playful pitch lift, rumble filter, compression, and matched volume.' : 'Your natural pitch, a rumble filter, light compression, and matched volume.';
  updateSettings();
});
for (const id of ['pitch','compression']) $(id).addEventListener('input', updateSettings);

async function acceptAudio(blob) {
  if (blob.size > 20 * 1024 * 1024) throw new Error('Choose an audio file under 20 MB and 30 seconds.');
  const context = new AudioContext();
  let audio;
  try { audio = await context.decodeAudioData(await blob.arrayBuffer()); }
  finally { await context.close(); }
  if (!audio.duration || audio.duration > 30.1) throw new Error('Use a take of 30 seconds or less. Short lines work best.');
  decoded = audio; result = null;
  replaceAudio('original', blob);
  const canvas = $('waveform'), draw = canvas.getContext('2d'), data = audio.getChannelData(0);
  draw.clearRect(0,0,canvas.width,canvas.height); draw.strokeStyle = '#ffc594'; draw.lineWidth = 2;
  draw.beginPath();
  for (let x = 0; x < canvas.width; x++) {
    const from = Math.floor(x * data.length / canvas.width), to = Math.max(from + 1, Math.floor((x + 1) * data.length / canvas.width));
    let peak = 0; for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(data[i]));
    draw.moveTo(x,60 - peak * 54); draw.lineTo(x,60 + peak * 54);
  }
  draw.stroke();
  message('record-status', `Take ready · ${audio.duration.toFixed(1)} seconds. You can record again to replace it.`);
}
async function render() {
  busy = true; controls(); message('edit-status', 'Applying the Finni sound…');
  try {
    renderedSettings = {...settings}; result = await processVoice(decoded, renderedSettings);
    replaceAudio('processed', result.processed);
    message('edit-status', 'Preview is ready. Listen, then submit your take or download it.');
  } catch (error) { result = null; message('edit-status', `Could not process audio: ${error.message}`, true); }
  finally { busy = false; controls(); }
}
$('render').addEventListener('click', render);
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
  link.download = `${$('line').value || 'custom'}-finni.wav`; link.click();
});

async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, {...options, headers:{...(token ? {Authorization:token} : {}), ...options.headers}});
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) signOut();
    throw new Error(body.message || `Request failed (${response.status}). Check the backend and retry.`);
  }
  return body;
}
function signOut() {
  token = ''; member = null; $('login').hidden = false; $('account').hidden = true;
  $('takes').replaceChildren(); $('more').hidden = true;
  message('library-status', 'Sign in to see and submit shared takes.'); controls();
}
$('logout').addEventListener('click', signOut);
$('login').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('login').querySelector('button'); button.disabled = true;
  try {
    const auth = await api('collections/voice_team/auth-with-password', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity:$('email').value,password:$('password').value})});
    token = auth.token; member = auth.record; $('password').value = '';
    $('login').hidden = true; $('account').hidden = false; $('identity').textContent = `Signed in as ${member.name || member.email}`;
    controls(); await loadLibrary();
  } catch (error) { message('library-status', `Sign-in failed. ${error.message}`, true); }
  finally { button.disabled = false; }
});
$('submit').addEventListener('click', async () => {
  if (!$('script').value.trim()) { $('script').focus(); message('edit-status', 'Enter the line’s words before submitting.', true); return; }
  busy = true; controls(); message('edit-status', 'Uploading both versions to the team library…');
  try {
    const data = new FormData(), id = $('line').value || 'custom';
    for (const [key,value] of Object.entries({contributor:member.id,speaker:member.name || member.email,line_id:id,line_text:$('script').value.trim(),settings:JSON.stringify(renderedSettings),status:'pending'})) data.append(key,value);
    data.append('original', result.original, `${id}-original.wav`); data.append('processed', result.processed, `${id}-finni.wav`);
    await api('collections/voice_takes/records', {method:'POST',body:data});
    message('edit-status', 'Take submitted for review. Both versions are saved in the team library.');
    result = null; await loadLibrary();
  } catch (error) { message('edit-status', `Submission failed. Your take is still here; retry or download it. ${error.message}`, true); }
  finally { busy = false; controls(); }
});

function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
async function loadLibrary(append = false) {
  if (!token) { message('library-status', 'Sign in to see the shared library.'); return; }
  $('refresh').disabled = true; $('more').disabled = true;
  const nextPage = append ? page + 1 : 1;
  message('library-status', 'Loading team takes…');
  try {
    const [records, fileAuth] = await Promise.all([
      api(`collections/voice_takes/records?sort=-created&perPage=20&page=${nextPage}`),
      api('files/token', {method:'POST'}),
    ]);
    if (!append) $('takes').replaceChildren();
    for (const take of records.items) {
      const row = element('article',''); row.className = 'take';
      row.append(element('h3', `${take.line_id} · ${take.speaker}`), element('p', take.line_text));
      row.append(element('p', `${take.status} · ${new Date(take.created).toLocaleString()} · ${take.settings.name || 'Custom sound'} · pitch ${take.settings.pitch}`));
      if (take.review_note) row.append(element('p', `Review: ${take.review_note}`));
      const players = element('div',''); players.className = 'take-players';
      for (const key of ['original','processed']) {
        const url = `/api/files/${take.collectionId}/${take.id}/${encodeURIComponent(take[key])}?token=${encodeURIComponent(fileAuth.token)}`;
        const group = element('div',''), label = element('label', key === 'original' ? 'Original' : 'Processed');
        const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'none'; audio.src = url; audio.id = `${take.id}-${key}`; label.htmlFor = audio.id;
        const link = element('a','Download WAV'); link.href = url + '&download=1'; link.download = take[key];
        group.append(label,audio,link); players.append(group);
      }
      row.append(players); $('takes').append(row);
    }
    page = nextPage; $('more').hidden = page >= records.totalPages;
    message('library-status', records.totalItems ? `${records.totalItems} shared takes. Refresh if audio links expire.` : 'No takes yet. Submit the first voice for the party.');
  } catch (error) { message('library-status', `Library unavailable. ${error.message}`, true); }
  finally { $('refresh').disabled = false; $('more').disabled = false; }
}
$('refresh').addEventListener('click', () => loadLibrary()); $('more').addEventListener('click', () => loadLibrary(true));
fetch('/voice-lines.json').then(response => { if (!response.ok) throw Error(); return response.json(); }).then(lines => {
  for (const [id,text] of Object.entries(lines)) { const option = element('option', `${id} · ${text}`); option.value = id; $('line').append(option); }
  $('line').addEventListener('change', () => { $('script').value = lines[$('line').value] || ''; });
}).catch(() => message('record-status', 'Callout list unavailable. You can still enter a custom line.', true));
controls();
