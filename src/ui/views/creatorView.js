// ============================================================================
// Lexispelling V2 - Creator Screen (Laboratorio de Creación)
// Interactive token chips, markdown toolbar, instant deck creation
// ============================================================================

class CreatorView {
  static init() {
    this.selectedTokens = new Set();
    this.currentDeckId = null;
  }

  static async render() {
    const container = document.getElementById('view-creator');
    if (!container) return;

    const decks = await window.api.getDecks();
    this.selectedTokens = new Set();

    const activeExplorerDeckId = window.store.get('activeExplorerDeckId');
    if (activeExplorerDeckId) {
      this.currentDeckId = activeExplorerDeckId;
    } else if (!this.currentDeckId && decks.length > 0) {
      this.currentDeckId = decks[0].id;
    }

    let deckOptionsHtml = '';
    decks.forEach(d => {
      deckOptionsHtml += `<option value="${d.id}" ${d.id === this.currentDeckId ? 'selected' : ''}>${d.name}</option>`;
    });
    deckOptionsHtml += `<option value="__NEW__">+ Crear nuevo mazo...</option>`;

    let html = `
      <div class="creator-container">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
          <div>
            <h2 style="font-size: 22px; font-weight: 800; color: #fff;">Laboratorio de Creación de Palabras</h2>
            <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Ingresa una frase real y selecciona los chips de las palabras clave a deletrear.</p>
          </div>
          <button class="appbar-exit-btn" onclick="window.app.navigate('library')">✕ Volver a Biblioteca</button>
        </div>

        <!-- 1. Deck Selector Card -->
        <div class="creator-card">
          <div class="creator-card-title">1. Mazo Destino</div>
          <select id="creator-deck-select" class="form-control" style="font-size: 15px; font-weight: 600;">
            ${deckOptionsHtml}
          </select>
        </div>

        <!-- 2. Sentence & Interactive Chips Card -->
        <div class="creator-card">
          <div class="creator-card-title">
            <span>2. Oración en Contexto</span>
            <span style="font-size: 11px; text-transform: none; color: var(--accent-cyan);">Toca los chips para marcar el objetivo</span>
          </div>
          <textarea id="creator-phrase-input" class="form-control" rows="3" placeholder="Ej: She decided to look after the stray puppy until it recovered." style="font-size: 15px; line-height: 1.5;"></textarea>

          <div style="margin-top: 14px; font-size: 12px; color: var(--text-muted);">Chips de la frase:</div>
          <div class="token-chips-container" id="creator-chips-container">
            <span style="color: var(--text-dim); font-size: 13px; margin: auto;">Escribe una frase arriba para generar chips interactivos...</span>
          </div>

          <div style="margin-top: 12px; font-size: 13px; color: var(--text-muted);">
            Palabra clave unificada a evaluar: <strong id="creator-target-display" style="color: #fff; font-family: var(--font-mono);">(Ninguna seleccionada)</strong>
          </div>
        </div>

        <!-- 3. Translations Card -->
        <div class="creator-card">
          <div class="creator-card-title">3. Traducciones</div>
          <div class="form-group">
            <label class="form-label">Traducción de la palabra clave</label>
            <input type="text" id="creator-target-tr" class="form-control" placeholder="Ej: cuidar de / ocuparse de" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Traducción de la oración completa</label>
            <input type="text" id="creator-phrase-tr" class="form-control" placeholder="Ej: Decidió cuidar al cachorro callejero hasta que se recuperara." />
          </div>
        </div>

        <!-- 4. Notes Card (Markdown) -->
        <div class="creator-card">
          <div class="creator-card-title">4. Notas Gramaticales & Fonética</div>
          <div class="markdown-toolbar">
            <button class="md-btn" onclick="CreatorView.insertMarkdown('**', '**')">**B** (Negrita)</button>
            <button class="md-btn" onclick="CreatorView.insertMarkdown('__', '__')">__U__ (Subrayado)</button>
            <button class="md-btn" onclick="CreatorView.insertMarkdown('_', '_')">_I_ (Cursiva)</button>
          </div>
          <textarea id="creator-notes-input" class="form-control" rows="3" placeholder="Ej: Phrasal verb inseparable. En inglés británico se pronuncia..."></textarea>
        </div>

        <!-- Form Actions -->
        <div class="creator-actions">
          <button class="btn-secondary" onclick="CreatorView.clearForm()">Limpiar Campos</button>
          <button class="btn-primary" onclick="CreatorView.saveAndContinue()">💾 Guardar y Continuar</button>
        </div>
      </div>
    `;

    container.innerHTML = html;
    CreatorView.attachEvents();
  }

  static attachEvents() {
    const deckSelect = document.getElementById('creator-deck-select');
    const phraseInput = document.getElementById('creator-phrase-input');

    if (deckSelect) {
      deckSelect.onchange = (e) => {
        if (e.target.value === '__NEW__') {
          window.LibraryView.openCreateDeckModal();
        } else {
          this.currentDeckId = e.target.value;
        }
      };
    }

    if (phraseInput) {
      phraseInput.oninput = (e) => {
        CreatorView.updateTokenChips(e.target.value);
      };
    }
  }

  static updateTokenChips(phrase) {
    const container = document.getElementById('creator-chips-container');
    if (!container) return;

    const tokens = window.PhraseSegmentParser.extractClickableTokens(phrase);

    if (tokens.length === 0) {
      container.innerHTML = '<span style="color: var(--text-dim); font-size: 13px; margin: auto;">Escribe una frase arriba para generar chips interactivos...</span>';
      this.selectedTokens.clear();
      this.updateTargetDisplay();
      return;
    }

    let chipsHtml = '';
    tokens.forEach((token, idx) => {
      const isSelected = this.selectedTokens.has(token);
      chipsHtml += `
        <span class="token-chip ${isSelected ? 'selected' : ''}" data-token="${token}" onclick="CreatorView.toggleToken('${token}')">
          ${token}
        </span>
      `;
    });

    container.innerHTML = chipsHtml;
    this.updateTargetDisplay();
  }

  static toggleToken(token) {
    if (this.selectedTokens.has(token)) {
      this.selectedTokens.delete(token);
    } else {
      this.selectedTokens.add(token);
    }
    const phraseInput = document.getElementById('creator-phrase-input');
    if (phraseInput) this.updateTokenChips(phraseInput.value);
  }

  static updateTargetDisplay() {
    const displayEl = document.getElementById('creator-target-display');
    const phraseInput = document.getElementById('creator-phrase-input');
    if (!displayEl) return;

    if (this.selectedTokens.size === 0) {
      displayEl.textContent = '(Ninguna seleccionada)';
      return;
    }

    const phrase = phraseInput ? phraseInput.value : '';
    const parsed = window.PhraseSegmentParser.parse(phrase, [...this.selectedTokens]);
    displayEl.textContent = parsed.unifiedTargetText || [...this.selectedTokens].join(' ');
  }

  static insertMarkdown(openTag, closeTag) {
    const textarea = document.getElementById('creator-notes-input');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    const replacement = `${openTag}${selected || 'texto'}${closeTag}`;

    textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    textarea.focus();
    textarea.setSelectionRange(start + openTag.length, start + openTag.length + (selected.length || 5));
  }

  static clearForm() {
    const phraseInput = document.getElementById('creator-phrase-input');
    const targetTr = document.getElementById('creator-target-tr');
    const phraseTr = document.getElementById('creator-phrase-tr');
    const notesInput = document.getElementById('creator-notes-input');

    if (phraseInput) phraseInput.value = '';
    if (targetTr) targetTr.value = '';
    if (phraseTr) phraseTr.value = '';
    if (notesInput) notesInput.value = '';

    this.selectedTokens.clear();
    this.updateTokenChips('');
  }

  static async saveAndContinue() {
    const deckSelect = document.getElementById('creator-deck-select');
    const phraseInput = document.getElementById('creator-phrase-input');
    const targetTr = document.getElementById('creator-target-tr');
    const phraseTr = document.getElementById('creator-phrase-tr');
    const notesInput = document.getElementById('creator-notes-input');

    const deckId = deckSelect ? deckSelect.value : null;
    const phrase = phraseInput ? phraseInput.value.trim() : '';
    const targetTranslation = targetTr ? targetTr.value.trim() : '';
    const phraseTranslation = phraseTr ? phraseTr.value.trim() : '';
    const notes = notesInput ? notesInput.value.trim() : '';

    if (!deckId || deckId === '__NEW__') {
      window.ModalManager.showToast('Por favor selecciona un mazo válido', 'error');
      return;
    }

    if (!phrase) {
      window.ModalManager.showToast('Por favor ingresa una oración de contexto', 'error');
      return;
    }

    if (this.selectedTokens.size === 0) {
      window.ModalManager.showToast('Por favor toca al menos un chip para marcar la palabra a evaluar', 'error');
      return;
    }

    const parsed = window.PhraseSegmentParser.parse(phrase, [...this.selectedTokens]);
    const wordId = 'w_' + Date.now();

    await window.api.createWord({
      id: wordId,
      deckId,
      phrase,
      targetTokens: [...this.selectedTokens],
      targetText: parsed.unifiedTargetText,
      notes,
      phraseTranslation,
      targetTranslation
    });

    window.ModalManager.showToast(`Palabra "${parsed.unifiedTargetText}" guardada con éxito`, 'success');
    CreatorView.clearForm();
  }
}

CreatorView.init();
window.CreatorView = CreatorView;

