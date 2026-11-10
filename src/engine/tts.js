// ============================================================================
// Lexispelling V2 - Chromium Speech Synthesis Service (TTS)
// Natural speech playback for target words and context sentences
// ============================================================================

class TtsService {
  constructor() {
    this.speechRate = 0.88;
    this.pitch = 1.0;
    this.lang = 'en-US';
    this.voices = [];
    this._initVoices();
  }

  _initVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        try {
          this.voices = window.speechSynthesis.getVoices() || [];
        } catch (e) {
          this.voices = [];
        }
      };
      updateVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }

  setSpeechRate(rate) {
    const r = parseFloat(rate);
    if (!isNaN(r) && r >= 0.2 && r <= 1.5) {
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

  /**
   * Filters and selects the most natural-sounding voice for the target language.
   * Priority order:
   * 1. Modern Natural/Neural/Online voices (e.g. Jenny, Aria, Guy, Sonia, Ryan).
   * 2. High-modulation recognized voices (Zira, Google US English, Samantha).
   * 3. Avoids robotic "David Desktop" unless it is the only fallback available.
   */
  _pickBestVoice(targetLang = this.lang) {
    if (typeof window !== 'undefined' && (!this.voices || this.voices.length === 0) && window.speechSynthesis) {
      try {
        this.voices = window.speechSynthesis.getVoices() || [];
      } catch (e) {
        this.voices = [];
      }
    }

    if (!this.voices || this.voices.length === 0) return null;

    const langPrefix = targetLang.split('-')[0].toLowerCase();
    const langVoices = this.voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix));
    const pool = langVoices.length > 0 ? langVoices : this.voices;

    const scoreVoice = (v) => {
      const name = (v.name || '').toLowerCase();
      let score = 0;

      // Tier 1: Modern Natural / Neural / Online voices (+1000)
      if (name.includes('natural') || name.includes('neural') || name.includes('online')) {
        score += 1000;
      }
      if (name.includes('jenny') || name.includes('aria') || name.includes('guy') || name.includes('sonia') || name.includes('ryan')) {
        score += 500;
      }

      // Tier 2: Recognized expressive voices (+300)
      if (name.includes('zira')) {
        score += 350;
      }
      if (name.includes('google') || name.includes('samantha')) {
        score += 300;
      }

      // Prefer regional accent match (e.g. en-US)
      if (v.lang && v.lang.toLowerCase() === targetLang.toLowerCase()) {
        score += 50;
      }

      // Tier 3 Penalty: Robotic "David Desktop" as last resort (-200)
      if (name.includes('david')) {
        score -= 200;
      }

      return score;
    };

    const sorted = [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a));
    return sorted[0] || null;
  }

  speak(text, onEnd = null) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;

    // 1. Clean HTML tags (such as <mark>, <span>, etc.) and decode basic entities
    const cleanText = String(text)
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    // 2. Always cancel any ongoing or stalled speech synthesis before starting
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = this.speechRate;
    utterance.pitch = this.pitch;
    utterance.lang = this.lang;

    // 3. Assign optimal natural voice
    const bestVoice = this._pickBestVoice(this.lang);
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }

    window.speechSynthesis.speak(utterance);
  }

  stop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

// Global instance in renderer
if (typeof window !== 'undefined') {
  window.ttsService = new TtsService();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TtsService };
}

