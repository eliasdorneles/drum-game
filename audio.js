// vim: set sw=4:ts=4:
// BufferLoader adapted from: http://www.html5rocks.com/en/tutorials/webaudio/intro/js/buffer-loader.js
class BufferLoader {
  constructor(context, urlList, callback) {
    this.context = context;
    this.urlList = urlList;
    this.onload = callback;
    this.bufferList = new Array();
    this.loadCount = 0;
  }

  loadBuffer(url, index) {
    // Load buffer asynchronously
    const request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";

    const loader = this;

    request.onload = function () {
      // Asynchronously decode the audio file data in request.response
      loader.context.decodeAudioData(
        request.response,
        function (buffer) {
          if (!buffer) {
            alert("error decoding file data: " + url);
            return;
          }
          loader.bufferList[index] = buffer;
          if (++loader.loadCount == loader.urlList.length)
            loader.onload(loader.bufferList);
        },
        function (error) {
          console.error("decodeAudioData error", error);
        }
      );
    };

    request.onerror = function () {
      throw Error("BufferLoader: XHR error");
    };

    request.send();
  }

  load() {
    for (let i = 0; i < this.urlList.length; ++i)
      this.loadBuffer(this.urlList[i], i);
  }
}

/*
 * AudioLibrary
 * Represents a collection of playable audio samples
 */
class AudioLibrary {
  constructor(samples) {
    this.samples = samples;
    this.ready = false;
    this.audioContext =
      new AudioContext() || WebkitAudioContext() || MozAudioContext();

    const urls = this.samples.map((f) => "samples/" + f.file);

    const self = this;
    const bufferLoader = new BufferLoader(this.audioContext, urls, function (
      buffers
    ) {
      for (let i = 0; i < buffers.length; i++) {
        self.samples[i].buffer = buffers[i];
      }
      self.ready = true;
    });
    bufferLoader.load();
  }

  getCurrentTime() {
    return this.audioContext.currentTime;
  }

  getSampleBuffer(name) {
    const sample = this.samples.find(function (s) {
      return s.name == name;
    });
    if (!sample) {
      throw Error("Sample not found: " + name);
    }
    return sample.buffer;
  }

  playSampleAfter(name, time) {
    const buffer = this.getSampleBuffer(name);
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    if (!source.start) {
      source.start = source.noteOn;
    }
    source.start(time);
  }
}
