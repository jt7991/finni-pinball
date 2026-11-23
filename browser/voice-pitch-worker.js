import {phaseLock, PitchDetector} from './vendor/voice-pitch.js';

function nearestNote(midi, scale) {
  let closest = Math.round(midi), distance = Infinity;
  for (let note = Math.floor(midi) - 12; note <= Math.ceil(midi) + 12; note++) {
    if (!scale.includes((note % 12 + 12) % 12)) continue;
    const difference = Math.abs(note - midi);
    if (difference < distance) { closest = note; distance = difference; }
  }
  return closest;
}

function tuningRatios(samples, rate, mode) {
  const size = 2048, hop = 256;
  const detector = PitchDetector.forFloat32Array(size);
  const frame = new Float32Array(size), pitches = [];
  // Center each detector window on the same time used by the pitch shifter.
  for (let position = 0; position < samples.length; position += hop) {
    frame.fill(0);
    const start = position - size / 2;
    const from = Math.max(0, start), end = Math.min(samples.length, start + size);
    frame.set(samples.subarray(from, end), from - start);
    const [frequency, clarity] = detector.findPitch(frame, rate);
    pitches.push(clarity >= .8 && frequency >= 65 && frequency <= 1000
      ? 69 + 12 * Math.log2(frequency / 440) : null);
  }
  const voiced = pitches.filter(value => value !== null).sort((a, b) => a - b);
  const heldNote = voiced.length ? Math.round(voiced[Math.floor(voiced.length / 2)]) : 60;
  const major = [0, 2, 4, 5, 7, 9, 11];
  const ratios = pitches.map(midi => {
    if (midi === null) return 1;
    const target = mode === 'held' ? heldNote : nearestNote(midi, major);
    // Bound extreme detector jumps while keeping the deliberate hard tuning.
    return 2 ** (Math.max(-12, Math.min(12, target - midi)) / 12);
  });
  return time => ratios[Math.max(0, Math.min(ratios.length - 1, Math.round(time * rate / hop)))];
}

self.onmessage = ({data: {samples, rate, settings}}) => {
  try {
    let ratio = 2 ** ((settings.pitch || 0) / 12);
    if (settings.tuning) ratio = tuningRatios(samples, rate, settings.tuning);
    if (settings.wobble) {
      const base = settings.pitch || 0;
      ratio = time => 2 ** ((base + settings.wobble * Math.sin(2 * Math.PI * 5 * time)) / 12);
    }
    const shifted = phaseLock(samples, {ratio, sampleRate: rate, frameSize: 2048, hopSize: 256});
    if (shifted.length !== samples.length || !shifted.every(Number.isFinite)) {
      throw Error('The pitch processor returned invalid audio.');
    }
    self.postMessage({samples: shifted}, [shifted.buffer]);
  } catch (error) {
    self.postMessage({error: error.message || 'Pitch processing failed.'});
  }
};
