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

AudioLibrary.prototype.playSampleAfter = function(name, time) {
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

Game.prototype.isDemoLevel = function() {
    return this.currentLevel.demo;
}

Game.prototype.nextLevel = function() {
    if (this.hasNextLevel()) {
        this.loadLevel(++this.idxCurrentLevel);
    } else {
        console.error('There is no next level, sorry!');
    }
}

Game.prototype.hasNextLevel = function() {
    var lastLevel = this.levels.length - 1;
    return this.idxCurrentLevel < lastLevel;
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
  request.open("GET", "./levels.json");
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

Game.prototype.playTrackSampleOnce = function(track) {
    this.audioLibrary.playSampleAfter(track, 0);
}

Game.prototype.matchesCurrentLevelPattern = function(enteredPattern) {
    var matches = this.currentLevel.pattern.map(function(patt){
        var enteredSteps = enteredPattern[patt.name];
        return JSON.stringify(enteredSteps) == JSON.stringify(patt.steps);
    });
    return matches.reduce(function(o, v){ return o && v; }, true);
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
    var repeat = 2;
    var beatDuration = 60 / level.bpm;
    var barDuration = beatDuration * level.amountOfSteps;
    var self = this;
    for (var currentBar = 0; currentBar < repeat; currentBar++) {
        for (var step = 0; step < level.amountOfSteps; step++) {
            var durationSecs = currentBar * barDuration + step * beatDuration;
            setTimeout(tickCallback, durationSecs * 1000, step);
            level.pattern.forEach(function(pattern){
                if (pattern.steps[step] == 1) {
                    self.audioLibrary.playSampleAfter(pattern.name,
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
            track.steps.forEach(function(on, index){
                var box = $('<span class="box"><span></span></span>');
                box.data('index', index);
                box.data('track', track.name);
                if (on) {
                    box.addClass(demo ? 'tick' : '');
                } else {
                    box.addClass(demo ? '' : 'niet');
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

    function toObject(tuples) {
        if (!tuples) { return {}; }
        return tuples.reduce(function(o, v, i){ o[v[0]] = v[1]; return o; }, {});
    }

    function getEnteredPattern() {
        return toObject(patternBoxes.map(function($boxes){
            var trackName = $($boxes[0]).data('track');
            var pattern = Array.from($boxes.map(function(i, b){ return +$(b).hasClass('tick'); }));
            return [trackName, pattern];
        }));
    }

    function handleBoxClicked() {
        var enteredPattern = getEnteredPattern();
        var $board = $('.board.playing')
        if (game.matchesCurrentLevelPattern(enteredPattern)) {
            if (game.hasNextLevel()) {
                setTimeout(startNextLevel, 200);
            } else {
                var $board = $('.board');
                $board.html('');
                $board.append($('<h2 class="woo-hoo">Woo-hoo, you finished the game, congrats!</h2>'));
                $board.append($('<a href="." class="primary-btn start-btn">Play again</a>'));
            }
        }
    }

    function startNextLevel() {
        var firstLevel = game.isDemoLevel();
        game.nextLevel();

        var $board = $('.board')
        $board.addClass('playing');
        var delay = 1000;
        if (firstLevel) {
            delay = 0;
        } else {
            $board.html('<h2 class="woo-hoo">Yay!<br>Next level: ' + game.currentLevel.name + '<h2>');
        }

        setTimeout(function(){
            $board.html('');
            $board.append($('<h2 class="level-title">' + game.currentLevel.name + '</h2>'));
            if (game.currentLevel.description) {
                $board.append($('<p class="level-desc">' + game.currentLevel.description + '</p>'));
            }
            $board.append($('<div class="pattern-canvas"></div>'));
            $board.append($('<button class="primary-btn play-btn">Listen rhythm</button>'));

            patternBoxes = displayPatternCanvas(game.currentLevel, false);

            $board.off('click', '.box');
            $board.on('click', '.box', function(){
                var $box = $(this), trackName = $box.data('track');
                $box.toggleClass('tick');
                game.playTrackSampleOnce(trackName);
                handleBoxClicked();
            });
        }, delay);
    }

    $('.start-btn').click(function(){
        if (game.isReady()) {
            startNextLevel();
            $(this).remove();
        } else {
            console.log('Not ready yet!');
        }
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
};

App(jQuery);
