// vim: set sw=4:ts=4:

const STORAGE_KEY = 'drumGameProgress';

class Game {
  constructor() {
    this.levels = [];
    this.idxCurrentLevel = 0;
    this.currentLevel = {};
    this.currentScore = 0;
    this.levelScores = {};  // { levelIndex: bestScore }
    // Each sample can have an optional "volume" property (0.0 to 1.0, default 1.0)
    this.audioLibrary = new AudioLibrary([
      { name: "Snare", file: "snare.wav", volume: 0.5 },
      { name: "Kick", file: "kick.wav", volume: 0.5 },
      { name: "Hi-Hat", file: "hihat_closed.wav", volume: 0.5 },
      { name: "Open Hi-Hat", file: "hihat_open.wav", volume: 0.5 },
      { name: "Crash", file: "crash.wav", volume: 0.5 },
      { name: "Cowbell", file: "cowbell.wav", volume: 0.5 },
      { name: "Stick", file: "stick.wav", volume: 0.5 },
      { name: "Win", file: "win.wav", volume: 0.5 },
    ]);
  }

  isReady() {
    return this.audioLibrary.ready;
  }

  getVolume() {
    return this.audioLibrary.masterVolume;
  }

  setVolume(volume) {
    this.audioLibrary.setMasterVolume(volume);
  }

  nextLevel() {
    if (this.hasNextLevel()) {
      this.loadLevel(++this.idxCurrentLevel);
      this.saveProgress();
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

    let amountOfSteps = 0;
    if (!this.currentLevel.pattern) {
      throw new Error("Level has no pattern configured");
    }
    for (let i = 0; i < this.currentLevel.pattern.length; i++) {
      const pattern = this.currentLevel.pattern[i];
      if (i === 0) {
        amountOfSteps = pattern.steps.length;
      }
      if (amountOfSteps !== pattern.steps.length) {
        console.error(
          `Unexpected difference of number of steps: ${amountOfSteps} !== ${pattern.steps.length}`
        );
      }
    }
    this.currentLevel.amountOfSteps = amountOfSteps;
    console.log("Initialized level with amountOfSteps =", amountOfSteps);
  }

  saveProgress() {
    const data = {
      currentLevel: this.idxCurrentLevel,
      maxUnlockedLevel: Math.max(this.idxCurrentLevel, this.getMaxUnlockedLevel()),
      levelScores: this.levelScores
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  getMaxUnlockedLevel() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        const max = data.maxUnlockedLevel || 0;
        return Math.min(max, this.levels.length - 1);
      }
    } catch (e) {
      console.warn('Failed to read progress from localStorage:', e);
    }
    return 0;
  }

  goToLevel(levelIndex) {
    if (levelIndex >= 0 && levelIndex < this.levels.length) {
      this.loadLevel(levelIndex);
      this.saveProgress();
      return true;
    }
    return false;
  }

  async load() {
    const response = await fetch("./levels.json");
    if (!response.ok) {
      throw new Error(`Failed to load levels: ${response.status}`);
    }
    this.levels = await response.json();

    // Restore saved progress or start from 0
    let startLevel = 0;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        startLevel = Math.min(data.currentLevel || 0, this.levels.length - 1);
        startLevel = Math.max(0, startLevel);
        // Restore level scores
        if (data.levelScores) {
          this.levelScores = data.levelScores;
        }
      }
    } catch (e) {
      console.warn('Failed to restore progress:', e);
    }

    this.loadLevel(startLevel);
  }

  playTrackSampleOnce(track) {
    this.audioLibrary.playSampleAfter(track, 0);
  }

  playVictorySound() {
    const startTime = this.audioLibrary.getCurrentTime();
    this.audioLibrary.playSampleAfter("Win", startTime, 0.2);
  }

  isCorrectPattern(enteredPattern) {
    const matches = this.currentLevel.pattern.map((patt) => {
      const enteredSteps = enteredPattern[patt.name];
      return JSON.stringify(enteredSteps) === JSON.stringify(patt.steps);
    });
    return matches.every(Boolean);
  }

  // Scoring methods
  resetScore() {
    this.currentScore = 0;
  }

  calculateScoreChange(trackName, stepIndex, isAdding) {
    const track = this.currentLevel.pattern.find(t => t.name === trackName);
    const isCorrectPosition = track.steps[stepIndex] === 1;

    if (isAdding) {
      return isCorrectPosition ? 15 : -5;
    } else {
      return isCorrectPosition ? -15 : 3;  // Removing wrong tick gives back 3
    }
  }

  updateScore(delta) {
    this.currentScore += delta;
  }

  canAdvance(enteredPattern) {
    // For each track, check that every required tick (1 in pattern) is present
    return this.currentLevel.pattern.every((track) => {
      const entered = enteredPattern[track.name];
      return track.steps.every((expected, i) => {
        if (expected === 1) return entered[i] === 1;  // Required tick must be present
        return true;  // Extra ticks are allowed (but penalized in score)
      });
    });
  }

  getTotalScore() {
    // Sum of all completed level scores + current level progress
    let total = 0;
    for (let i = 0; i < this.idxCurrentLevel; i++) {
      total += this.levelScores[i] || 0;
    }
    return total + this.currentScore;
  }

  saveLevelScore(levelIndex, score) {
    this.levelScores[levelIndex] = score;
    this.saveProgress();
  }

  stopPlayback() {
    this.audioLibrary.stopAll();
    this.audioLibrary.restart();
  }

  playCurrentLevelLoop({ tickCallback, finishCallback, registerTimeout }) {
    /*
     * Play drump loop for the current level, calling tickCallback for every
     * pattern step along the way, and finishCallback when it's done playing.
     * registerTimeout is called for each scheduled timeout, to allow cancellation.
     */
    if (!this.isReady()) {
      console.log("Not ready yet!");
      return;
    }

    const level = this.currentLevel;
    const startTime = this.audioLibrary.getCurrentTime();
    const repeat = 3;
    const resolution = level.resolution || 1;
    const internalBpm = level.bpm * resolution;
    const beatDuration = 60 / internalBpm;
    const barDuration = beatDuration * level.amountOfSteps;
    for (let currentBar = 0; currentBar < repeat; currentBar++) {
      for (let step = 0; step < level.amountOfSteps; step++) {
        const durationSecs = currentBar * barDuration + step * beatDuration;
        const timeoutId = setTimeout(tickCallback, durationSecs * 1000, step);
        if (registerTimeout) registerTimeout(timeoutId);
        level.pattern.forEach((pattern) => {
          if (pattern.steps[step] === 1) {
            this.audioLibrary.playSampleAfter(
              pattern.name,
              0.05 + startTime + durationSecs
            );
          }
        });
      }
    }

    const finishTimeoutId = setTimeout(finishCallback, barDuration * repeat * 1000);
    if (registerTimeout) registerTimeout(finishTimeoutId);
  }
}
