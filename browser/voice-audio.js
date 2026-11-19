// Offline processing keeps exported audio identical to the preview.
export const PRESETS = {
  party: {name: 'Finni Party', pitch: 2, compression: 65, highpass: 100, targetDb: -18},
  natural: {name: 'Natural', pitch: 0, compression: 40, highpass: 80, targetDb: -18},
  toy: {name: 'Toy Friend', pitch: 5, compression: 70, highpass: 140, targetDb: -18},
};

// Overlapping Hann-windowed grains change pitch without changing line length.
export function pitchShift(input, sampleRate, semitones) {
  if (!semitones) return input.slice();
  const ratio = 2 ** (semitones / 12);
  const grain = Math.round(sampleRate * .06), hop = Math.floor(grain / 4);
  const out = new Float32Array(input.length), weights = new Float32Array(input.length);
  for (let start = -grain; start < input.length; start += hop) {
    for (let j = 0; j < grain; j++) {
      const dest = start + j;
      if (dest < 0 || dest >= out.length) continue;
      const position = start + grain / 2 + (j - grain / 2) * ratio;
      const index = Math.floor(position), fraction = position - index;
      if (index < 0 || index + 1 >= input.length) continue;
      const weight = .5 - .5 * Math.cos(2 * Math.PI * j / (grain - 1));
      out[dest] += (input[index] * (1 - fraction) + input[index + 1] * fraction) * weight;
      weights[dest] += weight;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = weights[i] > .001 ? out[i] / weights[i] : 0;
  return out;
}

export function level(samples, targetDb = -18) {
  let sum = 0, count = 0, peak = 0;
  for (const value of samples) {
    peak = Math.max(peak, Math.abs(value));
    // Exclude silence so pauses do not drive excessive makeup gain.
    if (Math.abs(value) > .01) { sum += value * value; count++; }
  }
  if (!count || peak < .0001) return samples;
  const gain = Math.min(10 ** (targetDb / 20) / Math.sqrt(sum / count), .891 / peak, 4);
  const fade = Math.min(160, Math.floor(samples.length / 2));
  for (let i = 0; i < samples.length; i++) {
    samples[i] *= gain * Math.min(1, i / fade, (samples.length - 1 - i) / fade);
  }
  return samples;
}

export async function processVoice(decoded, settings) {
  const rate = 32000, length = Math.ceil(decoded.duration * rate);
  const resampler = new OfflineAudioContext(1, length, rate);
  const source = resampler.createBufferSource();
  source.buffer = decoded; source.connect(resampler.destination); source.start();
  const mono = await resampler.startRendering();
  const context = new OfflineAudioContext(1, length, rate);
  const shifted = context.createBuffer(1, length, rate);
  shifted.copyToChannel(pitchShift(mono.getChannelData(0), rate, settings.pitch), 0);
  const voice = context.createBufferSource(); voice.buffer = shifted;
  const filter = context.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = settings.highpass;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -10 - settings.compression * .24;
  compressor.ratio.value = 1 + settings.compression * .05;
  compressor.knee.value = 18; compressor.attack.value = .006; compressor.release.value = .12;
  voice.connect(filter); filter.connect(compressor); compressor.connect(context.destination); voice.start();
  const rendered = await context.startRendering();
  level(rendered.getChannelData(0), settings.targetDb);
  return {processed: wav(rendered), original: wav(mono)};
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
