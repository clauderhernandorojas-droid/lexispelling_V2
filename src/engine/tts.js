// ============================================================================
// Lexispelling V2 - Chromium Speech Synthesis Service (TTS)
// Natural speech playback for target words and context sentences
// ============================================================================

class TtsService {
  constructor() {
    this.speechRate = 0.85;
    this.lang = 'en-US';
    this.voices = [];
    this._initVoices();
  }

  _initVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        this.voices = window.speechSynthesis.getVoices();
      };
      updateVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }

  setSpeechRate(rate) {
    const r = parseFloat(rate);
    if (!isNaN(r) && r >= 0.2 && r <= 1.0) {
      this.speechRate = r;
    }
  }

  setLanguage(langCode) {
    const localeMap = {
      'en': 'en-US',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-BR'
    };
    this.lang = localeMap[langCode] || langCode || 'en-US';
  }

  speak(text, onEnd = null) {
    if (!('speechSynthesis' in window) || !text) return;

    window.speechSynthesis.cancel(); // Cancel any ongoing speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.speechRate;
    utterance.lang = this.lang;

    // Pick best matching natural voice
    if (this.voices.length > 0) {
      const langPrefix = this.lang.split('-')[0].toLowerCase();
      const match = this.voices.find(v => v.lang.toLowerCase() === this.lang.toLowerCase()) ||
                    this.voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
      if (match) {
        utterance.voice = match;
      }
    }

    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }

    window.speechSynthesis.speak(utterance);
  }

  stop() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

// Global instance in renderer
window.ttsService = new TtsService();

