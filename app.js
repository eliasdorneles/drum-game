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

  #createBox(isActive, index, trackName, trackColorIndex) {
    // Create a box element representing a step in the pattern
    const box = document.createElement("span");
    addClass(box, "box");
    box.innerHTML = "&nbsp;";

    // Add data attributes to the box, to make it easier to identify the track and step
    // when the box is clicked
    box.dataset.index = index;
    box.dataset.track = trackName;

    // Add track color class for visual differentiation
    box.classList.add(`track-color-${trackColorIndex}`);

    if (!isActive) {
      addClass(box, "mistake");
    }
    return box;
  }

  createDrumTracksGrid() {
    // Build grid pattern grouped into "staff systems" so all tracks break together
    // like sheet music staves
    const groupSize = this.level.groupSize || 4;
    const measuresPerSystem = 2;
    const stepsPerSystem = groupSize * measuresPerSystem;
    const totalSteps = this.level.pattern[0].steps.length;

    // Initialize patternBoxes array for each track
    this.level.pattern.forEach(() => this.patternBoxes.push([]));

    const systems = [];

    for (let systemStart = 0; systemStart < totalSteps; systemStart += stepsPerSystem) {
      const system = document.createElement("div");
      addClass(system, "staff-system");

      // Add each track's segment to this system
      this.level.pattern.forEach((trackSpec, trackIndex) => {
        const trackRow = document.createElement("div");
        addClass(trackRow, "track");
        trackRow.dataset.trackName = trackSpec.name;
        trackRow.dataset.trackColor = (trackIndex % 4) + 1;

        const trackName = document.createElement("span");
        addClass(trackName, "track-name");
        trackName.innerHTML = `<span class="track-preview-icon">&#128266;</span> ${trackSpec.name}`;
        trackRow.appendChild(trackName);

        const trackBoxes = document.createElement("div");
        addClass(trackBoxes, "track-boxes");

        // Create beat groups for this segment
        for (let i = systemStart; i < Math.min(systemStart + stepsPerSystem, totalSteps); i += groupSize) {
          const beatGroup = document.createElement("div");
          addClass(beatGroup, "beat-group");

          const trackColorIndex = (trackIndex % 4) + 1;
          for (let j = i; j < Math.min(i + groupSize, totalSteps); j++) {
            const box = this.#createBox(trackSpec.steps[j], j, trackSpec.name, trackColorIndex);
            beatGroup.appendChild(box);
            this.patternBoxes[trackIndex].push(box);
          }

          trackBoxes.appendChild(beatGroup);
        }

        trackRow.appendChild(trackBoxes);
        system.appendChild(trackRow);
        this.tracks.push(trackRow);
      });

      systems.push(system);
    }

    return systems;
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

  playFinalVictoryWave() {
    // Rainbow wave animation for completing the final level
    const allBoxes = this.patternBoxes.flat();
    allBoxes.forEach((box, index) => {
      setTimeout(() => {
        addClass(box, "rainbow-wave");
      }, index * 80); // Slower cascade for more dramatic effect
    });
  }
}

function App() {
  // Onboarding System
  const ONBOARDING_KEY = 'drumGameOnboarding';

  const onboarding = {
    active: false,
    step: 0,
    loopPlayCount: 0,
    hasCompletedOnce: JSON.parse(localStorage.getItem(ONBOARDING_KEY))?.completed || false,
    autoDismissTimeout: null,

    start() {
      this.active = true;
      this.step = 0;
      this.loopPlayCount = 0;
      // Jump to level 1 if not already there
      if (game.idxCurrentLevel !== 0) {
        game.loadLevel(0);
        updateUIForCurrentLevel(game.currentLevel);
      }
      this.showWelcomeModal();
    },

    nextStep() {
      this.step++;
      this.runStep();
    },

    runStep() {
      this.hidePopover();

      switch (this.step) {
        case 1:
          // Step 2: Play Loop popover
          this.showPopover('.play-btn', 'Click here to play the loop', 'above');
          break;
        case 2:
          // Step 3: Listen popover (shown when loop starts playing)
          this.showPopover('.pattern-canvas', 'Listen carefully! There are 3 kick hits and 2 snare hits. Your job is to find them!', 'below');
          break;
        case 3:
          // Step 4: Click boxes popover
          this.showPopover('.pattern-canvas', 'Now recreate what you heard! Click the boxes where you heard the drums hit.', 'below');
          break;
        case 4:
          // Step 5: Keep going popover
          this.showPopover('.pattern-canvas', 'Keep going! Match all the beats to complete the level.', 'below');
          // Auto-dismiss after 5 seconds
          this.autoDismissTimeout = setTimeout(() => {
            this.complete();
          }, 5000);
          break;
        default:
          this.complete();
      }
    },

    complete() {
      this.active = false;
      this.step = 0;
      this.loopPlayCount = 0;
      this.hasCompletedOnce = true;
      if (this.autoDismissTimeout) {
        clearTimeout(this.autoDismissTimeout);
        this.autoDismissTimeout = null;
      }
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ completed: true }));
      this.hidePopover();
      this.hideModal();
    },

    showWelcomeModal() {
      this.hideModal();
      const modal = document.createElement('div');
      modal.className = 'onboarding-modal';
      modal.innerHTML = `
        <div class="onboarding-modal-content">
          <h2>Welcome to Drum Game!</h2>
          <p>Your goal: Recreate drum patterns by ear.<br>
          Listen to the loop, then click the boxes to match the rhythm.</p>
          <button class="onboarding-start-btn">Start Tutorial</button>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('.onboarding-start-btn').addEventListener('click', () => {
        this.hideModal();
        this.nextStep();
      });
    },

    hideModal() {
      const modal = document.querySelector('.onboarding-modal');
      if (modal) modal.remove();
    },

    showPopover(targetSelector, message, position = 'above') {
      this.hidePopover();
      const target = document.querySelector(targetSelector);
      if (!target) return;

      const popover = document.createElement('div');
      popover.className = 'onboarding-popover';
      popover.textContent = message;

      // Add to DOM first so we can measure it
      document.body.appendChild(popover);

      const targetRect = target.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();

      // Use fixed positioning
      popover.style.position = 'fixed';

      if (position === 'above') {
        popover.classList.add('arrow-down');
        // Center horizontally over target, but clamp to viewport
        let left = targetRect.left + targetRect.width / 2 - popoverRect.width / 2;
        left = Math.max(10, Math.min(left, window.innerWidth - popoverRect.width - 10));
        popover.style.left = `${left}px`;
        popover.style.top = `${targetRect.top - popoverRect.height - 12}px`;
      } else if (position === 'below') {
        popover.classList.add('arrow-up');
        let left = targetRect.left + targetRect.width / 2 - popoverRect.width / 2;
        left = Math.max(10, Math.min(left, window.innerWidth - popoverRect.width - 10));
        popover.style.left = `${left}px`;
        popover.style.top = `${targetRect.bottom + 12}px`;
      }
    },

    hidePopover() {
      const popover = document.querySelector('.onboarding-popover');
      if (popover) popover.remove();
    },

    // Called when loop finishes one complete cycle
    onLoopCycleComplete() {
      if (this.active && this.step === 2) {
        this.loopPlayCount++;
        if (this.loopPlayCount >= 1) {
          this.nextStep();
        }
      }
    },

    // Called when user clicks a box
    onBoxClick() {
      if (this.active && this.step === 3) {
        this.nextStep();
      }
    },

    // Called when user clicks play button
    onPlayClick() {
      if (this.active && this.step === 1) {
        this.nextStep();
      }
    },

    // Called when level is completed
    onLevelComplete() {
      if (this.active) {
        this.complete();
      }
    }
  };

  const handleBoxClicked = () => {
    const pattern = patternGrid.getUserInputPattern();

    if (game.canAdvance(pattern)) {
      // Add completion bonus
      game.updateScore(100);

      // Save best score (before updating display so it shows correctly)
      game.saveLevelScore(game.idxCurrentLevel, game.currentScore);
      updateScoreDisplay();

      const isFinalLevel = !game.hasNextLevel();

      // Celebration! Play appropriate animation and sound
      addClass(board, "victory");
      if (isFinalLevel) {
        addClass(board, "final-victory");
        patternGrid.playFinalVictoryWave();
        game.playFinalVictorySound();
      } else {
        patternGrid.playVictoryWave();
        game.playVictorySound();
      }

      // Complete onboarding if active
      onboarding.onLevelComplete();

      // Show victory overlay
      showVictoryOverlay();
    } else {
      removeClass(board, "victory");
      removeClass(board, "final-victory");
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
    game.resetTempo();
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

  // Stuck detection helpers
  let stuckCheckInterval = null;
  let stuckHintTimeout = null;
  let stuckHintShown = false;

  const checkAndShowStuckHint = () => {
    const hint = board.querySelector('.stuck-hint');
    if (hint && game.isStuck() && game.getTempo() === 1.0 && !stuckHintShown) {
      stuckHintShown = true;
      hint.classList.add('visible');
      // Auto-hide after 10 seconds
      if (stuckHintTimeout) clearTimeout(stuckHintTimeout);
      stuckHintTimeout = setTimeout(() => {
        hint.classList.remove('visible');
      }, 10000);
    }
  };

  const startStuckTimer = () => {
    if (stuckCheckInterval) clearInterval(stuckCheckInterval);
    stuckHintShown = false;
    stuckCheckInterval = setInterval(checkAndShowStuckHint, 2000);
  };

  const updateUIForCurrentLevel = (currentLevel) => {
    game.resetScore();
    game.resetMistakeCount();
    removeClass(board, "victory");
    removeClass(board, "final-victory");
    addClass(board, "playing");

    const maxUnlocked = game.getMaxUnlockedLevel();
    const totalLevels = game.levels.length;

    // Build level progress dots HTML
    let dotsHtml = '';
    for (let i = 0; i <= maxUnlocked; i++) {
      const state = i < game.idxCurrentLevel ? 'completed' : (i === game.idxCurrentLevel ? 'current' : '');
      dotsHtml += `<button class="level-dot ${state}" data-level="${i}" title="${i + 1}. ${game.levels[i].name}"></button>`;
    }

    const lockedCount = totalLevels - maxUnlocked - 1;
    const remainingHtml = lockedCount > 0 ? `<span class="levels-remaining">+${lockedCount} more</span>` : '';

    // Build BPM dropdown options
    const bpmOptions = [
      { value: 1.0, label: `${currentLevel.bpm} BPM` },
      { value: 0.8, label: `${Math.round(currentLevel.bpm * 0.8)} BPM (80%)` },
      { value: 0.6, label: `${Math.round(currentLevel.bpm * 0.6)} BPM (60%)` }
    ];
    const bpmOptionsHtml = bpmOptions.map(opt =>
      `<option value="${opt.value}" ${opt.value === game.getTempo() ? 'selected' : ''}>${opt.label}</option>`
    ).join('');

    board.innerHTML = `
      <div class="level-progress-bar">
        <div class="level-progress">${dotsHtml}${remainingHtml}</div>
        <button class="start-over-btn">Start Over</button>
      </div>
      <div class="level-header">
        <h2 class="level-title">${currentLevel.name} <span class="bpm-container"><select class="bpm-dropdown">${bpmOptionsHtml}</select><span class="stuck-hint">Stuck? Try a slower tempo!</span></span></h2>
        <div class="score-display">
          <span class="score-label">Score:</span>
          <span class="score-value">${game.getTotalScore()}</span>
        </div>
      </div>
    `;
    if (currentLevel.description) {
      board.innerHTML += `<p class="i">${currentLevel.description}</p>`;
    }
    board.innerHTML += `
      <div class='pattern-canvas'></div>
      <div class='audio-controls'>
        <button class='play-btn'>Play Loop</button>
        <div class='volume-control'>
          <span class='volume-icon'>🔊</span>
          <input type='range' class='volume-slider' min='0' max='100' value='${game.getVolume() * 100}'>
        </div>
      </div>
    `;

    patternGrid = new DrumPatternGrid(currentLevel);

    appendAll(
      board.querySelector(".pattern-canvas"),
      patternGrid.createDrumTracksGrid()
    );

    startStuckTimer();
  };

  let isPlaying = false;
  let playTimeouts = [];

  let previousStep = -1;

  const playPattern = () => {
    isPlaying = true;
    previousStep = -1;
    const playButton = board.querySelector(".play-btn");
    playButton.textContent = "Stop";

    game.playCurrentLevelLoop({
      tickCallback: (step) => {
        patternGrid.updatePlayingCursor(step);
        // Detect when loop restarts (step goes from high number back to 0)
        if (step === 0 && previousStep > 0) {
          onboarding.onLoopCycleComplete();
        }
        previousStep = step;
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
    playButton.textContent = "Play Loop";
    playButton.blur();
  };

  // Main - App entry point
  let patternGrid = null;

  let game = new Game();

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

    // Track mistakes for stuck detection
    if (delta < 0) {
      game.recordMistake();
      checkAndShowStuckHint();
    }

    // Notify onboarding of box click
    onboarding.onBoxClick();

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
      // Notify onboarding that play was clicked
      onboarding.onPlayClick();
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

  on(board, ".bpm-dropdown", "change", function () {
    const newTempo = parseFloat(this.value);
    game.setTempo(newTempo);

    // Hide stuck hint when user changes tempo
    const hint = board.querySelector('.stuck-hint');
    if (hint) hint.classList.remove('visible');

    // Restart playback if currently playing
    if (isPlaying) {
      stopPlayback();
      playPattern();
    }
  });

  on(board, ".level-dot", "click", function () {
    const levelIndex = parseInt(this.dataset.level, 10);
    if (levelIndex === game.idxCurrentLevel) return;

    if (isPlaying) {
      stopPlayback();
    }
    game.resetTempo();
    game.loadLevel(levelIndex);
    updateUIForCurrentLevel(game.currentLevel);
  });

  on(board, ".start-over-btn", "click", function () {
    if (confirm("Reset all progress and start from level 1?")) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });

  // "How to Play" button in header
  const howToPlayBtn = document.querySelector('.how-to-play-btn');
  if (howToPlayBtn) {
    howToPlayBtn.addEventListener('click', () => {
      if (isPlaying) {
        stopPlayback();
      }
      onboarding.start();
    });
  }

  // Load game and start onboarding for first-time visitors
  game.load().then(() => {
    updateUIForCurrentLevel(game.currentLevel);

    if (!onboarding.hasCompletedOnce) {
      // Small delay to ensure UI is ready
      setTimeout(() => {
        onboarding.start();
      }, 500);
    }
  });

  // Expose game globally for debugging
  window.game = game;
}

App();
