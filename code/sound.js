/**
 * SoundManager - Centralized Web Audio API Sound Controller for Drag Race 3D
 * Supports both Singleplayer and Multiplayer modes with independent car audio channels.
 */
window.SoundManager = {
  audioCtx: null,
  globalGainNode: null,
  audioBuffer: null,
  isLoading: false,
  isMuted: false,
  players: {}, // Maps player ID -> independent engine sound instance
  playQueue: [], // Queued playback actions if buffer is not loaded yet

  /**
   * Initializes the AudioContext and Global Gain Node, handling user gesture interaction.
   */
  init() {
    if (this.audioCtx) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("Web Audio API is not supported in this browser.");
      return;
    }

    try {
      this.audioCtx = new AudioContextClass();
      this.globalGainNode = this.audioCtx.createGain();
      this.globalGainNode.connect(this.audioCtx.destination);

      // Default to unmuted (full volume)
      this.globalGainNode.gain.value = 1;
    } catch (e) {
      console.error("Failed to initialize AudioContext:", e);
      this.audioCtx = null;
      return;
    }

    // Standard auto-resume on first interaction for browser autoplay policy compliance
    const resumeAudio = () => {
      this.resume();
    };
    window.addEventListener('keydown', resumeAudio, { once: true });
    window.addEventListener('click', resumeAudio, { once: true });
    window.addEventListener('mousedown', resumeAudio, { once: true });
    window.addEventListener('touchstart', resumeAudio, { once: true });
    window.addEventListener('touchend', resumeAudio, { once: true });

    // Sync button state
    this.syncVolumeButton();
  },

  /**
   * Resumes the AudioContext if it is suspended (handles autoplay policies).
   */
  resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(() => {
        console.log("SoundManager: AudioContext resumed successfully.");
      }).catch(err => {
        console.warn("SoundManager: Failed to resume AudioContext:", err);
      });
    }
  },

  /**
   * Sets the mute status of the game globally.
   */
  setMute(mute) {
    this.isMuted = mute;
    if (this.globalGainNode) {
      this.globalGainNode.gain.value = mute ? 0 : 1;
    }
    this.syncVolumeButton();
  },

  /**
   * Toggles the mute state.
   */
  toggleMute() {
    this.init();
    this.setMute(!this.isMuted);
  },

  /**
   * Automatically updates any volume toggle button in the DOM.
   */
  syncVolumeButton() {
    const btnVolume = document.querySelector('.btn-volume');
    if (btnVolume) {
      if (this.isMuted) {
        btnVolume.classList.remove('active');
        btnVolume.textContent = "Sound: OFF";
      } else {
        btnVolume.classList.add('active');
        btnVolume.textContent = "Sound: ON";
      }
    }
  },

  /**
   * Sets up the event listener for the volume toggle button in the DOM.
   */
  setupVolumeButton() {
    const btnVolume = document.querySelector('.btn-volume');
    if (btnVolume && !btnVolume.dataset.listenerAdded) {
      btnVolume.onclick = () => this.toggleMute();
      btnVolume.dataset.listenerAdded = "true";
      this.syncVolumeButton();
    }
  },


  /**
   * Loads the audio sample and decodes it, caching it internally.
   */
  load(motorSamplePath, callback) {
    this.init();
    if (!this.audioCtx) {
      if (callback) callback(null);
      return;
    }

    // Setup volume button event listener
    const btnVolume = document.querySelector('.btn-volume');
    if (btnVolume && !btnVolume.dataset.listenerAdded) {
      btnVolume.onclick = () => this.toggleMute();
      btnVolume.dataset.listenerAdded = "true";
      this.syncVolumeButton();
    }

    if (this.audioBuffer) {
      if (callback) callback(this.audioBuffer);
      return;
    }

    if (this.isLoading) return;
    this.isLoading = true;

    const loader = document.querySelector('.loader');
    let request = new XMLHttpRequest();
    request.open('GET', motorSamplePath, true);
    request.responseType = 'arraybuffer';

    request.onload = () => {
      const audioData = request.response;
      if (request.status >= 200 && request.status < 300) {
        this.audioCtx.decodeAudioData(audioData, (buffer) => {
          this.audioBuffer = buffer;
          this.isLoading = false;
          if (loader) loader.classList.remove('active');

          // Flush queued playbacks once buffer is ready
          this.playQueue.forEach(item => {
            const player = this.getPlayer(item.id);
            if (player) {
              player.play(item.rpm, item.speed);
            }
          });
          this.playQueue = [];

          if (callback) callback(buffer);
        }, (e) => {
          console.warn("Error with decoding audio data:", e);
          this.isLoading = false;
          if (loader) loader.classList.remove('active');
        });
      } else {
        console.warn("Failed to load audio track due to status: " + request.status);
        this.isLoading = false;
        if (loader) loader.classList.remove('active');
      }
    };

    request.onerror = () => {
      console.warn("Failed to load audio track due to network or CORS error.");
      this.isLoading = false;
      if (loader) loader.classList.remove('active');
    };

    request.send();
  },

  /**
   * Returns or creates an independent player audio source instance.
   */
  getPlayer(id) {
    if (!this.players[id]) {
      this.players[id] = {
        source: null,
        source2: null,
        isPlaying: false,

        play(rpm, speed) {
          if (!window.SoundManager.audioBuffer) {
            // Queue playback request if buffer is still loading
            window.SoundManager.playQueue = window.SoundManager.playQueue.filter(item => item.id !== id);
            window.SoundManager.playQueue.push({ id, rpm, speed });
            return;
          }
          this.stop();

          const ctx = window.SoundManager.audioCtx;
          const buffer = window.SoundManager.audioBuffer;
          const destination = window.SoundManager.globalGainNode;

          this.source = ctx.createBufferSource();
          this.source2 = ctx.createBufferSource();

          this.source.buffer = buffer;
          this.source2.buffer = buffer;

          this.source.loop = true;
          this.source2.loop = true;

          // Granular engine sound loops (User custom values preserved)
          this.source.loopStart = 0.2;
          this.source.loopEnd = 0.2735;

          this.source2.loopStart = 0.2;
          this.source2.loopEnd = 0.2735;

          // Pitch formulas: RPM scale 2800, Speed scale 100
          this.source.playbackRate.value = rpm / 2800;
          this.source2.playbackRate.value = speed / 100;

          this.source.connect(destination);
          this.source2.connect(destination);

          this.source.start(0);
          this.source2.start(0);
          this.isPlaying = true;
        },

        update(rpm, speed) {
          if (!this.isPlaying) {
            // Update queued playback values if currently buffered in playQueue
            const queued = window.SoundManager.playQueue.find(item => item.id === id);
            if (queued) {
              queued.rpm = rpm;
              queued.speed = speed;
            }
            return;
          }
          
          if (this.source) {
            this.source.playbackRate.value = rpm / 2800;
          }
          if (this.source2) {
            this.source2.playbackRate.value = speed / 100;
          }
        },

        stop() {
          // Remove from playback queue to prevent unwanted play triggering
          window.SoundManager.playQueue = window.SoundManager.playQueue.filter(item => item.id !== id);
          if (this.source) {
            try { this.source.stop(0); } catch (e) {}
            this.source = null;
          }
          if (this.source2) {
            try { this.source2.stop(0); } catch (e) {}
            this.source2 = null;
          }
          this.isPlaying = false;
        }
      };
    }
    return this.players[id];
  },

  /**
   * Stops all active players.
   */
  stopAll() {
    Object.keys(this.players).forEach(id => {
      this.players[id].stop();
    });
  }
};
