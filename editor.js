// vim: set sw=2:ts=2:

// Available instruments (excluding Win which is for victory only)
// Volume property controls per-sample loudness (0.0 to 1.0)
const AVAILABLE_INSTRUMENTS = [
  { name: "Snare", file: "snare.wav", volume: 0.5 },
  { name: "Kick", file: "kick.wav", volume: 0.5 },
  { name: "Hi-Hat", file: "hihat_closed.wav", volume: 0.5 },
  { name: "Open Hi-Hat", file: "hihat_open.wav", volume: 0.5 },
  { name: "Crash", file: "crash.wav", volume: 0.5 },
  { name: "Cowbell", file: "cowbell.wav", volume: 0.5 },
  { name: "Stick", file: "stick.wav", volume: 0.5 },
];

class LevelEditor {
  constructor() {
    this.levels = [];
    this.currentLevelIndex = -1;
    this.audioLibrary = null;
    this.isPlaying = false;
    this.playTimeouts = [];

    this.initAudio();
    this.loadLevels();
    this.bindEvents();
  }

  initAudio() {
    // Include Win sound for potential preview feedback
    const samples = [
      ...AVAILABLE_INSTRUMENTS,
      { name: "Win", file: "win.wav", volume: 0.2 },
    ];
    this.audioLibrary = new AudioLibrary(samples);
  }

  async loadLevels() {
    try {
      const response = await fetch("./levels.json");
      if (!response.ok) {
        throw new Error(`Failed to load levels: ${response.status}`);
      }
      this.levels = await response.json();
      this.renderLevelList();

      // Select first level if available
      if (this.levels.length > 0) {
        this.selectLevel(0);
      }
    } catch (error) {
      console.error("Error loading levels:", error);
      this.levels = [];
      this.renderLevelList();
    }
  }

  bindEvents() {
    // Sidebar buttons
    document.getElementById("addLevelBtn").addEventListener("click", () => {
      this.addLevel();
    });

    document.getElementById("duplicateLevelBtn").addEventListener("click", () => {
      this.duplicateLevel();
    });

    document.getElementById("downloadBtn").addEventListener("click", () => {
      this.downloadJSON();
    });

    // Level list event delegation
    document.getElementById("levelList").addEventListener("click", (e) => {
      const li = e.target.closest("li");
      if (!li) return;

      const index = parseInt(li.dataset.index, 10);

      if (e.target.classList.contains("move-up")) {
        this.moveLevel(index, -1);
      } else if (e.target.classList.contains("move-down")) {
        this.moveLevel(index, 1);
      } else if (e.target.classList.contains("delete")) {
        this.deleteLevel(index);
      } else {
        this.selectLevel(index);
      }
    });
  }

  // ============ Level List Management ============

  renderLevelList() {
    const list = document.getElementById("levelList");
    list.innerHTML = this.levels
      .map(
        (level, index) => `
      <li data-index="${index}" class="${index === this.currentLevelIndex ? "selected" : ""}">
        <span class="level-name">${this.escapeHtml(level.name)}</span>
        <span class="level-actions">
          <button class="level-action-btn move-up" title="Move up">↑</button>
          <button class="level-action-btn move-down" title="Move down">↓</button>
          <button class="level-action-btn delete" title="Delete">×</button>
        </span>
      </li>
    `
      )
      .join("");
  }

  selectLevel(index) {
    if (index < 0 || index >= this.levels.length) return;

    this.stopPreview();
    this.currentLevelIndex = index;
    this.renderLevelList();
    this.renderEditor();
  }

  addLevel() {
    const newLevel = {
      name: "New Level",
      bpm: 180,
      groupSize: 4,
      description: "",
      pattern: [
        { name: "Snare", steps: [0, 0, 0, 0, 0, 0, 0, 0] },
        { name: "Kick", steps: [0, 0, 0, 0, 0, 0, 0, 0] },
      ],
    };

    this.levels.push(newLevel);
    this.selectLevel(this.levels.length - 1);
  }

  duplicateLevel() {
    if (this.currentLevelIndex < 0) return;

    const original = this.levels[this.currentLevelIndex];
    const duplicate = JSON.parse(JSON.stringify(original));
    duplicate.name = `${original.name} (copy)`;

    // Insert after current level
    this.levels.splice(this.currentLevelIndex + 1, 0, duplicate);
    this.selectLevel(this.currentLevelIndex + 1);
  }

  deleteLevel(index) {
    if (this.levels.length <= 1) {
      alert("Cannot delete the last level.");
      return;
    }

    const level = this.levels[index];
    if (!confirm(`Delete level "${level.name}"?`)) return;

    this.levels.splice(index, 1);

    // Adjust current selection
    if (this.currentLevelIndex >= this.levels.length) {
      this.currentLevelIndex = this.levels.length - 1;
    } else if (this.currentLevelIndex > index) {
      this.currentLevelIndex--;
    }

    this.renderLevelList();
    if (this.currentLevelIndex >= 0) {
      this.selectLevel(this.currentLevelIndex);
    }
  }

  moveLevel(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.levels.length) return;

    // Swap levels
    const temp = this.levels[index];
    this.levels[index] = this.levels[newIndex];
    this.levels[newIndex] = temp;

    // Update selection if we moved the current level
    if (this.currentLevelIndex === index) {
      this.currentLevelIndex = newIndex;
    } else if (this.currentLevelIndex === newIndex) {
      this.currentLevelIndex = index;
    }

    this.renderLevelList();
  }

  // ============ Editor Rendering ============

  renderEditor() {
    const container = document.getElementById("editorContent");

    if (this.currentLevelIndex < 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Select a level from the sidebar to edit, or create a new one.</p>
        </div>
      `;
      return;
    }

    const level = this.levels[this.currentLevelIndex];

    container.innerHTML = `
      <!-- Metadata Form -->
      <div class="metadata-form">
        <div class="form-row">
          <div class="form-group wide">
            <label for="levelName">Name</label>
            <input type="text" id="levelName" value="${this.escapeHtml(level.name)}">
          </div>
          <div class="form-group">
            <label for="levelBpm">BPM</label>
            <input type="number" id="levelBpm" min="50" max="500" value="${level.bpm}">
          </div>
          <div class="form-group">
            <label for="levelGroupSize">Group Size</label>
            <input type="number" id="levelGroupSize" min="1" max="16" value="${level.groupSize}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group wide">
            <label for="levelDescription">Description (optional)</label>
            <input type="text" id="levelDescription" value="${this.escapeHtml(level.description || "")}">
          </div>
        </div>
      </div>

      <!-- Pattern Editor -->
      <div class="pattern-editor">
        <h3>Pattern</h3>
        <div id="patternTracks">
          ${this.renderTracks(level)}
        </div>
        <div class="pattern-controls">
          <div class="add-track-container">
            <select id="newTrackSelect">
              ${this.renderInstrumentOptions(level)}
            </select>
            <button class="pattern-btn" id="addTrackBtn">+ Add Track</button>
          </div>
          <button class="pattern-btn" id="addStepBtn">+ Add Step</button>
          <button class="pattern-btn" id="removeStepBtn">- Remove Step</button>
        </div>
      </div>

      <!-- Actions -->
      <div class="editor-actions">
        <button class="action-btn preview" id="previewBtn">Preview</button>
        <button class="action-btn preview" id="stopBtn" style="display: none;">Stop</button>
      </div>
    `;

    this.bindEditorEvents();
  }

  renderTracks(level) {
    if (!level.pattern || level.pattern.length === 0) {
      return '<p class="empty-state">No tracks yet. Add one below.</p>';
    }

    return level.pattern
      .map(
        (track, trackIndex) => `
      <div class="editor-track" data-track-index="${trackIndex}">
        <select class="track-instrument" data-track-index="${trackIndex}">
          ${AVAILABLE_INSTRUMENTS.map(
            (inst) =>
              `<option value="${inst.name}" ${inst.name === track.name ? "selected" : ""}>${inst.name}</option>`
          ).join("")}
        </select>
        <div class="editor-boxes">
          ${track.steps
            .map(
              (step, stepIndex) => `
            <div class="editor-box ${step ? "active" : ""} ${stepIndex % level.groupSize === 0 && stepIndex > 0 ? "group-start" : ""}"
                 data-track-index="${trackIndex}"
                 data-step-index="${stepIndex}">
            </div>
          `
            )
            .join("")}
        </div>
        <button class="remove-track-btn" data-track-index="${trackIndex}" title="Remove track">×</button>
      </div>
    `
      )
      .join("");
  }

  renderInstrumentOptions(level) {
    const usedInstruments = level.pattern.map((t) => t.name);
    return AVAILABLE_INSTRUMENTS.map(
      (inst) =>
        `<option value="${inst.name}" ${usedInstruments.includes(inst.name) ? "disabled" : ""}>${inst.name}</option>`
    ).join("");
  }

  bindEditorEvents() {
    const level = this.levels[this.currentLevelIndex];

    // Metadata inputs
    document.getElementById("levelName").addEventListener("input", (e) => {
      this.updateMetadata("name", e.target.value);
    });

    document.getElementById("levelBpm").addEventListener("input", (e) => {
      this.updateMetadata("bpm", parseInt(e.target.value, 10) || 180);
    });

    document.getElementById("levelGroupSize").addEventListener("input", (e) => {
      const value = parseInt(e.target.value, 10) || 4;
      this.updateMetadata("groupSize", value);
      // Re-render to update group separators
      this.renderEditor();
    });

    document.getElementById("levelDescription").addEventListener("input", (e) => {
      this.updateMetadata("description", e.target.value);
    });

    // Pattern grid clicks
    document.getElementById("patternTracks").addEventListener("click", (e) => {
      if (e.target.classList.contains("editor-box")) {
        const trackIndex = parseInt(e.target.dataset.trackIndex, 10);
        const stepIndex = parseInt(e.target.dataset.stepIndex, 10);
        this.toggleStep(trackIndex, stepIndex);
        e.target.classList.toggle("active");
      }

      if (e.target.classList.contains("remove-track-btn")) {
        const trackIndex = parseInt(e.target.dataset.trackIndex, 10);
        this.removeTrack(trackIndex);
      }
    });

    // Track instrument change
    document.getElementById("patternTracks").addEventListener("change", (e) => {
      if (e.target.classList.contains("track-instrument")) {
        const trackIndex = parseInt(e.target.dataset.trackIndex, 10);
        this.changeTrackInstrument(trackIndex, e.target.value);
      }
    });

    // Add track
    document.getElementById("addTrackBtn").addEventListener("click", () => {
      const select = document.getElementById("newTrackSelect");
      const instrumentName = select.value;
      if (instrumentName) {
        this.addTrack(instrumentName);
      }
    });

    // Add/remove steps
    document.getElementById("addStepBtn").addEventListener("click", () => {
      this.addStep();
    });

    document.getElementById("removeStepBtn").addEventListener("click", () => {
      this.removeStep();
    });

    // Preview
    document.getElementById("previewBtn").addEventListener("click", () => {
      this.previewPattern();
    });

    document.getElementById("stopBtn").addEventListener("click", () => {
      this.stopPreview();
    });
  }

  // ============ Level Editing ============

  updateMetadata(field, value) {
    if (this.currentLevelIndex < 0) return;
    this.levels[this.currentLevelIndex][field] = value;
    this.renderLevelList(); // Update name in sidebar
  }

  toggleStep(trackIndex, stepIndex) {
    if (this.currentLevelIndex < 0) return;
    const track = this.levels[this.currentLevelIndex].pattern[trackIndex];
    track.steps[stepIndex] = track.steps[stepIndex] ? 0 : 1;

    // Play sound when enabling
    if (track.steps[stepIndex] && this.audioLibrary.ready) {
      this.audioLibrary.playSampleAfter(track.name, 0);
    }
  }

  addTrack(instrumentName) {
    if (this.currentLevelIndex < 0) return;

    const level = this.levels[this.currentLevelIndex];
    const numSteps = level.pattern.length > 0 ? level.pattern[0].steps.length : 8;

    level.pattern.push({
      name: instrumentName,
      steps: new Array(numSteps).fill(0),
    });

    this.renderEditor();
  }

  removeTrack(trackIndex) {
    if (this.currentLevelIndex < 0) return;

    const level = this.levels[this.currentLevelIndex];
    if (level.pattern.length <= 1) {
      alert("Cannot remove the last track.");
      return;
    }

    level.pattern.splice(trackIndex, 1);
    this.renderEditor();
  }

  changeTrackInstrument(trackIndex, newInstrument) {
    if (this.currentLevelIndex < 0) return;
    this.levels[this.currentLevelIndex].pattern[trackIndex].name = newInstrument;
    this.renderEditor();
  }

  addStep() {
    if (this.currentLevelIndex < 0) return;

    const level = this.levels[this.currentLevelIndex];
    level.pattern.forEach((track) => {
      track.steps.push(0);
    });

    this.renderEditor();
  }

  removeStep() {
    if (this.currentLevelIndex < 0) return;

    const level = this.levels[this.currentLevelIndex];
    if (level.pattern[0]?.steps.length <= 1) {
      alert("Cannot remove the last step.");
      return;
    }

    level.pattern.forEach((track) => {
      track.steps.pop();
    });

    this.renderEditor();
  }

  // ============ Preview ============

  previewPattern() {
    if (this.currentLevelIndex < 0 || !this.audioLibrary.ready) return;
    if (this.isPlaying) {
      this.stopPreview();
      return;
    }

    this.isPlaying = true;
    document.getElementById("previewBtn").style.display = "none";
    document.getElementById("stopBtn").style.display = "";

    const level = this.levels[this.currentLevelIndex];
    const startTime = this.audioLibrary.getCurrentTime();
    const beatDuration = 60 / level.bpm;
    const numSteps = level.pattern[0]?.steps.length || 8;
    const barDuration = beatDuration * numSteps;
    const repeat = 2;

    // Clear any existing classes
    document.querySelectorAll(".editor-box.playing").forEach((box) => {
      box.classList.remove("playing");
    });

    for (let currentBar = 0; currentBar < repeat; currentBar++) {
      for (let step = 0; step < numSteps; step++) {
        const durationSecs = currentBar * barDuration + step * beatDuration;

        // Visual cursor update
        const timeoutId = setTimeout(() => {
          // Remove previous playing state
          document.querySelectorAll(".editor-box.playing").forEach((box) => {
            box.classList.remove("playing");
          });

          // Add playing state to current column
          document
            .querySelectorAll(`.editor-box[data-step-index="${step}"]`)
            .forEach((box) => {
              box.classList.add("playing");
            });
        }, durationSecs * 1000);

        this.playTimeouts.push(timeoutId);

        // Play sounds
        level.pattern.forEach((track) => {
          if (track.steps[step] === 1) {
            this.audioLibrary.playSampleAfter(
              track.name,
              0.05 + startTime + durationSecs
            );
          }
        });
      }
    }

    // End of playback
    const endTimeout = setTimeout(() => {
      this.stopPreview();
    }, barDuration * repeat * 1000);

    this.playTimeouts.push(endTimeout);
  }

  stopPreview() {
    this.isPlaying = false;

    // Clear timeouts
    this.playTimeouts.forEach((id) => clearTimeout(id));
    this.playTimeouts = [];

    // Reset audio
    if (this.audioLibrary) {
      this.audioLibrary.stopAll();
      this.audioLibrary.restart();
    }

    // Reset UI
    document.querySelectorAll(".editor-box.playing").forEach((box) => {
      box.classList.remove("playing");
    });

    const previewBtn = document.getElementById("previewBtn");
    const stopBtn = document.getElementById("stopBtn");
    if (previewBtn) previewBtn.style.display = "";
    if (stopBtn) stopBtn.style.display = "none";
  }

  // ============ Export ============

  downloadJSON() {
    const json = JSON.stringify(this.levels, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "levels.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============ Utilities ============

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize editor
const editor = new LevelEditor();
