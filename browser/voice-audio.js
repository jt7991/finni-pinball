// Offline processing keeps exported audio identical to the preview.
export const PRESETS = {
  natural: {
    name: 'Clean & natural', description: 'Reduces rumble and sharp S sounds, with light compression to even out the line.',
    highpass: 75, mud: -1.5, deEss: 3, ratio: 1.6, release: .11,
  },
  party: {
    name: 'Warm & close', description: 'A little more body and softer highs for conversational lines.',
    highpass: 65, body: 1.5, mud: -2, air: -1, deEss: 4, ratio: 2, release: .14,
  },
  announcer: {
    name: 'Clear callout', description: 'A focused speech boost and firmer compression so short cues cut through music and effects.',
    highpass: 100, mud: -2.5, presence: 2.5, deEss: 4, ratio: 2.6, release: .09,
  },
  broadcast: {
    name: 'Broadcast host', description: 'A fuller low end, clear consonants, and steadier dynamics for an announcer read.',
    highpass: 75, body: 2, mud: -2.5, presence: 1.75, deEss: 4, ratio: 3, release: .13, drive: 1.6,
  },
  radio: {
    name: 'Arcade radio', description: 'A narrow, lightly gritty radio effect with speech still in front.',
    highpass: 320, lowpass: 3650, presence: 2, ratio: 3, release: .09, drive: 3.8,
  },
  megaphone: {
    name: 'Cabinet PA', description: 'An exaggerated loudspeaker tone with midrange bite and soft clipping.',
    highpass: 440, lowpass: 4800, presence: 2, horn: 5, ratio: 3.5, release: .085, drive: 6,
  },
  gremlin: {
    name: 'Storybook gremlin', description: 'A pinched, nasal character with a raspy edge. Try a cheeky, animated delivery.',
    highpass: 160, lowpass: 7200, mud: -3, presence: 2, ratio: 2.8, release: .1, drive: 3.2,
    characterBands: [{frequency: 1150, gain: 7, q: 1.6}],
  },
  plush: {
    name: 'Plush pal', description: 'Rounded, soft and woolly, like a friendly talking stuffed animal. Works well with a gentle read.',
    highpass: 60, lowpass: 6000, body: 4, mud: -1, presence: -2, air: -5, deEss: 4, ratio: 2.2, release: .16,
  },
  sprite: {
    name: 'Pocket sprite', description: 'A thin, sparkling little voice with bright resonances. Add the excitement in your performance.',
    highpass: 230, lowpass: 10000, body: -4, presence: 3, air: 2, deEss: 5, ratio: 2.3, release: .08,
    characterBands: [{frequency: 1800, gain: 4, q: 1.4}],
  },
  robot: {
    name: 'Toy robot', description: 'A pronounced metallic buzz and small-speaker tone. Short, deliberate phrases make the words clearest.',
    highpass: 180, lowpass: 5500, presence: 3, ratio: 2.8, release: .09, drive: 2,
    ringFrequency: 75, ringMix: .65,
  },
  villain: {
    name: 'Arcade villain', description: 'A chesty, gritty growl with a dark top end. Lean into a theatrical, gravelly performance.',
    highpass: 65, lowpass: 4600, body: 4, presence: 1, ratio: 3, release: .14, drive: 4,
    characterBands: [{frequency: 650, gain: 4, q: 1.1}],
  },
  cartoon: {
    name: 'Squeaky cartoon · +10', description: 'Ten semitones up with bright, tiny-character tone. An intentionally exaggerated cartoon voice.',
    pitch: 10, highpass: 150, lowpass: 11500, presence: 2, deEss: 4, ratio: 2.4, release: .09,
  },
  toy: {
    name: 'Tiny toy · +7', description: 'Seven semitones up, tightly compressed with a little speaker-box bite.',
    pitch: 7, highpass: 170, lowpass: 8000, presence: 2, drive: 2, ratio: 2.8, release: .09,
  },
  monster: {
    name: 'Big monster · −9', description: 'Nine semitones down with chesty weight, grit and clear consonants. Use a big theatrical read.',
    pitch: -9, highpass: 45, lowpass: 6500, body: 3, presence: 3, drive: 2.6, ratio: 2.8, release: .13,
  },
  demon: {
    name: 'Dungeon demon · −12', description: 'A full octave down with heavy saturation and a dark, growling finish.',
    pitch: -12, highpass: 40, lowpass: 4800, body: 3, presence: 2, drive: 5, ratio: 3.2, release: .12,
  },
  hardtune: {
    name: 'Hard-tuned pop', description: 'Snaps voiced notes immediately to C major for an obvious pitch-corrected pop effect. Sing or stretch vowels for the strongest result.',
    tuning: 'major', highpass: 85, presence: 2, air: 2, deEss: 4, ratio: 3, release: .085,
  },
  robotsinger: {
    name: 'Robot singer', description: 'Flattens voiced syllables onto one held note chosen from your recording. Stretch vowels for an exaggerated monotone singing robot.',
    tuning: 'held', highpass: 130, lowpass: 7500, presence: 3, drive: 2, ratio: 3, release: .09,
  },
  alien: {
    name: 'Alien wobble · +5', description: 'Five semitones up with a rapid two-semitone pitch wobble. Deliberately strange and theatrical.',
    pitch: 5, wobble: 2, highpass: 130, lowpass: 9000, presence: 2, ratio: 2.5, release: .1,
  },
};

function activeRms(samples) {
  let sum = 0, count = 0;
  for (const value of samples) {
    if (Math.abs(value) > .01) { sum += value * value; count++; }
  }
  return count ? Math.sqrt(sum / count) : 0;
}

export function level(samples, targetDb = -18) {
  const rms = activeRms(samples);
  if (!rms) return samples;
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  const gain = Math.min(10 ** (targetDb / 20) / rms, .891 / peak, 4);
  const fade = Math.max(1, Math.min(160, Math.floor(samples.length / 2)));
  for (let i = 0; i < samples.length; i++) {
    samples[i] *= gain * Math.min(1, i / fade, (samples.length - 1 - i) / fade);
  }
  return samples;
}

// Find only the outer quiet regions; preserve every pause inside the take.
export function trimSilence(samples, rate) {
  const windowSize = Math.max(1, Math.round(rate * .01)), rms = [];
  for (let from = 0; from < samples.length; from += windowSize) {
    const end = Math.min(from + windowSize, samples.length);
    let energy = 0;
    for (let i = from; i < end; i++) energy += samples[i] ** 2;
    rms.push(Math.sqrt(energy / (end - from)));
  }
  const sorted = [...rms].sort((a,b) => a-b), peak = sorted.at(-1) || 0;
  // Never turn an entirely quiet recording into a tiny fragment.
  if (peak < .006) return {samples, start: 0, end: samples.length, activityStart: null, activityEnd: null};
  const floor = sorted[Math.floor(sorted.length * .15)] || 0;
  const threshold = Math.max(.003, peak * .05, Math.min(floor * 3, peak * .25));
  const active = rms.map(value => value >= threshold);
  const first = active.indexOf(true), last = active.lastIndexOf(true);
  if (first < 0) return {samples, start: 0, end: samples.length, activityStart: null, activityEnd: null};
  const start = Math.max(0, first * windowSize - Math.round(rate * .08));
  const end = Math.min(samples.length, (last + 1) * windowSize + Math.round(rate * .15));
  return {samples: samples.slice(start, end), start, end, activityStart: first * windowSize, activityEnd: Math.min(samples.length, (last + 1) * windowSize)};
}

function processPitch(samples, rate, settings) {
  if (!settings.pitch && !settings.tuning && !settings.wobble) return Promise.resolve(samples);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./voice-pitch-worker.js', import.meta.url), {type: 'module'});
    worker.onmessage = ({data}) => {
      worker.terminate();
      if (data.error) reject(new Error(data.error));
      else resolve(data.samples);
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('The character pitch processor could not load. Reload the studio and try again.'));
    };
    // Copy before transfer so the original recording stays available.
    const copy = samples.slice();
    worker.postMessage({samples: copy, rate, settings}, [copy.buffer]);
  });
}

async function shapeTone(samples, rate, settings) {
  const context = new OfflineAudioContext(settings.deEss ? 2 : 1, samples.length, rate);
  const input = context.createBuffer(1, samples.length, rate);
  input.copyToChannel(samples, 0);
  const source = context.createBufferSource();
  source.buffer = input;
  let last = source;
  function filter(type, frequency, gain = 0, q = .8) {
    const node = context.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.gain.value = gain;
    node.Q.value = type === 'highpass' || type === 'lowpass' ? -3 : q;
    last.connect(node);
    last = node;
  }

  filter('highpass', settings.highpass);
  if (settings.body) filter('lowshelf', 180, settings.body);
  if (settings.mud) filter('peaking', 320, settings.mud);
  if (settings.horn) filter('peaking', 1250, settings.horn, 1.25);
  if (settings.presence) filter('peaking', 2700, settings.presence);
  if (settings.air) filter('highshelf', 6800, settings.air);
  for (const band of settings.characterBands || []) {
    filter('peaking', band.frequency, band.gain, band.q);
  }
  if (settings.drive) {
    if (settings.lowpass) filter('lowpass', settings.lowpass);
    const drive = context.createGain();
    const rms = activeRms(samples);
    // Keep the grit comparable across microphone levels while capping makeup gain.
    drive.gain.value = rms ? Math.min(2, Math.max(.25, .19 / rms)) : 1;
    const saturator = context.createWaveShaper();
    saturator.curve = Float32Array.from({length: 4097}, (_, i) => {
      const x = i / 2048 - 1;
      return Math.tanh(settings.drive * x) / settings.drive;
    });
    saturator.oversample = '4x';
    last.connect(drive).connect(saturator);
    last = saturator;
  }
  if (settings.lowpass) filter('lowpass', settings.lowpass);

  if (settings.deEss) {
    // Render the full voice and the sibilance band in sync for dynamic band reduction.
    const channels = context.createChannelMerger(2);
    last.connect(channels, 0, 0);
    filter('bandpass', 6500, 0, .9);
    last.connect(channels, 0, 1);
    channels.connect(context.destination);
  } else {
    last.connect(context.destination);
  }
  source.start();
  return context.startRendering();
}

function controlDynamics(samples, sibilance, rate, settings) {
  const coefficient = seconds => 1 - Math.exp(-1 / (seconds * rate));
  const detector = coefficient(.006), attack = coefficient(.007), release = coefficient(settings.release);
  const essAttack = coefficient(.002), essRelease = coefficient(.05);
  const essLimit = 1 - 10 ** (-(settings.deEss || 0) / 20);
  // Set the compressor threshold relative to the source level, with a quiet-signal floor.
  const threshold = Math.max(.015, activeRms(samples) * .8);
  let power = 0, essPower = 0, essReduction = 0, gain = 1;
  for (let i = 0; i < samples.length; i++) {
    let sample = samples[i];
    power += detector * (sample * sample - power);
    if (sibilance) {
      const band = sibilance[i];
      essPower += detector * (band * band - essPower);
      const excess = Math.sqrt(essPower / Math.max(power, .0001)) - .32;
      const reduction = Math.min(essLimit, Math.max(0, excess * 1.35));
      essReduction += (reduction > essReduction ? essAttack : essRelease) * (reduction - essReduction);
      sample -= band * essReduction;
    }
    const over = Math.max(1, Math.sqrt(power) / threshold);
    const target = over ** (1 / settings.ratio - 1);
    gain += (target < gain ? attack : release) * (target - gain);
    samples[i] = sample * gain;
  }
}

export async function processVoice(decoded, settings) {
  const rate = 32000, originalLength = Math.ceil(decoded.duration * rate);
  const resampler = new OfflineAudioContext(1, originalLength, rate);
  const source = resampler.createBufferSource();
  source.buffer = decoded;
  source.connect(resampler.destination);
  source.start();
  const mono = await resampler.startRendering();
  const originalSamples = mono.getChannelData(0);
  const trim = settings.autoTrim === false
    ? {samples: originalSamples, start: 0, end: originalLength}
    : trimSilence(originalSamples, rate);
  const pitched = await processPitch(trim.samples, rate, settings);
  const rendered = await shapeTone(pitched, rate, settings);
  const samples = rendered.getChannelData(0);
  const sibilance = settings.deEss ? rendered.getChannelData(1) : null;
  controlDynamics(samples, sibilance, rate, settings);
  if (settings.ringMix) {
    // Ring modulation multiplies the recorded signal, so silent regions stay silent.
    const phaseStep = 2 * Math.PI * settings.ringFrequency / rate;
    for (let i = 0; i < samples.length; i++) {
      samples[i] *= 1 - settings.ringMix + settings.ringMix * Math.cos(i * phaseStep);
    }
  }
  level(samples);
  return {
    processed: wav(rendered), original: wav(mono),
    trim: {start: trim.start / rate, end: trim.end / rate, removed: (originalLength - samples.length) / rate},
    duration: rendered.duration,
  };
}

export function wav(buffer) {
  // Game build's existing callout format: 32 kHz, stereo, signed 16-bit PCM.
  const samples = buffer.getChannelData(0), bytes = new ArrayBuffer(44 + samples.length * 4);
  const view = new DataView(bytes);
  const str = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  str(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); str(8, 'WAVE'); str(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * 4, true);
  view.setUint16(32, 4, true); view.setUint16(34, 16, true); str(36, 'data'); view.setUint32(40, samples.length * 4, true);
  samples.forEach((sample, i) => {
    const value = Math.round(Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 32768 : 32767));
    view.setInt16(44 + i * 4, value, true); view.setInt16(46 + i * 4, value, true);
  });
  return new Blob([bytes], {type: 'audio/wav'});
}
