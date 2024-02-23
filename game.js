// vim: set sw=4:ts=4:

function Game() {
  this.levels = [];
  this.idxCurrentLevel = 0;
  this.currentLevel = {};
  this.audioLibrary = new AudioLibrary([
    { name: "Snare", file: "snare.wav" },
    { name: "Kick", file: "kick.wav" },
    { name: "Open Hi-Hat", file: "hihat_open.wav" },
    { name: "Closed Hi-Hat", file: "hihat_closed.wav" },
    { name: "Crash", file: "crash.wav" },
    { name: "Cowbell", file: "cowbell.wav" },
    { name: "Stick", file: "stick.wav" },
  ]);
}

Game.prototype.isReady = function () {
  return this.audioLibrary.ready;
};

Game.prototype.nextLevel = function () {
  if (this.hasNextLevel()) {
    this.loadLevel(++this.idxCurrentLevel);
  } else {
    console.error("There is no next level, sorry!");
  }
};

Game.prototype.hasNextLevel = function () {
  var lastLevel = this.levels.length - 1;
  return this.idxCurrentLevel < lastLevel;
};

Game.prototype.loadLevel = function (idxLevel) {
  this.idxCurrentLevel = idxLevel || 0;
  this.currentLevel = { ...this.levels[this.idxCurrentLevel] };

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
      console.error(
        "Unexpected difference of number of steps: " +
          amountOfSteps +
          " != " +
          pattern.steps.length
      );
    }
  }
  this.currentLevel.amountOfSteps = amountOfSteps;
  console.log("Initialized level with amountOfSteps =", amountOfSteps);
};

Game.prototype.load = function (callback) {
  var request = new XMLHttpRequest();
  request.open("GET", "./levels.json");
  var game = this;

  request.onload = function () {
    game.levels = JSON.parse(request.response);
    game.loadLevel(0);
    callback();
  };

  request.onerror = function () {
    throw Error("BufferLoader: XHR error");
  };

  request.send();
};

Game.prototype.playTrackSampleOnce = function (track) {
  this.audioLibrary.playSampleAfter(track, 0);
};

Game.prototype.matchesCurrentLevelPattern = function (enteredPattern) {
  var matches = this.currentLevel.pattern.map(function (patt) {
    var enteredSteps = enteredPattern[patt.name];
    return JSON.stringify(enteredSteps) == JSON.stringify(patt.steps);
  });
  return matches.reduce(function (o, v) {
    return o && v;
  }, true);
};

Game.prototype.playCurrentLevelLoop = function (tickCallback, finishCallback) {
  /*
   * Play drump loop for the current level, calling tickCallback for every
   * pattern step along the way, and finishCallback when it's done playing.
   */
  if (!this.isReady()) {
    console.log("Not ready yet!");
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
      level.pattern.forEach(function (pattern) {
        if (pattern.steps[step] == 1) {
          self.audioLibrary.playSampleAfter(
            pattern.name,
            0.05 + startTime + durationSecs
          );
        }
      });
    }
  }
  setTimeout(finishCallback, barDuration * repeat * 1000);
};

function App($) {
  function displayPatternCanvas(level) {
    var container = $(".pattern-canvas");
    container.html("");
    var patternBoxes = [];
    level.pattern.forEach(function (track) {
      var row = $('<div class="track"></div>');
      row.append('<span class="track-name">' + track.name + "</span>");
      track.steps.forEach(function (on, index) {
        var box = $('<span class="box"><span></span></span>');
        box.data("index", index);
        box.data("track", track.name);
        box.addClass(on ? "" : "niet");
        row.append(box);
      });
      patternBoxes.push(row.find(".box"));
      container.append(row);
    });
    return patternBoxes;
  }

  function highlightPatternAtStep(step) {
    patternBoxes.forEach(function (boxes) {
      boxes.removeClass("on");
      if (step >= 0) {
        $(boxes[step]).addClass("on");
      }
    });
  }

  function stoppedPlaying() {
    highlightPatternAtStep(-1);
    $(".play-btn").removeAttr("disabled");
  }

  var patternBoxes = null;

  var game = new Game();
  game.load(function () {
    initCurrentLevel();
  });

  function tuplesToObject(tuples) {
    if (!tuples) {
      return {};
    }
    return tuples.reduce(function (o, v, i) {
      o[v[0]] = v[1];
      return o;
    }, {});
  }

  function getEnteredPattern() {
    return tuplesToObject(
      patternBoxes.map(function ($boxes) {
        var trackName = $($boxes[0]).data("track");
        var pattern = Array.from(
          $boxes.map(function (i, b) {
            return +$(b).hasClass("tick");
          })
        );
        return [trackName, pattern];
      })
    );
  }

  function handleBoxClicked() {
    var enteredPattern = getEnteredPattern();
    var $board = $(".board.playing");
    if (game.matchesCurrentLevelPattern(enteredPattern)) {
      if (game.hasNextLevel()) {
        var $board = $(".board");
        $board.find(".next-level-btn").show();
        $board
          .find(".level-title")
          .text("Yay! You passed level: " + game.currentLevel.name + " :)");
      } else {
        var $board = $(".board");
        $(".finished").show();
      }
    } else {
      $board.find(".next-level-btn").hide();
      $board.find(".level-title").text(game.currentLevel.name);
    }
  }

  function startNextLevel() {
    game.nextLevel();
    initCurrentLevel();
  }

  function initCurrentLevel() {
    var $board = $(".board");
    $board.addClass("playing");

    $board.html("");
    $board.append(
      $('<h2 class="level-title">' + game.currentLevel.name + "</h2>")
    );
    if (game.currentLevel.description) {
      $board.append(
        $('<p class="level-desc">' + game.currentLevel.description + "</p>")
      );
    }
    $board.append($('<div class="pattern-canvas"></div>'));
    $board.append($('<button class="btn play-btn">Listen rhythm</button>'));
    $board.append(
      $('<button class="btn primary-btn next-level-btn">Next Level</button>')
    );

    patternBoxes = displayPatternCanvas(game.currentLevel);

    $board.find(".next-level-btn").hide();
    $board.off("click", ".box");
    $board.on("click", ".box", function () {
      var $box = $(this),
        trackName = $box.data("track");
      $box.toggleClass("tick");
      game.playTrackSampleOnce(trackName);
      handleBoxClicked();
    });
  }

  $(".start-btn").click(function () {
    if (!game.isReady()) {
      console.log("Not ready yet!");
      return;
    }
    startNextLevel();
    $(this).remove();
  });

  $(document).on("click", ".play-btn", function () {
    if (!game.isReady()) {
      console.log("Not ready yet!");
      return;
    }
    $(this).attr("disabled", "disabled");
    game.playCurrentLevelLoop(highlightPatternAtStep, stoppedPlaying);
  });
  $(document).on("click", ".next-level-btn", function () {
    if (game.hasNextLevel()) {
      startNextLevel();
    }
  });
}

App(jQuery);
