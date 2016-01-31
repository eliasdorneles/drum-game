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
    throw Error('BufferLoader: XHR error');
  }

  request.send();
}

BufferLoader.prototype.load = function() {
  for (var i = 0; i < this.urlList.length; ++i)
  this.loadBuffer(this.urlList[i], i);
}


function AudioLibrary(samples) {
    this.samples = samples;
    this.ready = false;
    this.audioContext = new AudioContext() || WebkitAudioContext() || MozAudioContext();

    var urls = this.samples.map(function(f){ return "samples/" + f.file});
    var self = this;
    var bufferLoader = new BufferLoader(this.audioContext, urls, function(buffers){
        for (var i = 0; i < buffers.length; i++) {
            self.samples[i].buffer = buffers[i];
        }
        self.ready = true;
    });
    bufferLoader.load();
}

AudioLibrary.prototype.getCurrentTime = function() {
    return this.audioContext.currentTime;
}

AudioLibrary.prototype.getSampleBuffer = function (name) {
    var sample = this.samples.find(function(s){ return s.name == name; });
    if (!sample) {
        throw Error("Sample not found: " + name);
    }
    return sample.buffer;
}

AudioLibrary.prototype.playSampleAt = function(name, time) {
    var buffer = this.getSampleBuffer(name);
    var source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    if (!source.start) {
        source.start = source.noteOn;
    }
    source.start(time);
}

function Game() {
    this.levels = [];
    this.idxCurrentLevel = 0;
    this.currentLevel = {};
    this.audioLibrary = new AudioLibrary([
        {"name": "Snare", "file": "snare.wav"},
        {"name": "Kick", "file": "kick.wav"},
        {"file": "hihat_open.wav", "name": "Open Hi-Hat"},
        {"file": "hihat_closed.wav", "name": "Closed Hi-Hat"},
        {"file": "crash.wav", "name": "Crash"},
        {"file": "cowbell.wav", "name": "Cowbell"},
        {"file": "stick.wav", "name": "Stick"},
    ]);
}

Game.prototype.isReady = function() {
    return this.audioLibrary.ready;
}

Game.prototype.nextLevel = function() {
    var lastLevel = this.levels.length - 1;
    if (this.idxCurrentLevel < lastLevel) {
        this.loadLevel(++this.idxCurrentLevel);
    } else {
        console.log('Finished all levels, congrats!');
    }
}

Game.prototype.loadLevel = function (idxLevel) {
    this.idxCurrentLevel = idxLevel || 0;
    this.currentLevel = $.extend({}, this.levels[this.idxCurrentLevel]);

    var amountOfSteps = 0;
    if (!this.currentLevel.pattern) {
        throw Error("Level has no pattern configured");
    }
    for (var i = 0; i < this.currentLevel.pattern.length; i++) {
        var pattern = this.currentLevel.pattern[i];
        if (i == 0) {
            amountOfSteps = pattern.steps.length;
        }
        if (amountOfSteps != pattern.steps.length) {
            console.error("Unexpected difference of number of steps: " +
                          amountOfSteps + " != " + pattern.steps.length);
        }
    }
    this.currentLevel.amountOfSteps = amountOfSteps;
    console.log("Initialized level with amountOfSteps =", amountOfSteps);
}

Game.prototype.load = function(callback) {
  var request = new XMLHttpRequest();
  request.open("GET", "/levels.json");
  var game = this;

  request.onload = function() {
      game.levels = JSON.parse(request.response)
      game.loadLevel(0);
      callback();
  }

  request.onerror = function() {
    throw Error('BufferLoader: XHR error');
  }

  request.send();
}

Game.prototype.playCurrentLevelLoop = function(tickCallback, finishCallback) {
    /*
     * Play drump loop for the current level, calling tickCallback for every
     * pattern step along the way, and finishCallback when it's done playing.
     */
    if (!this.isReady()) {
        console.log('Not ready yet!');
        return;
    }

    var level = this.currentLevel;
    var startTime = this.audioLibrary.getCurrentTime();
    var repeat = 3;
    var beatDuration = 60 / level.bpm;
    var barDuration = beatDuration * level.amountOfSteps;
    var self = this;
    for (var currentBar = 0; currentBar < repeat; currentBar++) {
        for (var step = 0; step < level.amountOfSteps; step++) {
            var durationSecs = currentBar * barDuration + step * beatDuration;
            setTimeout(tickCallback, durationSecs * 1000, step);
            level.pattern.forEach(function(pattern){
                if (pattern.steps[step] == 1) {
                    self.audioLibrary.playSampleAt(pattern.name,
                                              0.05 + startTime + durationSecs);
                }
            });
        }
    }
    setTimeout(finishCallback, barDuration * repeat * 1000);
}


function App($) {
    function displayPatternCanvas(level, demo) {
        var container = $('.pattern-canvas');
        container.html('');
        var patternBoxes = [];
        level.pattern.forEach(function(track){
            var row = $('<div class="track"></div>')
            row.append('<span class="track-name">' + track.name + '</span>');
            track.steps.forEach(function(on){
                var box = $('<span class="box"><span></span></span>');
                if (on && demo) {
                    box.addClass('tick');
                }
                row.append(box);
            });
            patternBoxes.push(row.find('.box'))
            container.append(row);
        });
        return patternBoxes;
    }

    function highlightPatternAtStep(step) {
        patternBoxes.forEach(function(boxes) {
            boxes.removeClass('on');
            if (step >= 0) {
                $(boxes[step]).addClass('on');
            }
        });
    }

    function stoppedPlaying() {
        highlightPatternAtStep(-1);
        $('.play-btn').removeAttr('disabled');
    }

    var patternBoxes = null;

    var game = new Game();
    game.load(function(){
        patternBoxes = displayPatternCanvas(game.currentLevel, true);
    });

    $(document).on('click', '.play-btn', function(){
        if (game.isReady()) {
            $(this).attr('disabled', 'disabled');
            game.playCurrentLevelLoop(
                highlightPatternAtStep,
                stoppedPlaying
            );
        } else {
            console.log('Not ready yet!');
        }
    });

    function startGame() {
        game.nextLevel();

        var $board = $('.board')
        $board.addClass('playing');
        $board.html('');
        $board.append($('<h2>' + game.currentLevel.name + '</h2>'));
        $board.append($('<button class="primary-btn play-btn">Play pattern</button>'));
        $board.append($('<div class="pattern-canvas"></div>'));

        patternBoxes = displayPatternCanvas(game.currentLevel, false);
        $('.play-btn').click();

        $board.on('click', '.box', function(){
            var $box = $(this);
            $box.toggleClass('tick');
            console.log('enabled', $box.hasClass('tick'));
        })
    }

    $('.start-btn').click(function(){
        if (game.isReady()) {
            startGame();
            $(this).remove();
        } else {
            console.log('Not ready yet!');
        }
    });
};

App(jQuery);
