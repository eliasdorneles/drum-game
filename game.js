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

    let amountOfSteps = 0;
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
