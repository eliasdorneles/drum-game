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
    var currentLevel = levels[0];
    var audioContext = new AudioContext() || WebkitAudioContext() || MozAudioContext();
    var isReady = false;
    var urlList = currentLevel.pattern.map(function(f){ return "/samples/" + f.file});;
    var bufferLoader = new BufferLoader(audioContext, urlList, function(bufferList){
        isReady = true;
        for (var i = 0; i < bufferList.length; i++) {
            currentLevel.pattern[i].buffer = bufferList[i];
        }
    });
    console.log(bufferLoader);
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

    var stepLights = $('ul.step-lights > li');

    function updateLights(position, index) {
        stepLights.removeClass('on');
        $(stepLights[position]).addClass('on');
    }

    function playLoop(level) {
        if (!isReady) {
            console.log('Not ready yet!');
            return;
        }
        // TODO: assert that pattern[*].steps are all the same size
        console.log('Ready!', level);
        var startTime = audioContext.currentTime;
        var repeat = 3;
        var nSteps = level.pattern[0].steps.length;
        var beatDuration = 60 / level.bpm;
        var barDuration = beatDuration * nSteps;
        for (var currentBar = 0; currentBar < repeat; currentBar++) {
            for (var j = 0; j < nSteps; j++) {
                level.pattern.forEach(function(pat){
                    var durationSecs = currentBar * barDuration + j * beatDuration;
                    setTimeout(updateLights, durationSecs * 1000, j);
                    if (pat.steps[j] == 1) {
                        playSound(pat.buffer, startTime + durationSecs);
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
