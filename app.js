const boolToInt = (bool) => +bool;

const addClass = (element, classNames) => {
  if (typeof classNames === "string") {
    classNames = classNames.split(" ");
  }
  classNames.forEach((className) => element.classList.add(className));
};

const appendAll = (container, nodes) => {
  nodes.forEach((node) => container.appendChild(node));
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

class DrumPatternGrid {
  constructor(level) {
    this.level = level;
    this.tracks = [];
    this.patternBoxes = [];
  }

  #createBox(isActive, index, trackName) {
    // Create a box element representing a step in the pattern
    const box = document.createElement("span");
    addClass(box, "box dib w2 h2 pointer br3 ml1");
    box.innerHTML = "&nbsp;";

    // Add data attributes to the box, to make it easier to identify the track and step
    // when the box is clicked
    box.dataset.index = index;
    box.dataset.track = trackName;

    if (!isActive) {
      addClass(box, "mistake");
    }
    return box;
  }

  #createTrackRow(trackSpec) {
    // Create a row element representing a track in the pattern
    const trackRow = document.createElement("div");
    addClass(trackRow, "track mb2");
    trackRow.dataset.trackName = trackSpec.name;
    trackRow.innerHTML =
      '<span class="track-name dib w3 fw6 pointer v-btm pb1 tr">' +
      trackSpec.name +
      "🔉</span>";

    const boxes = trackSpec.steps.map((isActive, index) =>
      this.#createBox(isActive, index, trackSpec.name)
    );
    appendAll(trackRow, boxes);
    return { trackRow, boxes };
  }

  createDrumTracksGrid() {
    // Build grid pattern and return list of tracks to be appended to the DOM
    // Note: see levels.json to understand the structure of the level object
    return this.level.pattern.map((track) => {
      const { trackRow, boxes } = this.#createTrackRow(track);

      this.tracks.push(trackRow);
      this.patternBoxes.push(boxes);

      return trackRow;
    });
  }

  updatePlayingCursor(step) {
    this.patternBoxes.forEach((boxes) => {
      boxes.forEach((box) => removeClass(box, "isActive"));
      if (step >= 0) {
        addClass(boxes[step], "isActive");
      }
    });
  }

  getUserInputPattern() {
    // Return an object representing the pattern entered by the user
    // e.g. { Kick: [1, 0, 1, 0, 1, 0, 1, 0], Snare: [0, 1, 0, 1, 0, 1, 0, 1] }
    return this.patternBoxes.reduce((inputPatt, boxes) => {
      const trackName = boxes[0].dataset.track;
      inputPatt[trackName] = Array.from(boxes, (b) =>
        boolToInt(b.classList.contains("tick"))
      );
      return inputPatt;
    }, {});
  }
}

function App() {
  const handleBoxClicked = () => {
    if (game.isCorrectPattern(patternGrid.getUserInputPattern())) {
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
  };

  const startNextLevel = () => {
    game.nextLevel();
    updateUIForCurrentLevel(game.currentLevel);
  };

  const updateUIForCurrentLevel = (currentLevel) => {
    addClass(board, "playing");

    board.innerHTML = `
      <h2>${currentLevel.name} - BPM: ${currentLevel.bpm}
        <small>(puzzle ${game.idxCurrentLevel + 1} of ${
      game.levels.length
    })</small>
      </h2>
    `;
    if (currentLevel.description) {
      board.innerHTML += `<p class="i">${currentLevel.description}</p>`;
    }
    board.innerHTML += `
      <div class='pattern-canvas ma4'></div>
      <button class='play-btn br3 bw0 ph3 pv2 dim fw6 gold bg-purple pointer'>Listen now</button>
      <button class='next-level-btn br3 bw0 ml5 ph3 pv2 dim fw6 light-green bg-dark-green pointer'>Next Level</button>
    `;

    patternGrid = new DrumPatternGrid(currentLevel);

    appendAll(
      board.querySelector(".pattern-canvas"),
      patternGrid.createDrumTracksGrid()
    );

    hide(board.querySelector(".next-level-btn"));
  };

  const playPattern = () => {
    game.playCurrentLevelLoop({
      tickCallback: (step) => {
        patternGrid.updatePlayingCursor(step);
      },
      finishCallback: () => {
        patternGrid.updatePlayingCursor(-1);
        const playButton = board.querySelector(".play-btn");
        playButton.removeAttribute("disabled");
        playButton.blur();
      },
    });
  };

  // Main - App entry point
  let patternGrid = null;

  let game = new Game();

  game.load(() => updateUIForCurrentLevel(game.currentLevel));

  const board = document.querySelector(".board");

  // Register event listeners
  on(board, ".box", "click", function () {
    toggleClass(this, "tick");
    handleBoxClicked();
  });

  on(board, ".play-btn", "click", function () {
    if (!game.isReady()) {
      console.log("Not ready yet!");
      return;
    }
    this.setAttribute("disabled", "disabled");
    playPattern();
  });

  on(board, ".next-level-btn", "click", function () {
    if (game.hasNextLevel()) {
      startNextLevel();
    }
  });

  on(board, ".track-name", "click", function () {
    const trackName = this.parentElement.dataset.trackName;
    game.playTrackSampleOnce(trackName);
  });
}

App();
