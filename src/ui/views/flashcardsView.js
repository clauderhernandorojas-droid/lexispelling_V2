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
    const word = this.session.words[this.currentIndex];
    const total = this.session.words.length;
    this.reviewedCardIds.add(word.id);

    // Highlight target word in phrase
    const highlightedPhrase = this.formatHighlightedPhrase(word.phrase, word.targetText);

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
              <div class="card-id-badge mono">${word.id}</div>
              <div class="card-front-content">
                <div class="card-target-word">${word.targetText}</div>
                <div class="card-phrase-context">${highlightedPhrase}</div>
                <div class="card-audio-controls" onclick="event.stopPropagation()">
                  <button class="btn-audio-pill" onclick="FlashcardsView.playWordAudio('${word.targetText}')">
                    🔊 Palabra (1 / W)
                  </button>
                  <button class="btn-audio-pill" onclick="FlashcardsView.playPhraseAudio('${word.phrase.replace(/'/g, "\\'")}')">
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
    if (window.ttsService) {
      window.ttsService.speak(text);
    }
  }

  static playPhraseAudio(text) {
    if (window.ttsService) {
      window.ttsService.speak(text);
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

  static formatHighlightedPhrase(phrase, target) {
    if (!phrase) return '';
    if (!target) return phrase;
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return phrase.replace(regex, '<mark>$1</mark>');
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
window.FlashcardsView = FlashcardsView;

