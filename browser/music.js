// A one-sample silent WAV lets the Start gesture authorize the shared player.
const silence = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==';
const musicUrl = track => `/music/${track}.mp3`;

export function createMusic(report) {
  const sources = new Map();
  const positions = new Map();
  let audio, context, gain, loading, seekOnPlay;
  let requested = '', loaded = '';

  function load(track) {
    if (!sources.has(track)) {
      // Local builds use Python's file server, which serves whole files. Blob
      // URLs let the player seek even without HTTP range support.
      const source = fetch(musicUrl(track)).then(response => {
        if (!response.ok) throw Error(`Soundtrack file unavailable (${response.status})`);
        return response.blob();
      }).then(blob => URL.createObjectURL(blob)).catch(error => {
        sources.delete(track);
        throw error;
      });
      sources.set(track, source);
    }
    return sources.get(track);
  }

  function reportPlayError(error) {
    if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') report(error.message);
  }

  function pause() {
    if (loaded && !audio.paused) {
      positions.set(loaded, audio.currentTime);
      seekOnPlay = true;
    }
    audio.pause();
  }

  function resume() {
    if (!requested || document.hidden) return;
    if (context && context.state !== 'running') void context.resume().catch(reportPlayError);
    if (requested === loaded) {
      if (audio.paused) {
        if (seekOnPlay) {
          audio.currentTime = positions.get(loaded) ?? 0;
          seekOnPlay = false;
        }
        void audio.play().catch(reportPlayError);
      }
      return;
    }
    if (loading === requested) return;
    const track = requested;
    loading = track;
    // WebKit ports without Web Audio can play HTTP media but may reject blobs.
    const source = context ? load(track) : Promise.resolve(musicUrl(track));
    void source.then(url => {
      if (requested !== track || loaded === track) return;
      // Keep the outgoing song playing while a mode's file downloads.
      pause();
      loaded = track;
      audio.src = url;
      audio.loop = true;
      seekOnPlay = true;
      resume();
    }).catch(error => {
      if (requested === track) report(error.message);
    }).finally(() => {
      if (loading === track) loading = undefined;
    });
  }

  function unlock() {
    if (audio) return true;
    const player = new Audio(silence);
    if (!player.canPlayType('audio/mpeg')) return false;
    audio = player;
    try {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (AudioContextClass) {
        context = new AudioContextClass();
        const volume = context.createGain();
        context.createMediaElementSource(audio).connect(volume).connect(context.destination);
        gain = volume;
        void context.resume().catch(reportPlayError);
      }
    } catch (error) {
      if (context) void context.close().catch(() => {});
      context = undefined;
      report(error.message);
    }
    void audio.play().catch(reportPlayError);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause();
      else resume();
    });
    // A user gesture can restore playback after a browser or OS interruption.
    window.addEventListener('pointerup', resume, true);
    window.addEventListener('keydown', resume, true);
    return true;
  }

  function select(track, volume = 0) {
    if (!audio) return;
    if (gain) gain.gain.value = volume;
    else audio.volume = volume;
    if (track === requested) return;
    requested = track;
    if (track) resume();
    else pause();
  }

  return {
    unlock, select,
    preload() {
      if (window.AudioContext || window.webkitAudioContext) void load('mu_hellhouse1').catch(() => {});
    },
  };
}
