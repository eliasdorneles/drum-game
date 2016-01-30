// vim: set sw=4:ts=4:
// BufferLoader stolen from: http://www.html5rocks.com/en/tutorials/webaudio/intro/js/buffer-loader.js
function BufferLoader(context, urlList, callback) {
  this.context = context;
  this.urlList = urlList;
  this.onload = callback;
  this.bufferList = new Array();
  this.loadCount = 0;
}

BufferLoader.prototype.loadBuffer = function(url, index) {
  // Load buffer asynchronously
  var request = new XMLHttpRequest();
  request.open("GET", url, true);
  request.responseType = "arraybuffer";

  var loader = this;

  request.onload = function() {
    // Asynchronously decode the audio file data in request.response
    loader.context.decodeAudioData(
      request.response,
      function(buffer) {
        if (!buffer) {
          alert('error decoding file data: ' + url);
          return;
        }
        loader.bufferList[index] = buffer;
        if (++loader.loadCount == loader.urlList.length)
          loader.onload(loader.bufferList);
      },
      function(error) {
        console.error('decodeAudioData error', error);
      }
    );
  }

  request.onerror = function() {
    alert('BufferLoader: XHR error');
  }

  request.send();
}

BufferLoader.prototype.load = function() {
  for (var i = 0; i < this.urlList.length; ++i)
  this.loadBuffer(this.urlList[i], i);
}


function AudioLibrary(samples) {
    this.samples = samples;
    this.audioContext = new AudioContext() || WebkitAudioContext() || MozAudioContext();
}

AudioLibrary.prototype.getCurrentTime = function() {
    return this.audioContext.currentTime;
}

AudioLibrary.prototype.init = function(callback) {
    var urls = this.samples.map(function(f){ return "samples/" + f.file});
    var parent = this;
    var bufferLoader = new BufferLoader(this.audioContext, urls, function(buffers){
        for (var i = 0; i < buffers.length; i++) {
            parent.samples[i].buffer = buffers[i];
        }
        callback();
    });
    bufferLoader.load();
}

AudioLibrary.prototype.getSampleBuffer = function (name) {
    var sample = this.samples.find(function(s){ return s.name == name; });
    if (!sample) {
        throw Error("Sample not found: " + name);
    }
    return sample.buffer;
}

AudioLibrary.prototype.schedulePlaySample = function(name, time) {
    var buffer = this.getSampleBuffer(name);
    var source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    if (!source.start) {
        source.start = source.noteOn;
    }
    source.start(time);
}


function Game($) {
    var samples = [
        {
            "name": "Snare",
            "file": "snare.wav",
        },
        {
            "name": "Kick",
            "file": "kick.wav",
        },
        {
            "file": "hihat_open.wav",
            "name": "Open Hi-Hat",
        },
        {
            "file": "hihat_closed.wav",
            "name": "Closed Hi-Hat",
        },
        {
            "file": "crash.wav",
            "name": "Crash",
        },
        {
            "file": "cowbell.wav",
            "name": "Cowbell",
        },
        {
            "file": "stick.wav",
            "name": "Stick",
        },
    ];
    var levels = [
        {
            "name": "Training",
            "bpm": 200,
            "pattern": [
                {
                    "name": "Snare",
                    "steps": [0,0,1,0,0,0,1,0],
                },
                {
                    "name": "Kick",
                    "steps": [1,0,0,1,1,0,0,0],
                },
            ]
        },
        {
            "name": "On the up",
            "bpm": 240,
            "pattern": [
                {
                "name": "Kick",
                "steps": [1,0,0,1,1,0,0,0],
                },
                {
                    "name": "Snare",
                    "steps": [0,0,1,0,0,0,1,0],
                },
            ]
        },
    ];

    function initLevel(level) {
        currentLevel = $.extend({}, level);
        var numSteps = 0;
        for (var i = 0; i < level.pattern.length; i++) {
            var pattern = level.pattern[i];
            if (i == 0) {
                numSteps = pattern.steps.length;
            }
            if (numSteps != pattern.steps.length) {
                console.error("Unexpected difference of number of steps: " +
                              numSteps + " != " + pattern.steps.length);
            }
        }
        console.log("Initialized level with numSteps =", numSteps);
        currentLevel.numSteps = numSteps;
    }

    function createStepLights(level) {
        var container = $('.step-lights');
        for (var i = 0; i < level.numSteps; i++) {
            container.append('<span class="light"></span>');
        }
        return container.children();
    }

    function createPatternCanvas(level, showPattern) {
        var container = $('.pattern-canvas');
        var patternBoxes = [];
        level.pattern.forEach(function(track){
            var row = $('<div class="track"></div>')
            row.append('<span class="track-name">' + track.name + '</span>');
            track.steps.forEach(function(on){
                var box = $('<span class="box"><span></span></span>');
                if (on && showPattern) {
                    box.addClass('tick');
                }
                row.append(box);
            });
            patternBoxes.push(row.find('.box'))
            container.append(row);
        });
        return patternBoxes;
    }

    function updateLights(step) {
        patternBoxes.forEach(function(boxes) {
            boxes.removeClass('on');
            if (step >= 0) {
                $(boxes[step]).addClass('on');
            }
        });
    }

    function stoppedPlaying() {
        updateLights(-1);
        playButton.removeAttr('disabled');
    }

    function playLoop(level) {
        if (!isReady) {
            console.log('Not ready yet!');
            return;
        }

        var startTime = audioLibrary.getCurrentTime();
        var repeat = 3;
        var beatDuration = 60 / level.bpm;
        var barDuration = beatDuration * level.numSteps;
        for (var currentBar = 0; currentBar < repeat; currentBar++) {
            for (var step = 0; step < level.numSteps; step++) {
                var durationSecs = currentBar * barDuration + step * beatDuration;
                setTimeout(updateLights, durationSecs * 1000, step);
                level.pattern.forEach(function(pattern){
                    if (pattern.steps[step] == 1) {
                        audioLibrary.schedulePlaySample(pattern.name,
                                                        startTime + durationSecs);
                    }
                });
            }
        }
        setTimeout(stoppedPlaying, barDuration * repeat * 1000);
    }

    var currentLevel = null;
    var isReady = false;
    var audioLibrary = new AudioLibrary(samples);
    audioLibrary.init(function(){
        isReady = true;
    });
    initLevel(levels[0]);
    var patternBoxes = createPatternCanvas(currentLevel, true);
    var playButton = $('.play-btn');

    playButton.click(function(){
        if (isReady) {
            playButton.attr('disabled', 'disabled');
            playLoop(currentLevel);
        } else {
            console.log('Not ready yet!');
        }
    });
};

Game(jQuery);
