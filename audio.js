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
    this.samples = samples;
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

  getSampleBuffer(name) {
    const sample = this.samples.find((s) => s.name === name);
    if (!sample) {
      throw new Error(`Sample not found: ${name}`);
    }
    return sample.buffer;
  }

  playSampleAfter(name, time, volume = 1.0) {
    const buffer = this.getSampleBuffer(name);
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    if (volume < 1.0) {
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = volume;
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
