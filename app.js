
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

