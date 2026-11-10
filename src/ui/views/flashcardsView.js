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
    this.keyHandler = this.handleKeyDown.bind(this);
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

    // Start Active Study Timer (Section 6.4)
    window.activeTimer.start('study');

    // Attach global keyboard listener
    window.removeEventListener('keydown', this.keyHandler);
    window.addEventListener('keydown', this.keyHandler);

    this.updateCardUi();
  }

  static destroy() {
    window.removeEventListener('keydown', this.keyHandler);
    window.activeTimer.stop();
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
          <div class="flashcards-counter">Tarjeta ${this.currentIndex + 1} de ${total}</div>
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
              <div style="text-align: center; font-size: 12px; color: var(--text-dim);">
                Haz clic o pulsa [Espacio] para voltear
              </div>
            </div>

            <!-- Back Face -->
            <div class="card-face card-face-back">
              <div>
                <div class="back-section">
                  <div class="back-label">Traducción de la palabra</div>
                  <div class="back-target-meaning">${word.targetTranslation || 'Sin traducción'}</div>
                </div>
                <div class="back-section">
                  <div class="back-label">Traducción de la frase</div>
                  <div class="back-phrase-translation">${word.phraseTranslation || 'Sin traducción contextual'}</div>
                </div>
              </div>

              ${word.notes ? `
                <div class="back-notes-box">
                  <div class="back-label" style="color: var(--primary);">Notas Gramaticales</div>
                  <div>${this.renderSimpleMarkdown(word.notes)}</div>
                </div>
              ` : '<div></div>'}

              <div style="text-align: center; font-size: 12px; color: var(--text-dim);">
                Haz clic o pulsa [Espacio] para voltear al frente
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
      window.ttsService.speak(clean);
    }
  }

  static playPhraseAudio(text) {
    if (!text && this.session && this.session.words && this.session.words[this.currentIndex]) {
      text = this.session.words[this.currentIndex].phrase;
    }
    if (window.ttsService && text) {
      const clean = String(text).replace(/<[^>]*>/g, '').trim();
      window.ttsService.speak(clean);
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

