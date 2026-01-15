// vim: set sw=4:ts=4:

async function loadAudioBuffer(context, url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load audio file: ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await context.decodeAudioData(arrayBuffer);
  if (!audioBuffer) {
    throw new Error(`Failed to decode audio file: ${url}`);
  }
  return audioBuffer;
}

async function loadAudioBuffers(context, urls) {
  return Promise.all(urls.map((url) => loadAudioBuffer(context, url)));
}

/*
 * AudioLibrary
 * Represents a collection of playable audio samples
 */
class AudioLibrary {
  constructor(samples) {
    // Each sample can have: { name, file, volume (optional, default 1.0) }
    this.samples = samples.map((s) => ({
      ...s,
      volume: s.volume ?? 1.0,
    }));
    this.ready = false;
    this.masterVolume = 1.0;
    this.audioContext = new AudioContext();

    // Master gain node - all audio routes through this
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);

    const urls = this.samples.map((f) => `samples/${f.file}`);

    loadAudioBuffers(this.audioContext, urls).then((buffers) => {
      for (let i = 0; i < buffers.length; i++) {
        this.samples[i].buffer = buffers[i];
      }
      this.ready = true;
    });
  }

  getCurrentTime() {
    return this.audioContext.currentTime;
  }

  getSample(name) {
    const sample = this.samples.find((s) => s.name === name);
    if (!sample) {
      throw new Error(`Sample not found: ${name}`);
    }
    return sample;
  }

  getSampleBuffer(name) {
    return this.getSample(name).buffer;
  }

  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.masterGain.gain.value = this.masterVolume;
  }

  playSampleAfter(name, time, volume = 1.0) {
    const sample = this.getSample(name);
    const source = this.audioContext.createBufferSource();
    source.buffer = sample.buffer;

    // Per-sample volume (sample's configured volume * passed volume)
    // Master volume is handled by the masterGain node
    const sampleVolume = sample.volume * volume;

    if (sampleVolume < 1.0) {
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = sampleVolume;
      source.connect(gainNode);
      gainNode.connect(this.masterGain);
    } else {
      source.connect(this.masterGain);
    }

    source.start(time);
  }

  stopAll() {
    this.audioContext.suspend();
  }

  resumeAll() {
    this.audioContext.resume();
  }

  restart() {
    const savedVolume = this.masterVolume;
    this.audioContext = new AudioContext();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    this.masterGain.gain.value = savedVolume;
    this.masterVolume = savedVolume;
  }
}
