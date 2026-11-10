// ============================================================================
// Lexispelling V2 - 3D Flashcards View
// Interactive perspective flip, TTS audio triggers, native keyboard shortcuts
// ============================================================================

class FlashcardsView {
  static init() {
    this.session = null;
    this.currentIndex = 0;
    this.isFlipped = false;
    this.reviewedCardIds = new Set();
    this.sessionSeconds = 0;
    this.timerInterval = null;
    this.wordRate = (typeof TtsService !== 'undefined' && TtsService.getWordRate) ? TtsService.getWordRate() : 0.85;
    this.phraseRate = (typeof TtsService !== 'undefined' && TtsService.getPhraseRate) ? TtsService.getPhraseRate() : 0.95;
    this.keyHandler = this.handleKeyDown.bind(this);
  }

  static startTimer() {
    this.stopTimer();
    this.sessionSeconds = 0;
    this.timerInterval = setInterval(() => {
      this.sessionSeconds++;
      const timerEl = document.getElementById('flashcards-timer');
      if (timerEl) {
        timerEl.textContent = `⏱️ ${this.getFormattedTime()}`;
      }
    }, 1000);
  }

  static stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  static getFormattedTime() {
    const s = this.sessionSeconds || 0;
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  static onWordSpeedChange(val) {
    const rate = parseFloat(val);
    if (isNaN(rate)) return;
    this.wordRate = rate;
    const tag = document.getElementById('speed-word-val');
    if (tag) tag.textContent = `${rate.toFixed(2)}x`;
    const slider = document.getElementById('speed-word-slider');
    if (slider && parseFloat(slider.value) !== rate) slider.value = val;

    if (typeof TtsService !== 'undefined' && typeof TtsService.setWordRate === 'function') {
      TtsService.setWordRate(rate);
    }
    if (window.ttsService && typeof window.ttsService.setWordRate === 'function') {
      window.ttsService.setWordRate(rate);
    }
  }

  static onPhraseSpeedChange(val) {
    const rate = parseFloat(val);
    if (isNaN(rate)) return;
    this.phraseRate = rate;
    const tag = document.getElementById('speed-phrase-val');
    if (tag) tag.textContent = `${rate.toFixed(2)}x`;
    const slider = document.getElementById('speed-phrase-slider');
    if (slider && parseFloat(slider.value) !== rate) slider.value = val;

    if (typeof TtsService !== 'undefined' && typeof TtsService.setPhraseRate === 'function') {
      TtsService.setPhraseRate(rate);
    }
    if (window.ttsService && typeof window.ttsService.setPhraseRate === 'function') {
      window.ttsService.setPhraseRate(rate);
    }
  }

  static formatSafeTranslation(text) {
    if (!text) return '';
    const safe = FlashcardsView.escapeHtml(text);
    return safe
      .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/gi, '<b>$1</b>')
      .replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/gi, '<strong>$1</strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  static render() {
    const container = document.getElementById('view-flashcards');
    if (!container) return;

    this.session = window.store.get('studySession');
    if (!this.session || !this.session.words || this.session.words.length === 0) {
      window.app.navigate('library');
      return;
    }

    this.currentIndex = 0;
    this.isFlipped = false;
    this.reviewedCardIds = new Set();

    // Start visible stopwatch and active study timer
    this.startTimer();
    if (window.activeTimer) {
      window.activeTimer.start('study');
    }

    // Attach global keyboard listener
    window.removeEventListener('keydown', this.keyHandler);
    window.addEventListener('keydown', this.keyHandler);

    this.updateCardUi();
  }

  static destroy() {
    this.stopTimer();
    window.removeEventListener('keydown', this.keyHandler);
    if (window.activeTimer) {
      window.activeTimer.stop();
    }
  }

  static updateCardUi() {
    const container = document.getElementById('view-flashcards');
    if (!container) return;
    const word = this.session.words[this.currentIndex];
    const total = this.session.words.length;
    this.reviewedCardIds.add(word.id);

    // Rule 1: Discontinuous tokens separated by ellipsis ("want... be") vs contiguous ("give up")
    const displayTarget = this.getDisplayTargetText(word);
    const highlightedPhrase = this.formatHighlightedPhrase(word);

    let html = `
      <div class="flashcards-container">
        <!-- Top Bar -->
        <div class="flashcards-header">
          <button class="appbar-exit-btn" onclick="FlashcardsView.exitSession()" title="Salir y volver a la Biblioteca">
            ✕ Volver a la Biblioteca
          </button>
          <div class="flashcards-header-center">
            <div class="flashcards-counter">Tarjeta ${this.currentIndex + 1} de ${total}</div>
            <div class="flashcards-timer" id="flashcards-timer">⏱️ ${this.getFormattedTime()}</div>
          </div>
          <div class="badge badge-new">${word.level !== null && word.level !== undefined ? 'Nivel ' + word.level : 'Nueva'}</div>
        </div>

        <!-- 3D Card Scene -->
        <div class="card-scene" id="flashcard-scene" onclick="FlashcardsView.toggleFlip()">
          <div class="card-3d ${this.isFlipped ? 'flipped' : ''}" id="flashcard-3d">
            <!-- Front Face -->
            <div class="card-face card-face-front">
              <div class="card-id-badge mono">${FlashcardsView.escapeHtml(word.id)}</div>
              <div class="card-front-content">
                <div class="card-target-word">${FlashcardsView.escapeHtml(displayTarget)}</div>
                <div class="card-phrase-context">${highlightedPhrase}</div>
                <div class="card-audio-controls" onclick="event.stopPropagation()">
                  <button class="btn-audio-pill" onclick="FlashcardsView.playWordAudio()">
                    🔊 Palabra (1 / W)
                  </button>
                  <button class="btn-audio-pill" onclick="FlashcardsView.playPhraseAudio()">
                    🎧 Frase Completa (2 / S)
                  </button>
                </div>
              </div>
              <div class="card-flip-hint">
                Haz clic o pulsa [Espacio] para voltear
              </div>
            </div>

            <!-- Back Face -->
            <div class="card-face card-face-back flashcard-back">
              <div class="card-id-badge mono">${FlashcardsView.escapeHtml(word.id)}</div>
              <div class="card-back-content">
                <div class="back-section">
                  <div class="back-label">Traducción de la palabra</div>
                  <div class="back-target-meaning">${FlashcardsView.escapeHtml(word.targetTranslation || 'Sin traducción')}</div>
                </div>
                <div class="back-section">
                  <div class="back-label">Traducción de la frase</div>
                  <div class="back-phrase-translation">${FlashcardsView.formatSafeTranslation(word.phraseTranslation || 'Sin traducción contextual')}</div>
                </div>

                ${word.notes ? `
                  <div class="back-notes-box">
                    <div class="back-label" style="color: var(--primary);">Notas Gramaticales</div>
                    <div>${this.renderSimpleMarkdown(word.notes)}</div>
                  </div>
                ` : ''}
              </div>

              <div class="card-flip-hint">
                Haz clic o pulsa [Espacio] para volver al frente
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Controls -->
        <div class="flashcards-controls">
          <div class="nav-buttons">
            <button class="btn-secondary" onclick="FlashcardsView.prevCard()" ${this.currentIndex === 0 ? 'disabled' : ''}>
              ← Anterior
            </button>
            <button class="btn-secondary" onclick="FlashcardsView.nextCard()" ${this.currentIndex === total - 1 ? 'disabled' : ''}>
              Siguiente →
            </button>
          </div>

          <!-- Speed Controls for Audio TTS -->
          <div class="flashcards-speed-bar">
            <div class="speed-control-group">
              <span class="speed-icon" title="Velocidad de reproducción para Palabra">🔊</span>
              <label for="speed-word-slider" class="speed-label">Palabra:</label>
              <input type="range" class="speed-slider" id="speed-word-slider" min="0.5" max="1.5" step="0.05" value="${this.wordRate}" oninput="FlashcardsView.onWordSpeedChange(this.value)">
              <span class="speed-value-tag" id="speed-word-val">${Number(this.wordRate).toFixed(2)}x</span>
            </div>
            <div class="speed-control-group">
              <span class="speed-icon" title="Velocidad de reproducción para Frase">🎧</span>
              <label for="speed-phrase-slider" class="speed-label">Frase:</label>
              <input type="range" class="speed-slider" id="speed-phrase-slider" min="0.5" max="1.5" step="0.05" value="${this.phraseRate}" oninput="FlashcardsView.onPhraseSpeedChange(this.value)">
              <span class="speed-value-tag" id="speed-phrase-val">${Number(this.phraseRate).toFixed(2)}x</span>
            </div>
          </div>

          <button class="btn-ready-quiz" id="btn-ready-quiz" onclick="FlashcardsView.startQuiz()">
            ⚡ Ready for Quiz (${this.reviewedCardIds.size})
          </button>
        </div>

        <!-- Shortcuts Bar -->
        <div class="shortcuts-footer">
          <span><span class="kbd-badge">Espacio</span> Voltear</span>
          <span><span class="kbd-badge">← / →</span> Navegar</span>
          <span><span class="kbd-badge">1 / W</span> Palabra</span>
          <span><span class="kbd-badge">2 / S</span> Frase</span>
          <span><span class="kbd-badge">Enter</span> Iniciar Quiz</span>
          <span><span class="kbd-badge">Esc</span> Salir</span>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  static toggleFlip() {
    this.isFlipped = !this.isFlipped;
    const card = document.getElementById('flashcard-3d');
    if (card) {
      if (this.isFlipped) card.classList.add('flipped');
      else card.classList.remove('flipped');
    }
  }

  static prevCard() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.isFlipped = false;
      this.updateCardUi();
    }
  }

  static nextCard() {
    if (this.currentIndex < this.session.words.length - 1) {
      this.currentIndex++;
      this.isFlipped = false;
      this.updateCardUi();
    }
  }

  static playWordAudio(text) {
    if (!text && this.session && this.session.words && this.session.words[this.currentIndex]) {
      text = this.session.words[this.currentIndex].targetText;
    }
    if (window.ttsService && text) {
      const clean = String(text).replace(/<[^>]*>/g, '').trim();
      if (typeof window.ttsService.speakWord === 'function') {
        window.ttsService.speakWord(clean);
      } else {
        window.ttsService.speak(clean, null, this.wordRate);
      }
    }
  }

  static playPhraseAudio(text) {
    if (!text && this.session && this.session.words && this.session.words[this.currentIndex]) {
      text = this.session.words[this.currentIndex].phrase;
    }
    if (window.ttsService && text) {
      const clean = String(text).replace(/<[^>]*>/g, '').trim();
      if (typeof window.ttsService.speakPhrase === 'function') {
        window.ttsService.speakPhrase(clean);
      } else {
        window.ttsService.speak(clean, null, this.phraseRate);
      }
    }
  }

  static startQuiz() {
    this.destroy();
    const words = (this.session && this.session.words) ? this.session.words : null;
    window.app.navigate('quiz', words);
  }

  static exitSession() {
    this.destroy();
    window.store.set('studySession', null);
    window.app.navigate('library');
    window.ModalManager.showToast('Sesión de Flashcards finalizada.', 'info');
  }

  static handleKeyDown(e) {
    // Ignore if input/textarea is focused
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      FlashcardsView.toggleFlip();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      FlashcardsView.nextCard();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      FlashcardsView.prevCard();
    } else if (e.key === '1' || e.key.toLowerCase() === 'w') {
      e.preventDefault();
      const word = FlashcardsView.session.words[FlashcardsView.currentIndex];
      FlashcardsView.playWordAudio(word.targetText);
    } else if (e.key === '2' || e.key.toLowerCase() === 's') {
      e.preventDefault();
      const word = FlashcardsView.session.words[FlashcardsView.currentIndex];
      FlashcardsView.playPhraseAudio(word.phrase);
    } else if (e.code === 'Enter') {
      e.preventDefault();
      FlashcardsView.startQuiz();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      FlashcardsView.exitSession();
    }
  }

  static getDisplayTargetText(word) {
    if (!word) return '';
    try {
      const parser = (typeof window !== 'undefined' && window.PhraseSegmentParser) || 
                     (typeof PhraseSegmentParser !== 'undefined' ? PhraseSegmentParser : null);
      if (parser && word.phrase) {
        const parsed = parser.parse(word.phrase, word.targetTokens, word.targetText);
        if (parsed && Array.isArray(parsed.segments)) {
          const targetSegs = parsed.segments.filter(s => s.isTarget).map(s => s.text.trim()).filter(Boolean);
          if (targetSegs.length > 1) {
            return targetSegs.join('... ');
          } else if (targetSegs.length === 1) {
            return targetSegs[0];
          }
        }
      }
    } catch (e) {
      console.warn('FlashcardsView getDisplayTargetText error:', e);
    }
    return word.targetText || '';
  }

  static formatHighlightedPhrase(word) {
    if (!word || !word.phrase) return '';
    try {
      const parser = (typeof window !== 'undefined' && window.PhraseSegmentParser) || 
                     (typeof PhraseSegmentParser !== 'undefined' ? PhraseSegmentParser : null);
      if (parser) {
        const parsed = parser.parse(word.phrase, word.targetTokens, word.targetText);
        if (parsed && Array.isArray(parsed.segments)) {
          return parsed.segments.map(seg => {
            if (seg.isTarget) {
              return `<mark>${FlashcardsView.escapeHtml(seg.text)}</mark>`;
            }
            return FlashcardsView.escapeHtml(seg.text);
          }).join('');
        }
      }
    } catch (e) {
      console.warn('FlashcardsView formatHighlightedPhrase error:', e);
    }
    const escaped = (word.targetText || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return FlashcardsView.escapeHtml(word.phrase).replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
  }

  static escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  static renderSimpleMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<u>$1</u>')
      .replace(/_(.*?)_/g, '<em>$1</em>');
  }
}

FlashcardsView.init();
if (typeof window !== 'undefined') {
  window.FlashcardsView = FlashcardsView;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FlashcardsView };
}

