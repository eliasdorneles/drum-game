const boolToInt = (bool) => +bool;

const addClass = (element, className) => {
  element.classList.add(className);
};

const removeClass = (element, className) => {
  element.classList.remove(className);
};

const toggleClass = (element, className) => {
  element.classList.toggle(className);
};

const show = (element) => {
  if (getComputedStyle(element).display === "none") {
    element.style.display = "";
  } else {
    element.style.display = "block";
  }
};

const hide = (element) => {
  element.style.display = "none";
};

function on(container, selector, event, callback) {
  // Validate arguments
  if (!container || !selector || !event || !callback) {
    throw new Error("Missing required arguments for on function.");
  }

  // Utilize event delegation for dynamically added elements
  container.addEventListener(event, function (e) {
    const target = e.target;
    const matchingElements = container.querySelectorAll(selector);

    // Check if the clicked element matches the selector
    for (const element of matchingElements) {
      if (element === target || element.contains(target)) {
        callback.call(target, e); // Pass the event object to the callback
        return; // Stop further checking once a match is found
      }
    }
  });
}

function App() {
  const createBox = (isActive, index, trackName) => {
    const box = document.createElement("span");
    addClass(box, "box");
    box.innerHTML = "&nbsp;";
    box.dataset.index = index;
    box.dataset.track = trackName;
    if (!isActive) {
      addClass(box, "niet");
    }
    return box;
  };

  const buildAndDisplayPatternGrid = (level) => {
    const container = document.querySelector(".pattern-canvas");
    container.innerHTML = "";
    return level.pattern.map((track) => {
      const row = document.createElement("div");
      addClass(row, "track");
      row.innerHTML = '<span class="track-name">' + track.name + "</span>";

      const boxes = track.steps.map((isActive, index) =>
        createBox(isActive, index, track.name)
      );

      boxes.forEach((box) => row.appendChild(box));
      container.appendChild(row);

      return boxes;
    });
  }

  const updateUIPlayingStep = (step) => {
    patternBoxes.forEach((boxes) => {
      boxes.forEach((box) => removeClass(box, "isActive"));
      if (step >= 0) {
        addClass(boxes[step], "isActive");
      }
    });
  }

  const stoppedPlaying = () => {
    updateUIPlayingStep(-1);
    document.querySelector(".play-btn").removeAttribute("disabled");
  }

  const getEnteredPattern = () => {
    // Return an object representing the pattern entered by the user
    // e.g. { Kick: [1, 0, 1, 0, 1, 0, 1, 0], Snare: [0, 1, 0, 1, 0, 1, 0, 1] }
    return patternBoxes.reduce((enteredPattern, boxes) => {
      const trackName = boxes[0].dataset.track;
      const pattern = Array.from(boxes, (b) =>
        boolToInt(b.classList.contains("tick"))
      );
      enteredPattern[trackName] = pattern;
      return enteredPattern;
    }, {});
  }

  const handleBoxClicked = () => {
    const enteredPattern = getEnteredPattern();

    const board = document.querySelector(".board.playing");
    if (game.isCorrectPattern(enteredPattern)) {
      const board = document.querySelector(".board");
      if (game.hasNextLevel()) {
        // TODO: make a better transition between levels
        show(board.querySelector(".next-level-btn"));
        board.querySelector(".level-title").textContent =
          "Yay! You passed level: " + game.currentLevel.name + " :)";
      } else {
        show(document.querySelector(".finished"));
      }
    } else {
      hide(board.querySelector(".next-level-btn"));
      board.querySelector(".level-title").textContent = game.currentLevel.name;
    }
  }

  const startNextLevel = () => {
    game.nextLevel();
    updateUIForCurrentLevel();
  }

  const updateUIForCurrentLevel = () => {
    const board = document.querySelector(".board");
    addClass(board, "playing");

    board.innerHTML =
      "<h2 class='level-title'>" + game.currentLevel.name + "</h2>";
    if (game.currentLevel.description) {
      board.innerHTML +=
        "<p class='level-desc'>" + game.currentLevel.description + "</p>";
    }
    board.innerHTML += `
      <div class='pattern-canvas'></div>
      <button class='btn play-btn'>Listen rhythm</button>
      <button class='btn primary-btn next-level-btn'>Next Level</button>
    `;

    patternBoxes = buildAndDisplayPatternGrid(game.currentLevel);

    hide(board.querySelector(".next-level-btn"));
  }

  // Initialize
  let patternBoxes = null;

  let game = new Game();

  const board = document.querySelector(".board");

  game.load(function () {
    updateUIForCurrentLevel();
  });

  // Register event listeners
  on(board, ".box", "click", function () {
    const trackName = this.dataset.track;
    toggleClass(this, "tick");
    game.playTrackSampleOnce(trackName);
    handleBoxClicked();
  });

  on(board, ".start-btn", "click", function () {
    if (!game.isReady()) {
      console.log("Not ready yet!");
      return;
    }
    startNextLevel();
    this.remove();
  });

  on(board, ".play-btn", "click", function () {
    if (!game.isReady()) {
      console.log("Not ready yet!");
      return;
    }
    this.setAttribute("disabled", "disabled");
    game.playCurrentLevelLoop(updateUIPlayingStep, stoppedPlaying);
  });

  on(board, ".next-level-btn", "click", function () {
    if (game.hasNextLevel()) {
      startNextLevel();
    }
  });
}

App();
