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


function Game($) {
    var levels = [
        {
            "name": "Training",
            "bpm": 120,
            "pattern": [
                {
                "name": "Kick",
                "file": "kick.wav",
                "steps": [1,0,0,0],
                },
                {
                    "name": "Snare",
                    "file": "snare.wav",
                    "steps": [0,0,1,0],
                },
            ]
        },
    ];
    var currentLevel = null;
    var isReady = false;

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
        console.log("numSteps", numSteps);
        currentLevel.numSteps = numSteps;
    }
    initLevel(levels[0]);

    var audioContext = new AudioContext() || WebkitAudioContext() || MozAudioContext();
    var urlList = currentLevel.pattern.map(function(f){ return "/samples/" + f.file});;

    var bufferLoader = new BufferLoader(audioContext, urlList, function(bufferList){
        isReady = true;
        for (var i = 0; i < bufferList.length; i++) {
            currentLevel.pattern[i].buffer = bufferList[i];
        }
    });
    bufferLoader.load();

    function playSound(buffer, time) {
        var source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        if (!source.start) {
            source.start = source.noteOn;
        }
        source.start(time);
    }

    function createStepLights(level) {
        var container = $('ul.step-lights');
        for (var i = 0; i < level.numSteps; i++) {
            container.append('<li>o</li>');
        }
        return $('ul.step-lights > li');
    }

    var stepLights = createStepLights(currentLevel);

    function updateLights(step, index) {
        stepLights.removeClass('on');
        $(stepLights[step]).addClass('on');
    }

    function playLoop(level) {
        if (!isReady) {
            console.log('Not ready yet!');
            return;
        }

        var startTime = audioContext.currentTime;
        var repeat = 3;
        var beatDuration = 60 / level.bpm;
        var barDuration = beatDuration * level.numSteps;
        for (var currentBar = 0; currentBar < repeat; currentBar++) {
            for (var step = 0; step < level.numSteps; step++) {
                level.pattern.forEach(function(pattern){
                    var durationSecs = currentBar * barDuration + step * beatDuration;
                    setTimeout(updateLights, durationSecs * 1000, step);
                    if (pattern.steps[step] == 1) {
                        playSound(pattern.buffer, startTime + durationSecs);
                    }
                });
            }
        }
    }

    $('.play-btn').click(function(){
        playLoop(currentLevel);
    });
};

Game(jQuery);
