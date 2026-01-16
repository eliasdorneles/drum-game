const boolToInt = (bool) => +bool;

// DOM helpers
const addClass = (element, classNames) => {
  const classes = typeof classNames === "string" ? classNames.split(" ") : classNames;
  element.classList.add(...classes);
};

const appendAll = (container, nodes) => {
  container.append(...nodes);
};

const removeClass = (element, className) => {
  element.classList.remove(className);
};

const toggleClass = (element, className) => {
  element.classList.toggle(className);
};

const show = (element) => {
  element.style.display = "";
};

const hide = (element) => {
  element.style.display = "none";
};

// Event delegation helper
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
    addClass(box, "box");
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
    addClass(trackRow, "track");
    trackRow.dataset.trackName = trackSpec.name;

    const trackName = document.createElement("span");
    addClass(trackName, "track-name");
    trackName.textContent = trackSpec.name;
    trackRow.appendChild(trackName);

    // Container for all beat groups
    const trackBoxes = document.createElement("div");
    addClass(trackBoxes, "track-boxes");

    const groupSize = this.level.groupSize || 4;
    const boxes = [];

    // Group boxes into beat groups with measure breaks
    for (let i = 0; i < trackSpec.steps.length; i += groupSize) {
      const beatGroup = document.createElement("div");
      addClass(beatGroup, "beat-group");

      // Create boxes for this beat group
      for (let j = i; j < Math.min(i + groupSize, trackSpec.steps.length); j++) {
        const box = this.#createBox(trackSpec.steps[j], j, trackSpec.name);
        beatGroup.appendChild(box);
        boxes.push(box);
      }

      trackBoxes.appendChild(beatGroup);

      // Add measure break after every 2 groups (one measure)
      const groupIndex = i / groupSize;
      if ((groupIndex + 1) % 2 === 0 && i + groupSize < trackSpec.steps.length) {
        const measureBreak = document.createElement("div");
        addClass(measureBreak, "measure-break");
        trackBoxes.appendChild(measureBreak);
      }
    }

    trackRow.appendChild(trackBoxes);
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

  playVictoryWave() {
    // Animate all boxes in a wave pattern
    const allBoxes = this.patternBoxes.flat();
    allBoxes.forEach((box, index) => {
      setTimeout(() => {
        addClass(box, "victory-wave");
      }, index * 50); // 50ms delay between each box
    });
  }
}

function App() {
  const handleBoxClicked = () => {
    const pattern = patternGrid.getUserInputPattern();

    if (game.canAdvance(pattern)) {
      // Add completion bonus
      game.updateScore(100);

      // Save best score (before updating display so it shows correctly)
      game.saveLevelScore(game.idxCurrentLevel, game.currentScore);
      updateScoreDisplay();

      // Celebration! Play wave animation and victory sound
      addClass(board, "victory");
      patternGrid.playVictoryWave();
      game.playVictorySound();

      // Show victory overlay
      showVictoryOverlay();
    } else {
      removeClass(board, "victory");
      hideVictoryOverlay();
    }
  };

  const showVictoryOverlay = () => {
    // Remove existing overlay if any
    hideVictoryOverlay();

    const overlay = document.createElement("div");
    overlay.className = "victory-overlay";

    const hasNext = game.hasNextLevel();
    overlay.innerHTML = `
      <div class="victory-card">
        <h3>Bravo! 🎉</h3>
        <p>You've completed: ${game.currentLevel.name}</p>
        ${hasNext ? '<button class="next-level-btn">Next Level</button>' : ''}
      </div>
    `;

    board.querySelector(".pattern-canvas").appendChild(overlay);

    if (!hasNext) {
      show(document.querySelector(".finished"));
    }
  };

  const hideVictoryOverlay = () => {
    const overlay = board.querySelector(".victory-overlay");
    if (overlay) {
      overlay.remove();
    }
  };

  const startNextLevel = () => {
    if (isPlaying) {
      stopPlayback();
    }
    game.nextLevel();
    updateUIForCurrentLevel(game.currentLevel);
  };

  const updateScoreDisplay = () => {
    const scoreValue = board.querySelector(".score-value");
    if (!scoreValue) return;

    const oldScore = parseInt(scoreValue.textContent, 10) || 0;
    const newScore = game.getTotalScore();
    scoreValue.textContent = newScore;

    // Animate score changes
    scoreValue.classList.remove("score-up", "score-down");
    if (newScore > oldScore) {
      scoreValue.classList.add("score-up");
    } else if (newScore < oldScore) {
      scoreValue.classList.add("score-down");
    }
  };

  const updateUIForCurrentLevel = (currentLevel) => {
    game.resetScore();
    removeClass(board, "victory");
    addClass(board, "playing");

    board.innerHTML = `
      <div class="level-header">
        <h2 class="level-title">${currentLevel.name} - BPM: ${currentLevel.bpm}</h2>
        <div class="level-controls">
          <div class="score-display">
            <span class="score-label">Score:</span>
            <span class="score-value">${game.getTotalScore()}</span>
          </div>
          <div class="level-nav"></div>
        </div>
      </div>
    `;
    if (currentLevel.description) {
      board.innerHTML += `<p class="i">${currentLevel.description}</p>`;
    }
    board.innerHTML += `
      <div class='pattern-canvas'></div>
      <div class='audio-controls'>
        <button class='play-btn'>Listen now</button>
        <div class='volume-control'>
          <span class='volume-icon'>🔊</span>
          <input type='range' class='volume-slider' min='0' max='100' value='${game.getVolume() * 100}'>
        </div>
      </div>
    `;

    // Add level selector dropdown
    const levelNav = board.querySelector(".level-nav");
    const levelSelect = document.createElement("select");
    levelSelect.className = "level-selector";
    const maxUnlocked = game.getMaxUnlockedLevel();
    for (let i = 0; i <= maxUnlocked; i++) {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = `${i + 1}. ${game.levels[i].name}`;
      option.selected = i === game.idxCurrentLevel;
      levelSelect.appendChild(option);
    }
    levelNav.appendChild(levelSelect);

    // Add Start Over button
    const startOverBtn = document.createElement("button");
    startOverBtn.textContent = "Start Over";
    startOverBtn.className = "start-over-btn";
    levelNav.appendChild(startOverBtn);

    patternGrid = new DrumPatternGrid(currentLevel);

    appendAll(
      board.querySelector(".pattern-canvas"),
      patternGrid.createDrumTracksGrid()
    );
  };

  let isPlaying = false;
  let playTimeouts = [];

  const playPattern = () => {
    isPlaying = true;
    const playButton = board.querySelector(".play-btn");
    playButton.textContent = "Stop";

    game.playCurrentLevelLoop({
      tickCallback: (step) => {
        patternGrid.updatePlayingCursor(step);
      },
      finishCallback: () => {
        stopPlayback();
      },
      registerTimeout: (id) => {
        playTimeouts.push(id);
      },
    });
  };

  const stopPlayback = () => {
    isPlaying = false;

    // Clear all scheduled timeouts
    playTimeouts.forEach((id) => clearTimeout(id));
    playTimeouts = [];

    // Reset audio
    game.stopPlayback();

    // Reset UI
    patternGrid.updatePlayingCursor(-1);
    const playButton = board.querySelector(".play-btn");
    playButton.textContent = "Listen now";
    playButton.blur();
  };

  // Main - App entry point
  let patternGrid = null;

  let game = new Game();

  game.load().then(() => updateUIForCurrentLevel(game.currentLevel));

  const board = document.querySelector(".board");

  // Register event listeners
  on(board, ".box", "click", function () {
    // Don't allow clicks if level is completed
    if (board.classList.contains("victory")) return;

    const wasActive = this.classList.contains("tick");
    const trackName = this.dataset.track;
    const stepIndex = parseInt(this.dataset.index, 10);

    // Calculate score change BEFORE toggling
    const delta = game.calculateScoreChange(trackName, stepIndex, !wasActive);
    game.updateScore(delta);
    updateScoreDisplay();

    toggleClass(this, "tick");
    handleBoxClicked();
  });

  on(board, ".play-btn", "click", function () {
    if (!game.isReady()) {
      console.log("Not ready yet!");
      return;
    }
    if (isPlaying) {
      stopPlayback();
    } else {
      playPattern();
    }
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

  on(board, ".volume-slider", "input", function () {
    game.setVolume(this.value / 100);
  });

  on(board, ".level-selector", "change", function () {
    if (isPlaying) {
      stopPlayback();
    }
    game.loadLevel(parseInt(this.value, 10));
    updateUIForCurrentLevel(game.currentLevel);
  });

  on(board, ".start-over-btn", "click", function () {
    if (confirm("Reset all progress and start from level 1?")) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });

  // Expose game globally for debugging
  window.game = game;
}

App();
