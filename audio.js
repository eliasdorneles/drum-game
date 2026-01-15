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
    this.audioContext = new AudioContext();

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

  playSampleAfter(name, time, volume = 1.0) {
    const sample = this.getSample(name);
    const source = this.audioContext.createBufferSource();
    source.buffer = sample.buffer;

    // Combine sample's configured volume with the passed volume
    const finalVolume = sample.volume * volume;

    if (finalVolume < 1.0) {
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = finalVolume;
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
    } else {
      source.connect(this.audioContext.destination);
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
    this.audioContext = new AudioContext();
  }
}
