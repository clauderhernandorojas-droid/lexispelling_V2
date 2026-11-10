// ============================================================================
// Lexispelling V2 - Web Audio API Pure Sound Feedback Synthesizer
// Zero external MP3 files. Pure mathematical sine waves generated in memory.
// ============================================================================

class SoundFeedback {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  _getAudioContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  /**
   * Section 2.3: Acierto (doble pulso agudo):
   * 1800 Hz (22 ms) + silencio (18 ms) + 2200 Hz (18 ms).
   */
  playSuccess() {
    if (this.muted) return;
    const ctx = this._getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    // Pulse 1: 1800 Hz (22 ms)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1800, t);
    gain1.gain.setValueAtTime(0.18, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.022);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.022);

    // Pulse 2: 2200 Hz (18 ms) after 18 ms silence (starts at t + 0.022 + 0.018 = t + 0.040)
    const t2 = t + 0.040;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2200, t2);
    gain2.gain.setValueAtTime(0.18, t2);
    gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.018);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t2);
    osc2.stop(t2 + 0.018);
  }

  /**
   * Section 2.3: Error (tono grave):
   * 240 Hz durante 135 ms con envolvente lineal.
   */
  playError() {
    if (this.muted) return;
    const ctx = this._getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, t);

    // Linear envelope decay over 135 ms
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.135);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.135);
  }

  /**
   * Section 2.3: Pista (pitido medio):
   * 920 Hz durante 58 ms.
   */
  playHint() {
    if (this.muted) return;
    const ctx = this._getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(920, t);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.058);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.058);
  }
}

// Global instance in renderer
window.soundFeedback = new SoundFeedback();

