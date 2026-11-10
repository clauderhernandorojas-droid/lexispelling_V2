// ============================================================================
// Lexispelling V2 - Quiz View (Spelling in Context)
// Real-time keystroke evaluation, Web Audio feedback, resilient mounting
// Strictly compliant with Sections 2.1 & 4.5
// ============================================================================

class QuizView {
  static init() {
    this.session = null;
    this.currentWord = null;
    this.targetString = '';
    this.currentCharIndex = 0;
    this.livesRemaining = 3;
    this.initialLives = 3;
    this.wordStartTime = 0;
    this.failedLetters = [];
    this.activeHint = null;
    this.showHintTranslation = false;
    this.showPostWordNotes = false;
    this.isPostWordPhase = false;
    this.lastWordSuccess = false;
    this.allDeckWords = [];
    this.parsedPhrase = { segments: [], orderedTargetTokens: [], unifiedTargetText: '' };
    this.hasErrorOnCurrentSlot = false;
    this.hintAvailableForCurrentSlot = false;
    this.currentSlotFailedLetter = null;
    this.maintenanceFailCount = {};
    this.keyHandler = this.handleKeyDown.bind(this);
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

  /**
   * Resilient resolver for PhraseSegmentParser.
   * Guarantees segment parsing even if script execution order varies.
   */
  static getParser() {
    if (typeof window !== 'undefined' && window.PhraseSegmentParser && typeof window.PhraseSegmentParser.parse === 'function') {
      return window.PhraseSegmentParser;
    }
    if (typeof PhraseSegmentParser !== 'undefined' && typeof PhraseSegmentParser.parse === 'function') {
      if (typeof window !== 'undefined') {
        window.PhraseSegmentParser = PhraseSegmentParser;
      }
      return PhraseSegmentParser;
    }
    return {
      parse: (phrase, tokens, fallback) => QuizView.internalParsePhrase(phrase, tokens, fallback)
    };
  }

  /**
   * Built-in fallback greedy Unicode segment parser (Section 2.6)
   */
  static internalParsePhrase(phrase, targetTokens = [], fallbackTargetText = '') {
    if (!phrase) {
      const text = fallbackTargetText || '';
      return {
        segments: text ? [{ text, isTarget: true, tokenIndex: 0 }] : [],
        orderedTargetTokens: text ? [text] : [],
        unifiedTargetText: text
      };
    }

    let validTokens = [];
    if (typeof targetTokens === 'string') {
      try {
        const parsed = JSON.parse(targetTokens);
        if (Array.isArray(parsed)) validTokens = parsed;
        else validTokens = [targetTokens];
      } catch (e) {
        validTokens = targetTokens.split(/[,\s]+/).filter(Boolean);
      }
    } else if (Array.isArray(targetTokens)) {
      validTokens = [...targetTokens];
    }

    if (validTokens.length === 0 && fallbackTargetText) {
      validTokens = fallbackTargetText.split(/\s+/).filter(Boolean);
    }

    validTokens = validTokens
      .map(t => String(t || '').trim())
      .filter(t => t.length > 0);

    if (validTokens.length === 0) {
      if (fallbackTargetText && phrase.toLowerCase().includes(fallbackTargetText.toLowerCase())) {
        validTokens = [fallbackTargetText];
      } else {
        return {
          segments: [{ text: phrase, isTarget: false }],
          orderedTargetTokens: [],
          unifiedTargetText: ''
        };
      }
    }

    const matches = [];

    // Full compound check
    if (fallbackTargetText && fallbackTargetText.includes(' ')) {
      const escapedFull = fallbackTargetText.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regexFull = new RegExp(`(?<![\\p{L}\\p{N}_])${escapedFull}(?![\\p{L}\\p{N}_])`, 'gui');
      let mFull;
      while ((mFull = regexFull.exec(phrase)) !== null) {
        matches.push({
          token: fallbackTargetText,
          matchedText: mFull[0],
          startIndex: mFull.index,
          endIndex: mFull.index + mFull[0].length
        });
      }
    }

    if (matches.length === 0) {
      for (const token of validTokens) {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'gui');
        let match;
        while ((match = regex.exec(phrase)) !== null) {
          matches.push({
            token,
            matchedText: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length
          });
        }
      }
    }

    matches.sort((a, b) => a.startIndex - b.startIndex);

    const nonOverlapping = [];
    let lastEnd = 0;
    for (const m of matches) {
      if (m.startIndex >= lastEnd) {
        nonOverlapping.push(m);
        lastEnd = m.endIndex;
      }
    }

    const mergedMatches = [];
    for (let i = 0; i < nonOverlapping.length; i++) {
      const curr = nonOverlapping[i];
      if (mergedMatches.length === 0) {
        mergedMatches.push({ ...curr });
      } else {
        const prev = mergedMatches[mergedMatches.length - 1];
        const inBetween = phrase.substring(prev.endIndex, curr.startIndex);
        if (/^\s+$/.test(inBetween)) {
          prev.endIndex = curr.endIndex;
          prev.matchedText = phrase.substring(prev.startIndex, curr.endIndex);
        } else {
          mergedMatches.push({ ...curr });
        }
      }
    }

    if (mergedMatches.length === 0 && fallbackTargetText) {
      const idx = phrase.toLowerCase().indexOf(fallbackTargetText.toLowerCase());
      if (idx !== -1) {
        mergedMatches.push({
          token: fallbackTargetText,
          matchedText: phrase.substring(idx, idx + fallbackTargetText.length),
          startIndex: idx,
          endIndex: idx + fallbackTargetText.length
        });
      }
    }

    const segments = [];
    const orderedTargetTokens = [];
    let currentIndex = 0;

    for (let i = 0; i < mergedMatches.length; i++) {
      const m = mergedMatches[i];
      if (m.startIndex > currentIndex) {
        segments.push({
          text: phrase.substring(currentIndex, m.startIndex),
          isTarget: false
        });
      }

      segments.push({
        text: phrase.substring(m.startIndex, m.endIndex),
        isTarget: true,
        tokenIndex: i
      });
      orderedTargetTokens.push(m.matchedText);
      currentIndex = m.endIndex;
    }

    if (currentIndex < phrase.length) {
      segments.push({
        text: phrase.substring(currentIndex),
        isTarget: false
      });
    }

    return {
      segments,
      orderedTargetTokens,
      unifiedTargetText: orderedTargetTokens.join(' ') || fallbackTargetText || ''
    };
  }

  /**
   * Resilient mount/render entry point. Accepts words directly or reads from store.
   */
  static async mount(wordsOrSession = null) {
    return this.render(wordsOrSession);
  }

  static async render(wordsOrSession = null) {
    const container = document.getElementById('view-quiz');
    if (!container) return;

    try {
      // 1. Resolve words and session
      let words = null;

      if (Array.isArray(wordsOrSession)) {
        words = wordsOrSession;
      } else if (wordsOrSession && Array.isArray(wordsOrSession.words)) {
        this.session = wordsOrSession;
        words = wordsOrSession.words;
      } else {
        this.session = window.store.get('studySession');
        words = this.session ? this.session.words : null;
      }

      // Safe check: verify words array
      if (!words || !Array.isArray(words) || words.length === 0) {
        console.warn('QuizView: No hay palabras pendientes o disponibles para el Quiz.');
        container.innerHTML = `
          <div class="quiz-container" style="text-align: center; justify-content: center; gap: 20px;">
            <div style="font-size: 52px;">📚</div>
            <h2 style="color: #fff; font-size: 22px;">No hay palabras seleccionadas para este Quiz</h2>
            <p style="color: var(--text-muted); max-width: 440px; font-size: 14px; line-height: 1.5;">
              No se encontraron tarjetas pendientes en la sesión actual. Regresa a la Biblioteca para elegir un mazo o agregar nuevas palabras.
            </p>
            <button class="btn-primary" style="margin-top: 10px;" onclick="QuizView.exitToLibrary()">
              ← Volver a la Biblioteca
            </button>
          </div>
        `;
        return;
      }

      // Ensure session object exists and is synchronized
      if (!this.session || !this.session.words || this.session.words !== words) {
        const deckIds = [...new Set(words.map(w => w.deckId).filter(Boolean))];
        const preSessionLevelMap = {};
        words.forEach(w => {
          preSessionLevelMap[w.id] = w.level;
        });

        this.session = {
          words,
          currentIndex: 0,
          deckIds,
          deckNames: [],
          preSessionLevelMap,
          stashedSuccesses: [],
          round1Failures: [],
          currentFailures: [],
          sessionResults: [],
          startTime: Date.now(),
          isReQuiz: false
        };
        window.store.set('studySession', this.session);
      }

      // 2. Load peer deck words for Hint Engine (safely)
      try {
        if (this.session.deckIds && this.session.deckIds.length > 0 && window.api && window.api.getAllWordsInDecks) {
          this.allDeckWords = await window.api.getAllWordsInDecks(this.session.deckIds);
        }
      } catch (err) {
        console.warn('Could not load peer deck words via IPC, falling back to session words:', err);
      }
      if (!this.allDeckWords || this.allDeckWords.length === 0) {
        this.allDeckWords = [...words];
      }

      // 3. Start Active Evaluation Timer (Section 6.4)
      if (window.activeTimer) {
        window.activeTimer.start('evaluation');
      }

      // 4. Attach global keyboard event listener
      window.removeEventListener('keydown', this.keyHandler);
      window.addEventListener('keydown', this.keyHandler);

      // 5. Load first word
      const initialIndex = (typeof this.session.currentIndex === 'number' && this.session.currentIndex < words.length)
        ? this.session.currentIndex
        : 0;

      this.loadWord(initialIndex);

    } catch (err) {
      console.error('QuizView mount crash prevented:', err);
      container.innerHTML = `
        <div class="quiz-container" style="text-align: center; justify-content: center; gap: 16px;">
          <div style="font-size: 48px; color: var(--error);">⚠️</div>
          <h2 style="color: #fff;">Ocurrió un error al iniciar la sesión del Quiz</h2>
          <pre style="background: var(--bg-card); padding: 14px; border-radius: 8px; color: #fca5a5; max-width: 600px; overflow-x: auto; font-size: 12px; text-align: left;">${err.message}\n${err.stack}</pre>
          <div style="display: flex; gap: 12px; margin-top: 10px;">
            <button class="btn-secondary" onclick="QuizView.exitToLibrary()">← Volver a la Biblioteca</button>
            <button class="btn-primary" onclick="QuizView.mount()">🔄 Reintentar Carga</button>
          </div>
        </div>
      `;
    }
  }

  static destroy() {
    window.removeEventListener('keydown', this.keyHandler);
    if (window.activeTimer) {
      window.activeTimer.stop();
    }
    this.isPostWordPhase = false;
    if (typeof document !== 'undefined') {
      const hiddenInput = document.getElementById('quiz-hidden-input');
      if (hiddenInput) hiddenInput.blur();
    }
  }

  static loadWord(index) {
    try {
      if (!this.session || !this.session.words || index >= this.session.words.length) {
        this.finishRound();
        return;
      }

      this.session.currentIndex = index;
      this.currentWord = this.session.words[index];

      if (!this.currentWord) {
        this.finishRound();
        return;
      }

      this.isPostWordPhase = false;
      this.showPostWordNotes = false;
      this.lastWordSuccess = false;
      this.activeHint = null;
      this.showHintTranslation = false;
      this.hasErrorOnCurrentSlot = false;
      this.hintAvailableForCurrentSlot = false;
      this.currentSlotFailedLetter = null;
      this.failedLetters = [];
      this.wordStartTime = Date.now();

      // Determine initial lives (Section 2.1)
      if (this.currentWord.isNew || this.currentWord.level === null || this.currentWord.level === undefined) {
        this.initialLives = 3;
      } else if (this.currentWord.level === 0 || this.currentWord.level === 1) {
        this.initialLives = 3;
      } else if (this.currentWord.level === 2) {
        this.initialLives = 2;
      } else if (this.currentWord.level === 3) {
        this.initialLives = 1;
      } else if (this.currentWord.level === 4) {
        this.initialLives = 0; // Mastery: 0 lives (1 error triggers maintenance rule)
      } else {
        this.initialLives = 3;
      }
      this.livesRemaining = this.initialLives;

      // Parse phrase using greedy Unicode parser with robust fallback
      const phraseText = this.currentWord.phrase || this.currentWord.targetText || '';
      const parser = QuizView.getParser();
      const parsed = parser.parse(
        phraseText,
        this.currentWord.targetTokens,
        this.currentWord.targetText
      );

      this.parsedPhrase = parsed;

      // Extract unified target string strictly 1-to-1 from target segment characters
      let targetChars = '';
      if (parsed && Array.isArray(parsed.segments)) {
        for (const seg of parsed.segments) {
          if (seg.isTarget) {
            targetChars += seg.text;
          }
        }
      }

      this.targetString = targetChars || parsed.unifiedTargetText || this.currentWord.targetText || '';
      this.currentCharIndex = 0;

      this.updateUi();

    } catch (err) {
      console.error('QuizView loadWord error:', err);
      this.updateUi();
    }
  }

  static updateUi() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('view-quiz');
    if (!container || !this.currentWord) return;

    try {
      const totalWords = this.session.words.length;
      const wordNum = this.session.currentIndex + 1;
      const isMuted = Boolean(window.soundFeedback && window.soundFeedback.muted);

      // Render lives
      let livesHtml = '';
      if (this.initialLives === 0) {
        livesHtml = `<span class="life-count-badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc;">Modo Maestría (0 Vidas)</span>`;
      } else {
        for (let i = 0; i < this.initialLives; i++) {
          const isLost = i >= this.livesRemaining;
          livesHtml += `<span class="life-heart ${isLost ? 'lost' : ''}">❤</span>`;
        }
        if (this.livesRemaining === 0) {
          livesHtml += `<span class="life-count-badge last-chance-badge" title="Última oportunidad antes de fallar">¡Última Oportunidad!</span>`;
        }
      }

      // Build sentence segments with slots synchronized 1-to-1 with targetString
      let slotsHtml = '';
      let globalCharOffset = 0;

      const segments = (this.parsedPhrase && Array.isArray(this.parsedPhrase.segments) && this.parsedPhrase.segments.length > 0)
        ? this.parsedPhrase.segments
        : [{ text: this.targetString || this.currentWord.targetText || '', isTarget: true, tokenIndex: 0 }];

      for (const segment of segments) {
        if (!segment.isTarget) {
          slotsHtml += `<span class="sentence-static-token">${QuizView.escapeHtml(segment.text)}</span>`;
        } else {
          slotsHtml += `<span class="spelling-slots-group">`;
          let inWord = false;
          for (let i = 0; i < segment.text.length; i++) {
            const char = segment.text[i];
            const isSpace = char === ' ';
            const isFilled = globalCharOffset < this.currentCharIndex;
            const isActive = globalCharOffset === this.currentCharIndex;

            let displayChar = '_';
            if (isFilled) {
              displayChar = isSpace ? '␣' : QuizView.escapeHtml(char);
            } else if (isSpace) {
              displayChar = '␣';
            }

            const stateClass = isFilled ? 'filled' : (isActive ? 'active' : 'unfilled');
            const spaceClass = isSpace ? 'space-slot' : '';

            // Group non-space letters into a word unit for clean responsive wrapping
            if (!isSpace && !inWord) {
              slotsHtml += `<span class="spelling-word-unit">`;
              inWord = true;
            } else if (isSpace && inWord) {
              slotsHtml += `</span>`;
              inWord = false;
            }

            slotsHtml += `
              <span class="char-slot ${spaceClass} ${stateClass}" data-char-idx="${globalCharOffset}">
                ${displayChar}
              </span>
            `;
            globalCharOffset++;
          }
          if (inWord) {
            slotsHtml += `</span>`;
            inWord = false;
          }
          slotsHtml += `</span>`;
        }
      }

      const html = `
        <div class="red-flash-overlay" id="red-flash"></div>

        <div class="quiz-container" onclick="QuizView.focusInput()">
          <!-- Hidden input for permanent keyboard focus on desktop/mobile (Section 4.5) -->
          <input type="text" id="quiz-hidden-input" autocomplete="off" autocapitalize="off" spellcheck="false" />

          <!-- Quiz Header with Direct Return Button -->
          <div class="quiz-header">
            <div style="display: flex; align-items: center; gap: 12px;">
              <button class="appbar-exit-btn" onclick="QuizView.confirmExit()" title="Salir del Quiz">
                ✕ Salir del Quiz
              </button>
              <div class="quiz-progress-text">
                ${this.session.isReQuiz ? '🔄 RE-QUIZ: ' : ''}Palabra ${wordNum} de ${totalWords}
              </div>
            </div>
            
            <div class="quiz-lives-container">
              ${livesHtml}
            </div>

            <div class="quiz-header-actions">
              <button class="btn-icon" onclick="QuizView.toggleAudio()" title="${isMuted ? 'Activar sonido' : 'Silenciar sonido'}">
                ${isMuted ? '🔇' : '🔊'}
              </button>
            </div>
          </div>

          <!-- Central Spelling Arena (Section 4.5) -->
          <div class="quiz-arena">
            <div class="quiz-sentence-context">
              ${slotsHtml}
            </div>

            <!-- Translations Box (Section 4.5: phrase always visible, word hidden during active hint) -->
            <div class="quiz-translations-box">
              <div class="phrase-translation-text">${QuizView.escapeHtml(this.currentWord.phraseTranslation || '')}</div>
              <div class="word-translation-text ${this.activeHint ? 'hidden' : ''}">
                💡 Significado: ${QuizView.escapeHtml(this.currentWord.targetTranslation || 'Sin traducción')}
              </div>
            </div>

            <!-- Clue / Hint Panel (Section 2.2 & 4.5) -->
            <div class="quiz-hint-panel">
              ${!this.activeHint ? `
                <button class="btn-request-hint" id="btn-request-hint" 
                  onclick="QuizView.requestHint()" 
                  ${(!this.hasErrorOnCurrentSlot || !this.hintAvailableForCurrentSlot) ? 'disabled' : ''}>
                  🔍 Pedir Pista Contextual ${this.hasErrorOnCurrentSlot && this.hintAvailableForCurrentSlot ? '(Disponible)' : '(Requiere error en casilla)'}
                </button>
              ` : `
                <div class="distorted-hint-card">
                  <div style="font-size: 11px; text-transform: uppercase; color: var(--warning); font-weight: 700; letter-spacing: 0.5px;">
                    ${QuizView.escapeHtml(this.activeHint.title || 'Pista Contextual Distorsionada')}
                  </div>
                  <div class="distorted-phrase-mono hint-distorted-phrase">
                    ${this.showHintTranslation ? QuizView.escapeHtml(this.activeHint.phraseTranslation) : (this.activeHint.distortedHtml || QuizView.escapeHtml(this.activeHint.distortedPhrase))}
                  </div>
                  <div class="hint-toggle-row">
                    <button class="btn-secondary" style="font-size: 11px; padding: 4px 10px;" onclick="QuizView.toggleHintDisplay()">
                      ${this.showHintTranslation ? 'Ver frase distorsionada' : 'Ver traducción'}
                    </button>
                  </div>
                </div>
              `}
            </div>

            <!-- Post-Word Feedback Overlay (Punto 3) -->
            ${this.isPostWordPhase ? `
              <div class="post-word-overlay ${this.lastWordSuccess ? 'success' : 'failure'}">
                <div class="post-word-title ${this.lastWordSuccess ? 'success' : 'failure'}">
                  ${this.lastWordSuccess ? '✓ ¡Correcto!' : '✗ Palabra Fallada'}
                </div>

                <div class="post-word-target-title">
                  ${QuizView.escapeHtml(this.currentWord.targetText)}
                </div>
                ${this.currentWord.targetTranslation ? `
                  <div class="post-word-target-translation">
                    💡 ${QuizView.escapeHtml(this.currentWord.targetTranslation)}
                  </div>
                ` : ''}

                <div class="post-word-phrase-box">
                  <div class="post-word-phrase-text">
                    ${QuizView.formatHighlightedPhrase(this.currentWord)}
                  </div>
                  ${this.currentWord.phraseTranslation ? `
                    <div class="post-word-phrase-translation">
                      ${QuizView.escapeHtml(this.currentWord.phraseTranslation)}
                    </div>
                  ` : ''}
                </div>

                ${(this.showPostWordNotes && this.currentWord.notes && this.currentWord.notes.trim()) ? `
                  <div class="post-word-notes-card">
                    <div class="post-word-notes-header">📝 Anotación Cultural / Gramatical</div>
                    <div class="post-word-notes-body">${QuizView.renderSimpleMarkdown(QuizView.escapeHtml(this.currentWord.notes))}</div>
                  </div>
                ` : ''}

                <div class="post-word-actions">
                  <button class="btn-secondary" onclick="QuizView.speakTargetWord()" title="Escuchar pronunciación de la palabra (Tecla 1)">
                    🔊 Palabra <span class="post-word-key-hint">[1]</span>
                  </button>
                  <button class="btn-secondary" onclick="QuizView.speakContextPhrase()" title="Escuchar pronunciación de la frase (Tecla 2)">
                    🎧 Frase <span class="post-word-key-hint">[2]</span>
                  </button>
                  ${(this.currentWord.notes && this.currentWord.notes.trim()) ? `
                    <button class="btn-secondary ${this.showPostWordNotes ? 'active' : ''}" onclick="QuizView.togglePostWordNotes()" title="Ver u ocultar anotación (Tecla 3)">
                      📝 ${this.showPostWordNotes ? 'Ocultar Nota' : 'Ver Nota'} <span class="post-word-key-hint">[3]</span>
                    </button>
                  ` : ''}
                  <button class="btn-primary" onclick="QuizView.nextWord()" title="Avanzar a la siguiente palabra (Enter)">
                    Siguiente Palabra [Enter] →
                  </button>
                </div>
              </div>
            ` : ''}
          </div>

          <div style="font-size: 12px; color: var(--text-dim); text-align: center; margin-top: 16px;">
            Teclea directamente las letras en tu teclado. Los espacios se teclean con [Espacio].
          </div>
        </div>
      `;

      container.innerHTML = html;

      // Attach IME / virtual keyboard filter (Section 2.1)
      const hiddenInput = document.getElementById('quiz-hidden-input');
      if (hiddenInput) {
        hiddenInput.value = '';
        hiddenInput.oninput = () => {
          const val = hiddenInput.value;
          hiddenInput.value = '';
          if (val && val.length > 0) {
            const lastChar = val.slice(-1);
            this.evaluateTypedChar(lastChar);
          }
        };
      }

      this.focusInput();

    } catch (err) {
      console.error('QuizView updateUi error:', err);
    }
  }

  static focusInput() {
    if (typeof document === 'undefined') return;
    const hiddenInput = document.getElementById('quiz-hidden-input');
    if (hiddenInput && document.activeElement !== hiddenInput) {
      try {
        hiddenInput.focus({ preventScroll: true });
      } catch (e) {
        hiddenInput.focus();
      }
    }
  }

  static toggleAudio() {
    if (window.soundFeedback) {
      window.soundFeedback.toggleMute();
    }
    this.updateUi();
  }

  static exitToLibrary() {
    this.confirmExit();
  }

  static handleKeyDown(e) {
    if (this.isPostWordPhase) {
      if (e.code === 'Enter' || e.key === 'Enter') {
        e.preventDefault();
        this.nextWord();
      } else if (e.key === '1' || e.key.toLowerCase() === 'w') {
        e.preventDefault();
        this.speakTargetWord();
      } else if (e.key === '2' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.speakContextPhrase();
      } else if (e.key === '3' || e.key.toLowerCase() === 'n') {
        if (this.currentWord && this.currentWord.notes) {
          e.preventDefault();
          this.togglePostWordNotes();
        }
      }
      return;
    }

    if (e.code === 'Escape' || e.key === 'Escape') {
      e.preventDefault();
      this.confirmExit();
      return;
    }

    // Ignore navigation, functional, and modifier keys (Ctrl, Alt, Meta, Tab, etc.)
    if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1) {
      return;
    }

    e.preventDefault();
    this.evaluateTypedChar(e.key);
  }

  static evaluateTypedChar(char) {
    if (!this.targetString || this.currentCharIndex >= this.targetString.length) return;

    const expectedChar = this.targetString[this.currentCharIndex];
    const isMatch = char.toLowerCase() === expectedChar.toLowerCase();

    if (isMatch) {
      // Keystroke correct (Section 2.1 & 2.3)
      if (window.soundFeedback) {
        window.soundFeedback.playSuccess();
      }
      this.currentCharIndex++;

      // Immediately dismantle and hide the hint panel on correct keystroke (Section 2.2 & 4.5)
      this.activeHint = null;
      this.showHintTranslation = false;
      this.hasErrorOnCurrentSlot = false;
      this.hintAvailableForCurrentSlot = false;
      this.currentSlotFailedLetter = null;

      // Check if word completed
      if (this.currentCharIndex >= this.targetString.length) {
        this.handleWordSuccess();
      } else {
        this.updateUi();
      }
    } else {
      // Mistake (Section 2.1 & 2.3)
      if (window.soundFeedback) {
        window.soundFeedback.playError();
      }
      this.triggerRedFlash();
      this.failedLetters.push(expectedChar);

      // Error on current slot enables 1 hint (Section 2.2 & 4.5)
      this.hasErrorOnCurrentSlot = true;
      this.hintAvailableForCurrentSlot = true;
      this.currentSlotFailedLetter = expectedChar;

      // Rule 2 (Gap Analysis Punto 2): Protection of the last life
      if (this.initialLives === 0) {
        // Mastery / Level 4 maintenance rule
        this.handleMaintenanceFailure();
        return;
      }

      // If user was already on their last chance (0 lives remaining) and makes another mistake:
      if (this.livesRemaining === 0) {
        this.handleWordFailure();
        return;
      }

      // Decrement lives: 3 -> 2 -> 1 -> 0 (enters last chance)
      this.livesRemaining--;
      this.updateUi();
    }
  }

  static triggerRedFlash() {
    if (typeof document === 'undefined') return;
    const flash = document.getElementById('red-flash');
    if (flash) {
      flash.classList.add('active');
      setTimeout(() => flash.classList.remove('active'), 140);
    }
  }

  static requestHint() {
    if (!this.hasErrorOnCurrentSlot || !this.hintAvailableForCurrentSlot) return;
    const failedLetter = this.currentSlotFailedLetter || (this.failedLetters.length > 0 ? this.failedLetters[this.failedLetters.length - 1] : null);
    if (!failedLetter) return;

    const hintEngine = (typeof window !== 'undefined' && window.HintEngine) || (typeof HintEngine !== 'undefined' ? HintEngine : null);
    
    if (!hintEngine || typeof hintEngine.generateDistortedHint !== 'function') {
      window.ModalManager.showToast('Motor de pistas no disponible', 'error');
      return;
    }

    const hint = hintEngine.generateDistortedHint(
      failedLetter,
      this.currentWord,
      this.allDeckWords
    );

    if (hint) {
      if (window.soundFeedback) {
        window.soundFeedback.playHint();
      }
      this.activeHint = hint;
      this.showHintTranslation = false;
      this.hintAvailableForCurrentSlot = false; // Se consume 1 sola pista por cada fallo cometido (Section 2.2)
      this.updateUi();
    } else {
      window.ModalManager.showToast('No hay frases adicionales en este mazo con esta letra', 'info');
    }
  }

  static toggleHintDisplay() {
    this.showHintTranslation = !this.showHintTranslation;
    this.updateUi();
  }

  static speakTargetWord() {
    if (window.ttsService && this.currentWord) {
      window.ttsService.speak(this.currentWord.targetText);
    }
  }

  static speakContextPhrase() {
    if (window.ttsService && this.currentWord) {
      window.ttsService.speak(this.currentWord.phrase);
    }
  }

  static togglePostWordNotes() {
    this.showPostWordNotes = !this.showPostWordNotes;
    this.updateUi();
  }

  static formatHighlightedPhrase(word) {
    if (!word || !word.phrase) return '';
    try {
      const parser = QuizView.getParser();
      if (parser) {
        const parsed = parser.parse(word.phrase, word.targetTokens, word.targetText);
        if (parsed && Array.isArray(parsed.segments)) {
          return parsed.segments.map(seg => {
            if (seg.isTarget) {
              return `<mark class="quiz-highlight-target">${QuizView.escapeHtml(seg.text)}</mark>`;
            }
            return QuizView.escapeHtml(seg.text);
          }).join('');
        }
      }
    } catch (e) {
      console.warn('QuizView formatHighlightedPhrase error:', e);
    }
    const escaped = (word.targetText || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return QuizView.escapeHtml(word.phrase).replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="quiz-highlight-target">$1</mark>');
  }

  static renderSimpleMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<u>$1</u>')
      .replace(/_(.*?)_/g, '<em>$1</em>');
  }

  static confirmExit() {
    const evaluatedCount = (this.session && this.session.sessionResults) ? this.session.sessionResults.length : 0;

    if (evaluatedCount === 0) {
      if (typeof window !== 'undefined' && window.ModalManager) {
        window.ModalManager.openModal({
          title: '¿Deseas salir del Quiz?',
          bodyHtml: `
            <p>Aún no has completado ninguna palabra en esta sesión.</p>
            <p style="margin-top: 8px; color: var(--text-muted); font-size: 13px;">
              Si sales ahora volverás a la Biblioteca sin registrar cambios de progreso en tu mazo.
            </p>
          `,
          confirmText: 'Sí, volver a la Biblioteca',
          cancelText: 'Continuar sesión',
          onConfirm: () => {
            this.destroy();
            window.store.set('studySession', null);
            window.app.navigate('library');
            window.ModalManager.showToast('Sesión cancelada. Has vuelto a la Biblioteca.', 'info');
            return true;
          }
        });
      }
      return;
    }

    if (typeof window !== 'undefined' && window.ModalManager) {
      window.ModalManager.openModal({
        title: '¿Deseas salir del Quiz?',
        bodyHtml: `
          <p><strong>¿Deseas salir? Guardaremos tu progreso actual y generaremos tu informe.</strong></p>
          <p style="margin-top: 10px; color: var(--text-muted); font-size: 13px;">
            Has evaluado <strong>${evaluatedCount}</strong> palabra(s) en esta sesión.
            Las palabras no contestadas permanecerán intactas en estado pendiente en tu mazo.
          </p>
        `,
        confirmText: 'Guardar y Ver Informe',
        cancelText: 'Continuar sesión',
        onConfirm: async () => {
          await this.handleEmergencyExit();
          return true;
        }
      });
    }
  }

  static async handleEmergencyExit() {
    this.destroy();
    if (this.session && this.session.sessionResults && this.session.sessionResults.length > 0) {
      await this.finalizeSessionStats();
      if (typeof window !== 'undefined') {
        window.store.set('studySession', this.session);
        window.app.navigate('report');
        window.ModalManager.showToast('Progreso parcial guardado. Mostrando informe.', 'success');
      }
    } else {
      if (typeof window !== 'undefined') {
        window.store.set('studySession', null);
        window.app.navigate('library');
        window.ModalManager.showToast('Sesión finalizada. Has vuelto a la Biblioteca.', 'info');
      }
    }
  }

  // --- Success Handler ---
  static async handleWordSuccess() {
    const duration = Number(((Date.now() - this.wordStartTime) / 1000).toFixed(1));
    this.isPostWordPhase = true;
    this.lastWordSuccess = true;

    const preLevel = this.session.preSessionLevelMap ? this.session.preSessionLevelMap[this.currentWord.id] : this.currentWord.level;
    let updated = null;

    if (window.api && window.api.updateWordOutcome) {
      updated = await window.api.updateWordOutcome({
        wordId: this.currentWord.id,
        success: true,
        isReQuiz: Boolean(this.session.isReQuiz),
        preSessionLevel: preLevel
      });
    }

    const resultRecord = {
      wordId: this.currentWord.id,
      word: this.currentWord.targetText,
      phrase: this.currentWord.phrase,
      originalLevel: preLevel !== undefined ? preLevel : (this.currentWord.level ?? 'Nueva'),
      finalLevel: updated ? updated.level : (preLevel ?? 1),
      timeSeconds: duration,
      wentToRequiz: Boolean(this.session.isReQuiz),
      completedSuccessfully: true,
      failedLetters: [...this.failedLetters]
    };

    if (this.session.isReQuiz) {
      this.session.sessionResults = this.session.sessionResults.filter(r => r.wordId !== this.currentWord.id);
      this.session.sessionResults.push(resultRecord);
    } else {
      this.session.sessionResults.push(resultRecord);
      this.session.stashedSuccesses.push(this.currentWord);
    }

    this.updateUi();
  }

  // --- Failure Handler ---
  static async handleWordFailure() {
    const duration = Number(((Date.now() - this.wordStartTime) / 1000).toFixed(1));
    this.isPostWordPhase = true;
    this.lastWordSuccess = false;

    const preLevel = this.session.preSessionLevelMap ? this.session.preSessionLevelMap[this.currentWord.id] : this.currentWord.level;
    let updated = null;

    if (window.api && window.api.updateWordOutcome) {
      updated = await window.api.updateWordOutcome({
        wordId: this.currentWord.id,
        success: false,
        isReQuiz: Boolean(this.session.isReQuiz),
        preSessionLevel: preLevel
      });
    }

    const resultRecord = {
      wordId: this.currentWord.id,
      word: this.currentWord.targetText,
      phrase: this.currentWord.phrase,
      originalLevel: preLevel !== undefined ? preLevel : (this.currentWord.level ?? 'Nueva'),
      finalLevel: updated ? updated.level : 0,
      timeSeconds: duration,
      wentToRequiz: Boolean(this.session.isReQuiz),
      completedSuccessfully: false,
      failedLetters: [...this.failedLetters]
    };

    if (!this.session.isReQuiz) {
      this.session.round1Failures.push(this.currentWord);
      this.session.sessionResults.push(resultRecord);
    } else {
      this.session.sessionResults = this.session.sessionResults.filter(r => r.wordId !== this.currentWord.id);
      this.session.sessionResults.push(resultRecord);
    }

    this.updateUi();
  }

  // --- Special Maintenance Rule (Section 2.4) ---
  static handleMaintenanceFailure() {
    const wordId = this.currentWord.id;
    this.maintenanceFailCount[wordId] = (this.maintenanceFailCount[wordId] || 0) + 1;

    if (this.maintenanceFailCount[wordId] === 1) {
      // 1st failure: pause quiz, show reinforcement card, grant 2nd chance
      window.ModalManager.openModal({
        title: '⚠️ Refuerzo de Mantenimiento',
        bodyHtml: `
          <div style="text-align: center;">
            <p style="color: var(--warning); margin-bottom: 12px; font-weight: 600;">
              Primer fallo en palabra dominada. Repasa la tarjeta de refuerzo:
            </p>
            <div style="background: var(--bg-input); padding: 16px; border-radius: 8px; border: 1px solid var(--border-subtle); margin-bottom: 12px;">
              <div style="font-size: 26px; font-weight: 800; color: #fff; margin-bottom: 6px;">${QuizView.escapeHtml(this.currentWord.targetText)}</div>
              <div style="color: var(--text-muted); font-style: italic;">"${QuizView.escapeHtml(this.currentWord.phrase)}"</div>
              <div style="color: var(--accent-cyan); margin-top: 6px; font-weight: 600;">${QuizView.escapeHtml(this.currentWord.targetTranslation || '')}</div>
            </div>
            <p style="font-size: 13px; color: var(--text-muted);">Se te concede una segunda oportunidad dentro de esta sesión.</p>
          </div>
        `,
        confirmText: 'Reintentar Ahora',
        onConfirm: () => {
          this.currentCharIndex = 0;
          this.livesRemaining = 0;
          this.failedLetters = [];
          this.activeHint = null;
          this.showHintTranslation = false;
          this.hasErrorOnCurrentSlot = false;
          this.hintAvailableForCurrentSlot = false;
          this.currentSlotFailedLetter = null;
          this.wordStartTime = Date.now();
          this.updateUi();
          return true;
        }
      });
    } else {
      // 2nd failure: degrade from maintenance
      this.handleWordFailure();
    }
  }

  static nextWord() {
    this.loadWord(this.session.currentIndex + 1);
  }

  // --- End of Quiz / Flowchart Routing ---
  static async finishRound() {
    this.destroy();

    // Check flowchart: ¿Hubo fallos en ronda 1?
    if (!this.session.isReQuiz && this.session.round1Failures.length > 0) {
      window.ModalManager.openModal({
        title: '🔄 Repasar Fallos (Circuito Re-Quiz)',
        bodyHtml: `
          <p>Has completado la Ronda 1 con <strong>${this.session.round1Failures.length} palabra(s) fallada(s)</strong>.</p>
          <p style="margin-top: 8px; color: var(--text-muted); font-size: 13px;">
            A continuación pasarás por las Flashcards de refuerzo consciente y luego realizarás el <strong>Re-Quiz</strong> para recuperar el nivel previo de esas palabras.
          </p>
        `,
        confirmText: 'Comenzar Repaso de Fallos',
        cancelText: 'Ver Informe Ahora',
        onConfirm: () => {
          this.session.isReQuiz = true;
          this.session.words = [...this.session.round1Failures];
          this.session.currentIndex = 0;
          window.store.set('studySession', this.session);

          window.app.navigate('flashcards');
          return true;
        }
      });
      return;
    }

    // No failures or finished Re-Quiz -> Consolidate Final Report
    await this.finalizeSessionStats();
    window.app.navigate('report');
  }

  static async finalizeSessionStats() {
    const results = this.session.sessionResults || [];
    const totalCorrect = results.filter(r => r.completedSuccessfully).length;
    const totalFailed = results.filter(r => !r.completedSuccessfully).length;
    const totalDuration = results.reduce((acc, r) => acc + (r.timeSeconds || 0), 0);

    if (window.api && window.api.saveQuizResult) {
      await window.api.saveQuizResult({
        id: 'quiz_' + Date.now(),
        deckIds: this.session.deckIds || [],
        totalCorrect,
        totalFailed,
        durationSeconds: totalDuration,
        rows: results
      });
    }

    if (window.api && window.api.recordEvaluation) {
      await window.api.recordEvaluation(results.length, totalFailed);
    }
  }
}

QuizView.init();
if (typeof window !== 'undefined') {
  window.QuizView = QuizView;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { QuizView };
}
