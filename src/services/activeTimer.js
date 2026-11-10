// ============================================================================
// Lexispelling V2 - Active Timer Tracker
// Tracks focused study time ONLY when inside Flashcards or Quiz view
// ============================================================================

class ActiveTimer {
  constructor() {
    this.currentMode = null; // 'study' (flashcards) | 'evaluation' (quiz)
    this.accumulatedSeconds = 0;
    this.intervalId = null;
  }

  start(mode) {
    this.flush(); // Flush any pending seconds first
    this.currentMode = mode;
    this.accumulatedSeconds = 0;

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(() => {
      this.accumulatedSeconds++;
    }, 1000);
  }

  stop() {
    this.flush();
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.currentMode = null;
  }

  flush() {
    if (this.currentMode && this.accumulatedSeconds > 0) {
      const minutes = Number((this.accumulatedSeconds / 60).toFixed(2));
      const mode = this.currentMode;
      this.accumulatedSeconds = 0;

      if (window.api && window.api.recordActiveTime) {
        window.api.recordActiveTime(mode, minutes);
      }
    }
  }
}

window.activeTimer = new ActiveTimer();

