import {PRESETS, processVoice} from './voice-audio.js';
const $ = id => document.getElementById(id);
let decoded, result, renderedSettings, recorder, stream, timer, clock, recording = false, busy = false;
let token = '', member, page = 1, settings = {...PRESETS.natural};
const urls = new Map();
let cast, gameLines = {}, lineRoles = {};
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
  $('take-panel').hidden = !decoded;
  $('ai-controls').hidden = !aiOptions && !aiTake && !$('ai-status').textContent;
  $('download').disabled = !result || busy || recording;
  $('submit').disabled = !result || !token || busy || recording;
  $('upload').disabled = !cast || busy || recording;
  $('record').disabled = !cast || busy;
  for (const id of ['preset','auto-trim','line','script','role']) $(id).disabled = !cast || busy || recording;
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
  updateAICost();
  if (aiOptions) message('ai-status', '');
  replaceAudio('original', blob);
  message('record-status', `Take ready · ${audio.duration.toFixed(1)} seconds. You can record again to replace it.`);
}
async function render() {
  busy = true; controls(); message('edit-status', 'Preparing preview…');
  try {
    renderedSettings = {...settings};
    if (appliedAI) renderedSettings = {...renderedSettings, ai: appliedAI, name: `AI cleanup + ${settings.name}`};
    result = await processVoice(appliedAI ? aiTake : decoded, renderedSettings);
    if (!originalWav) originalWav = result.original;
    result.original = originalWav;
    if (result.processed.size > 4_000_000) throw Error('The processed take is too long for the team library. Use a shorter recording.');
    replaceAudio('processed', result.processed);
    message('edit-status', `${result.duration.toFixed(2)} seconds${appliedAI ? ' · Noise cleanup applied' : ''}`);
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
  token = ''; member = null; $('sign-in-note').hidden = false; $('login').hidden = false; $('account').hidden = true;
  $('takes').replaceChildren(); $('more').hidden = true;
  message('library-status', 'Sign in to see and submit shared takes.'); controls();
}
$('logout').addEventListener('click', signOut);
$('login').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('login').querySelector('button'); button.disabled = true;
  try {
    const auth = await api('collections/voice_team/auth-with-password', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity:$('email').value,password:$('password').value})});
    token = auth.token; member = auth.record; $('password').value = '';
    $('login').hidden = true; $('sign-in-note').hidden = true; $('account').hidden = false; $('identity').textContent = `Signed in as ${member.name || member.email}`;
    controls(); await loadLibrary();
  } catch (error) { message('library-status', `Sign-in failed. ${error.message}`, true); }
  finally { button.disabled = false; }
});
$('submit').addEventListener('click', async () => {
  if (!$('script').value.trim()) { $('script').focus(); message('edit-status', 'Enter the line’s words before submitting.', true); return; }
  busy = true; controls(); message('edit-status', 'Uploading both versions to the team library…');
  try {
    const data = new FormData(), id = $('line').value || 'custom';
    for (const [key,value] of Object.entries({contributor:member.id,speaker:member.name || member.email,line_id:id,line_text:$('script').value.trim(),settings:JSON.stringify({...renderedSettings,role:$('role').value,trim:result.trim,processed_duration:result.duration}),status:'pending'})) data.append(key,value);
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
      row.append(element('h3', `${cast?.roles.find(role => role.id === take.settings?.role)?.name || 'Unassigned role'} · ${take.speaker} · ${take.line_id}`), element('p', take.line_text));
      row.append(element('p', `${take.status} · ${new Date(take.created).toLocaleString()} · ${take.settings?.name || 'Custom sound'}`));
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
function clearTake() {
  decoded = null; result = null; aiTake = null; appliedAI = null; originalWav = null;
  updateAICost();
  if (aiOptions) message('ai-status', '');
  for (const id of ['original','processed']) {
    $(id).pause(); $(id).removeAttribute('src'); $(id).load();
    if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
  }
  message('record-status', 'Up to 30 seconds per take.');
  message('edit-status', 'Record or upload this line to get started.');
  controls();
}
function chooseRole(id) {
  const role = cast.roles.find(role => role.id === id);
  $('role').value = id;
  const ids = Object.keys(gameLines).filter(line => lineRoles[line] === id);
  $('role-direction').textContent = role.direction;
  $('line').replaceChildren();
  for (const line of ids) {
    const option = element('option', gameLines[line]); option.value = line; $('line').append(option);
  }
  const custom = element('option', 'Custom line for this role'); custom.value = ''; $('line').append(custom);
  $('script').value = gameLines[$('line').value] || '';
  clearTake();
  for (const option of $('preset').options) option.textContent = `${PRESETS[option.value].name}${option.value === role.recommended_preset ? ' (recommended)' : ''}`;
}
$('role').addEventListener('change', () => chooseRole($('role').value));
$('line').addEventListener('change', () => {
  $('script').value = gameLines[$('line').value] || ''; clearTake();
});
// A transcript edit requires a fresh take so existing audio cannot be relabeled.
$('script').addEventListener('input', clearTake);
Promise.all(['/voice-lines.json','/voice-cast.json'].map(async path => {
  const response = await fetch(path); if (!response.ok) throw Error(); return response.json();
})).then(([lines, config]) => {
  for (const id of Object.keys(lines)) {
    const matches = config.roles.filter(role => role.line_ids.includes(id) || role.prefixes.some(prefix => id.startsWith(prefix)));
    if (matches.length > 1) throw Error(`Multiple voice roles for ${id}`);
    lineRoles[id] = matches[0]?.id || config.default_role;
  }
  if (!config.roles.some(role => role.id === config.default_role)) throw Error('Unknown default voice role');
  for (const role of config.roles) {
    if (!PRESETS[role.recommended_preset]) throw Error(`Unknown recommended effect in ${role.name}`);
    if (role.line_ids.some(id => !(id in lines))) throw Error(`Unknown game line in ${role.name}`);
  }
  cast = config; gameLines = lines;
  $('role').replaceChildren();
  for (const role of cast.roles) {
    const count = Object.values(lineRoles).filter(id => id === role.id).length;
    const workload = `${count} lines`;
    const option = element('option', `${role.name} · ${workload}`); option.value = role.id; $('role').append(option);
  }
  chooseRole(cast.roles[0].id); controls();
}).catch(() => message('record-status', 'Recording roles could not load. Reload the page to try again.', true));
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
  const enhancement = {provider: 'elevenlabs', tool: 'audio_isolation'};
  if (aiTake) {
    appliedAI = enhancement;
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
    aiTake = cropped; appliedAI = enhancement;
    updateAICost();
    await render();
    if (result) message('ai-status', 'AI cleanup applied. Compare with your original, then download or submit.');
    else message('ai-status', 'AI cleanup is saved, but the preview could not be prepared. Check the preview error before continuing.', true);
  } catch (error) {
    message('ai-status', `${error.message} Your original recording is still here.`, true);
  } finally { busy = false; controls(); }
});
loadAIStatus();
