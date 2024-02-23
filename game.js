// vim: set sw=4:ts=4:

class Game {
  constructor() {
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

  isReady() {
    return this.audioLibrary.ready;
  }

  nextLevel() {
    if (this.hasNextLevel()) {
      this.loadLevel(++this.idxCurrentLevel);
    } else {
      console.error("There is no next level, sorry!");
    }
  }

  hasNextLevel() {
    const lastLevel = this.levels.length - 1;
    return this.idxCurrentLevel < lastLevel;
  }

  loadLevel(idxLevel) {
    this.idxCurrentLevel = idxLevel || 0;
    this.currentLevel = { ...this.levels[this.idxCurrentLevel] };

    const amountOfSteps = 0;
    if (!this.currentLevel.pattern) {
      throw Error("Level has no pattern configured");
    }
    for (let i = 0; i < this.currentLevel.pattern.length; i++) {
      const pattern = this.currentLevel.pattern[i];
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
  }

  load(callback) {
    const request = new XMLHttpRequest();
    request.open("GET", "./levels.json");

    request.onload = () => {
      this.levels = JSON.parse(request.response);
      this.loadLevel(0);
      callback();
    };

    request.onerror = function () {
      throw Error("BufferLoader: XHR error");
    };

    request.send();
  }

  playTrackSampleOnce(track) {
    this.audioLibrary.playSampleAfter(track, 0);
  }

  matchesCurrentLevelPattern(enteredPattern) {
    const matches = this.currentLevel.pattern.map((patt) => {
      const enteredSteps = enteredPattern[patt.name];
      return JSON.stringify(enteredSteps) == JSON.stringify(patt.steps);
    });
    return matches.reduce((o, v) => o && v, true);
  }

  playCurrentLevelLoop(tickCallback, finishCallback) {
    /*
     * Play drump loop for the current level, calling tickCallback for every
     * pattern step along the way, and finishCallback when it's done playing.
     */
    if (!this.isReady()) {
      console.log("Not ready yet!");
      return;
    }

    const level = this.currentLevel;
    const startTime = this.audioLibrary.getCurrentTime();
    const repeat = 2;
    const beatDuration = 60 / level.bpm;
    const barDuration = beatDuration * level.amountOfSteps;
    for (let currentBar = 0; currentBar < repeat; currentBar++) {
      for (let step = 0; step < level.amountOfSteps; step++) {
        const durationSecs = currentBar * barDuration + step * beatDuration;
        setTimeout(tickCallback, durationSecs * 1000, step);
        level.pattern.forEach((pattern) => {
          if (pattern.steps[step] == 1) {
            this.audioLibrary.playSampleAfter(
              pattern.name,
              0.05 + startTime + durationSecs
            );
          }
        });
      }
    }
    setTimeout(finishCallback, barDuration * repeat * 1000);
  }
}

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
