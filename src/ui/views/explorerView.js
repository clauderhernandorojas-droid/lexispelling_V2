// ============================================================================
// Lexispelling V2 - Deck Words Explorer View (Master-Detail)
// Real-time search, filter chips, word inspection, maintenance quiz launcher
// ============================================================================

class ExplorerView {
  static init() {
    this.deckId = null;
    this.deck = null;
    this.words = [];
    this.filteredWords = [];
    this.selectedWordId = null;
    this.activeFilter = 'all'; // 'all', 'new', '0', '1', '2', '3', '4'
    this.searchQuery = '';
  }

  static async render() {
    const container = document.getElementById('view-explorer');
    if (!container) return;

    this.deckId = window.store.get('activeExplorerDeckId');
    if (!this.deckId) {
      window.app.navigate('library');
      return;
    }

    this.deck = await window.api.getDeck(this.deckId);
    this.words = await window.api.getWordsByDeck(this.deckId);

    if (this.words.length > 0 && !this.selectedWordId) {
      this.selectedWordId = this.words[0].id;
    }

    this.applyFilters();
    this.renderLayout();
  }

  static applyFilters() {
    let result = [...this.words];

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(w =>
        (w.targetText && w.targetText.toLowerCase().includes(q)) ||
        (w.phrase && w.phrase.toLowerCase().includes(q)) ||
        (w.targetTranslation && w.targetTranslation.toLowerCase().includes(q))
      );
    }

    if (this.activeFilter !== 'all') {
      if (this.activeFilter === 'new') {
        result = result.filter(w => Boolean(w.isNew));
      } else {
        const lvl = parseInt(this.activeFilter, 10);
        result = result.filter(w => !w.isNew && w.level === lvl);
      }
    }

    this.filteredWords = result;

    if (this.filteredWords.length > 0) {
      const hasSelected = this.filteredWords.some(w => w.id === this.selectedWordId);
      if (!hasSelected) {
        this.selectedWordId = this.filteredWords[0].id;
      }
    } else {
      this.selectedWordId = null;
    }
  }

  static renderLayout() {
    const container = document.getElementById('view-explorer');
    if (!container) return;

    const learnedCount = this.words.filter(w => w.isLearned || w.level === 4).length;
    const selectedWord = this.words.find(w => w.id === this.selectedWordId);

    let html = `
      <div class="explorer-container">
        <!-- Top Bar -->
        <div class="explorer-top-bar">
          <div style="display: flex; align-items: center; gap: 12px;">
            <button class="appbar-exit-btn" onclick="window.app.navigate('library')">✕ Volver a Biblioteca</button>
            <h3 style="font-size: 16px; font-weight: 700; color: #fff;">
              ${this.deck ? this.deck.name : 'Explorador'} (${this.words.length} palabras)
            </h3>
          </div>

          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="btn-primary" style="font-size: 13px; padding: 6px 14px;" onclick="ExplorerView.addNewWordToThisDeck()">
              + Nueva Palabra
            </button>
            ${learnedCount > 0 ? `
              <button class="btn-secondary" style="background: rgba(168, 85, 247, 0.15); border-color: rgba(168, 85, 247, 0.4); color: #c084fc; font-size: 13px;" onclick="ExplorerView.startMaintenanceQuiz()">
                ⭐ Repasar Aprendidas (${learnedCount})
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Master-Detail Split Screen -->
        <div class="explorer-master-detail">
          <!-- Left Panel (List) -->
          <div class="explorer-master-panel">
            <div class="master-search-box">
              <input type="text" id="explorer-search" class="form-control" placeholder="Buscar palabra o frase..." value="${this.searchQuery}" />
              
              <!-- Filter Chips -->
              <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px;">
                <button class="badge ${this.activeFilter === 'all' ? 'badge-new' : ''}" style="cursor: pointer;" onclick="ExplorerView.setFilter('all')">Todas</button>
                <button class="badge ${this.activeFilter === 'new' ? 'badge-new' : ''}" style="cursor: pointer;" onclick="ExplorerView.setFilter('new')">Nuevas</button>
                <button class="badge ${this.activeFilter === '0' ? 'badge-0' : ''}" style="cursor: pointer;" onclick="ExplorerView.setFilter('0')">N0</button>
                <button class="badge ${this.activeFilter === '1' ? 'badge-1' : ''}" style="cursor: pointer;" onclick="ExplorerView.setFilter('1')">N1</button>
                <button class="badge ${this.activeFilter === '2' ? 'badge-2' : ''}" style="cursor: pointer;" onclick="ExplorerView.setFilter('2')">N2</button>
                <button class="badge ${this.activeFilter === '3' ? 'badge-3' : ''}" style="cursor: pointer;" onclick="ExplorerView.setFilter('3')">N3</button>
                <button class="badge ${this.activeFilter === '4' ? 'badge-4' : ''}" style="cursor: pointer;" onclick="ExplorerView.setFilter('4')">N4</button>
              </div>
            </div>

            <!-- Words List -->
            <div class="master-words-list">
    `;

    if (this.filteredWords.length === 0) {
      html += `
        <div style="text-align: center; padding: 40px 10px; color: var(--text-dim); font-size: 13px;">
          No se encontraron palabras con los filtros actuales.
        </div>
      `;
    } else {
      this.filteredWords.forEach(w => {
        const isSelected = w.id === this.selectedWordId;
        const levelBadgeClass = w.isNew ? 'badge-new' : `badge-${w.level ?? 0}`;
        const levelText = w.isNew ? 'Nueva' : `N${w.level ?? 0}`;

        html += `
          <div class="master-word-item ${isSelected ? 'active' : ''}" onclick="ExplorerView.selectWord('${w.id}')">
            <div>
              <div style="font-weight: 700; color: #fff; font-size: 14px;">${w.targetText}</div>
              <div style="font-size: 12px; color: var(--text-muted); text-overflow: ellipsis; white-space: nowrap; overflow: hidden; max-width: 240px;">
                ${w.phrase}
              </div>
            </div>
            <span class="badge ${levelBadgeClass}">${levelText}</span>
          </div>
        `;
      });
    }

    html += `
            </div>
          </div>

          <!-- Right Panel (Detail) -->
          <div class="explorer-detail-panel">
    `;

    if (!selectedWord) {
      html += `
        <div style="text-align: center; margin: auto; color: var(--text-dim);">
          Selecciona una palabra de la lista para ver sus detalles.
        </div>
      `;
    } else {
      const nextReviewDate = selectedWord.nextReviewAt ? new Date(selectedWord.nextReviewAt).toLocaleDateString('es-ES') : 'Inmediato';

      html += `
        <div class="detail-card">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px;">
            <div>
              <h2 style="font-size: 32px; font-weight: 800; color: #fff;">${selectedWord.targetText}</h2>
              <div style="font-size: 16px; color: var(--accent-cyan); font-weight: 600; margin-top: 4px;">
                ${selectedWord.targetTranslation || 'Sin traducción asignada'}
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <span class="badge ${selectedWord.isNew ? 'badge-new' : `badge-${selectedWord.level ?? 0}`}" style="font-size: 12px; padding: 4px 10px;">
                ${selectedWord.isNew ? 'Palabra Nueva' : `Nivel SRS ${selectedWord.level}`}
              </span>
              ${selectedWord.isLearned ? '<span class="badge badge-4">Aprendida</span>' : ''}
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">Frase en contexto</div>
            <div style="font-size: 18px; line-height: 1.5; color: #e2e8f0; background: var(--bg-input); padding: 16px; border-radius: var(--radius-md); border-left: 4px solid var(--primary);">
              "${selectedWord.phrase}"
            </div>
            <div style="font-size: 14px; color: var(--text-muted); font-style: italic; margin-top: 6px;">
              ${selectedWord.phraseTranslation || ''}
            </div>
          </div>

          <div style="display: flex; gap: 12px; margin-bottom: 24px;">
            <button class="btn-audio-pill" onclick="window.ttsService.speak('${selectedWord.targetText}')">
              🔊 Pronunciar Palabra
            </button>
            <button class="btn-audio-pill" onclick="window.ttsService.speak('${selectedWord.phrase.replace(/'/g, "\\'")}')">
              🎧 Pronunciar Frase
            </button>
          </div>

          <!-- Notes -->
          ${selectedWord.notes ? `
            <div style="margin-bottom: 24px;">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">Notas y Gramática</div>
              <div style="font-size: 14px; color: #cbd5e1; background: var(--bg-input); padding: 14px; border-radius: var(--radius-md);">
                ${selectedWord.notes}
              </div>
            </div>
          ` : ''}

          <!-- Metadata & Actions -->
          <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 20px; font-size: 12px; color: var(--text-dim);">
            <div>
              Próximo Repaso: <strong>${nextReviewDate}</strong> • Fallos acumulados: <strong>${selectedWord.failedCount || 0}</strong>
            </div>

            <div style="display: flex; gap: 10px;">
              <button class="btn-secondary" style="font-size: 12px; padding: 6px 12px;" onclick="ExplorerView.openEditWordModal('${selectedWord.id}')">
                ✏️ Editar
              </button>
              <button class="btn-secondary" style="font-size: 12px; padding: 6px 12px;" onclick="ExplorerView.resetWord('${selectedWord.id}')">
                🔄 Reiniciar SRS
              </button>
              <button class="btn-secondary" style="font-size: 12px; padding: 6px 12px; color: var(--error);" onclick="ExplorerView.deleteWord('${selectedWord.id}')">
                🗑️ Eliminar
              </button>
            </div>
          </div>
        </div>
      `;
    }

    html += `
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    const searchInput = document.getElementById('explorer-search');
    if (searchInput) {
      searchInput.oninput = (e) => {
        ExplorerView.searchQuery = e.target.value;
        ExplorerView.applyFilters();
        ExplorerView.renderLayout();
      };
    }
  }

  static selectWord(id) {
    this.selectedWordId = id;
    this.renderLayout();
  }

  static setFilter(f) {
    this.activeFilter = f;
    this.applyFilters();
    this.renderLayout();
  }

  static async resetWord(id) {
    await window.api.resetWordProgress(id);
    window.ModalManager.showToast('Progreso de la palabra reiniciado a Nueva', 'info');
    ExplorerView.render();
  }

  static async deleteWord(id) {
    window.ModalManager.openModal({
      title: '¿Eliminar palabra?',
      bodyHtml: '<p>¿Estás seguro de que deseas eliminar esta palabra del mazo?</p>',
      confirmText: 'Sí, Eliminar',
      onConfirm: async () => {
        await window.api.deleteWord(id);
        window.ModalManager.showToast('Palabra eliminada', 'info');
        ExplorerView.selectedWordId = null;
        ExplorerView.render();
      }
    });
  }

  static addNewWordToThisDeck() {
    window.store.set('activeExplorerDeckId', this.deckId);
    window.app.navigate('creator');
  }

  static async openEditWordModal(wordId) {
    const word = this.words.find(w => w.id === wordId);
    if (!word) return;

    const html = `
      <div class="form-group">
        <label class="form-label">Palabra / Término Objetivo</label>
        <input type="text" id="edit-word-target" class="form-control" value="${word.targetText || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Oración en Contexto</label>
        <textarea id="edit-word-phrase" class="form-control" rows="3">${word.phrase || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Traducción de la Palabra</label>
        <input type="text" id="edit-word-target-tr" class="form-control" value="${word.targetTranslation || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Traducción de la Oración</label>
        <input type="text" id="edit-word-phrase-tr" class="form-control" value="${word.phraseTranslation || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Notas Gramaticales / Fonética</label>
        <textarea id="edit-word-notes" class="form-control" rows="2">${word.notes || ''}</textarea>
      </div>
    `;

    window.ModalManager.openModal({
      title: 'Editar Palabra',
      bodyHtml: html,
      confirmText: 'Guardar Cambios',
      onConfirm: async () => {
        const targetText = document.getElementById('edit-word-target').value.trim();
        const phrase = document.getElementById('edit-word-phrase').value.trim();
        const targetTranslation = document.getElementById('edit-word-target-tr').value.trim();
        const phraseTranslation = document.getElementById('edit-word-phrase-tr').value.trim();
        const notes = document.getElementById('edit-word-notes').value.trim();

        if (!targetText || !phrase) {
          window.ModalManager.showToast('La palabra y la oración son obligatorias', 'error');
          return false;
        }

        const tokens = targetText.split(/\s+/).filter(t => t.length > 0);

        await window.api.updateWord(word.id, {
          targetText,
          phrase,
          targetTokens: tokens,
          targetTranslation,
          phraseTranslation,
          notes
        });

        window.ModalManager.showToast('Palabra actualizada con éxito', 'success');
        ExplorerView.render();
        return true;
      }
    });
  }

  static startMaintenanceQuiz() {
    window.LibraryView.routeStudyFlow([this.deckId], 'maintenance');
  }
}

ExplorerView.init();
window.ExplorerView = ExplorerView;

