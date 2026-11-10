// ============================================================================
// Lexispelling V2 - Library View (Biblioteca) & Community Decks
// ============================================================================

class LibraryView {
  static init() {
    this.activeTab = 'my-decks'; // 'my-decks' | 'community'
    this.communitySearch = '';
  }

  static async render() {
    const container = document.getElementById('view-library');
    if (!container) return;

    const decks = await window.api.getDecks();
    window.store.set('decks', decks);
    const selectedIds = window.store.get('selectedDeckIds') || new Set();

    let html = `
      <div class="library-container" id="library-drop-zone">
        <!-- Toolbar & Segmented Tabs -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; margin-bottom: 24px;">
          <div class="tabs-segmented" style="margin-bottom: 0;">
            <button class="tab-btn ${this.activeTab === 'my-decks' ? 'active' : ''}" id="tab-my-decks" onclick="LibraryView.switchTab('my-decks')">
              Mis Mazos
            </button>
            <button class="tab-btn ${this.activeTab === 'community' ? 'active' : ''}" id="tab-community" onclick="LibraryView.switchTab('community')">
              Comunidad (Explorador Público)
            </button>
          </div>

          <div style="display: flex; gap: 10px;">
            <button class="btn-secondary" onclick="window.app.navigate('dashboard')" title="Ver métricas y curva de retención SRS">
              📊 Métricas
            </button>
            <button class="btn-secondary" onclick="LibraryView.openCreateDeckModal()" title="Crear un nuevo mazo de tarjetas">
              + Nuevo Mazo
            </button>
            <button class="btn-primary" onclick="window.app.navigate('creator')" title="Abrir Laboratorio de Creación">
              + Crear Palabra
            </button>
          </div>
        </div>
    `;

    if (this.activeTab === 'my-decks') {
      html += LibraryView.renderMyDecksTab(decks, selectedIds);
    } else {
      html += LibraryView.renderCommunityTab();
    }

    html += `
      </div>

      <!-- Floating Action Button (FAB) -->
      <div class="fab-container">
        <button class="fab-extended" id="fab-main-action">
          ${selectedIds.size > 0 ? `⚡ Estudiar Selección (${LibraryView.calculateSelectedDueCount(decks, selectedIds)})` : '+ Crear Palabra'}
        </button>
      </div>
    `;

    container.innerHTML = html;
    LibraryView.attachEvents(decks);
    LibraryView.setupDragAndDrop();
  }

  static switchTab(tab) {
    this.activeTab = tab;
    this.render();
  }

  static renderMyDecksTab(decks, selectedIds) {
    let html = `<div class="decks-grid" id="decks-grid-container">`;

    if (decks.length === 0) {
      html += `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <h3>No tienes ningún mazo todavía</h3>
          <p style="margin-top: 8px; font-size: 14px;">Crea tu primer mazo o arrastra un archivo CSV / Excel aquí.</p>
          <button class="btn-primary" style="margin-top: 20px;" onclick="LibraryView.openCreateDeckModal()">+ Crear Nuevo Mazo</button>
        </div>
      `;
    } else {
      decks.forEach(deck => {
        const isSelected = selectedIds.has(deck.id);
        const isPaused = !deck.isActive;
        const total = deck.totalWords || 0;
        const mastered = deck.masteredWords || 0;
        const due = deck.dueWords || 0;
        const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;

        html += `
          <div class="deck-card ${isSelected ? 'selected' : ''} ${isPaused ? 'paused' : ''}" data-deck-id="${deck.id}">
            <div class="deck-card-header">
              <div class="deck-info">
                <div class="deck-color-icon" style="background: ${deck.color || '#4f46e5'}">
                  ${deck.name ? deck.name.charAt(0).toUpperCase() : 'M'}
                </div>
                <div class="deck-meta">
                  <div class="deck-title">${deck.name} ${isPaused ? '<span class="badge badge-0">Desactivado</span>' : ''}</div>
                  <div class="deck-subtitle">${total} palabras • ${mastered} dominadas</div>
                </div>
              </div>
              <div class="deck-check-wrap">
                <input type="checkbox" class="deck-checkbox" data-id="${deck.id}" ${isSelected ? 'checked' : ''} title="Seleccionar para estudio múltiple" />
                <button class="btn-icon btn-deck-menu" data-id="${deck.id}" title="Opciones">⋮</button>
              </div>
            </div>

            <p class="deck-description">${deck.description || 'Sin descripción adicional.'}</p>

            <div class="mastery-progress-section">
              <div class="progress-labels">
                <span>Dominio</span>
                <span>${pct}% (${mastered}/${total})</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width: ${pct}%"></div>
              </div>
            </div>

            <div class="deck-card-actions">
              <button class="btn-secondary" style="padding: 10px 14px;" onclick="LibraryView.openExplorer('${deck.id}')" title="Explorar palabras">
                🔍 Explorar
              </button>
              ${due > 0 && !isPaused ? `
                <button class="btn-study-action pending" onclick="LibraryView.startStudySingle('${deck.id}')">
                  Estudiar (${due})
                </button>
              ` : `
                <button class="btn-study-action neutral" onclick="LibraryView.openExplorer('${deck.id}')">
                  Ver palabras (${total})
                </button>
              `}
            </div>
          </div>
        `;
      });
    }

    html += `</div>`;
    return html;
  }

  static renderCommunityTab() {
    // Curated community starter decks available for 1-click adoption
    const communityDecks = [
      {
        id: 'comm_b2_idioms',
        name: 'Cambridge B2 First: Key Idioms',
        author: 'Lexis Editorial',
        description: 'Modismos esenciales en contexto real con alta frecuencia de aparición en exámenes.',
        color: '#0ea5e9',
        wordsCount: 25,
        level: 'B2',
        sample: 'A piece of cake, break a leg, bite the bullet...'
      },
      {
        id: 'comm_c1_business',
        name: 'C1 Business English Collocations',
        author: 'Prof. Richard Miller',
        description: 'Colocaciones formales para reuniones corporativas, negociaciones y reportes ejecutivos.',
        color: '#10b981',
        wordsCount: 30,
        level: 'C1',
        sample: 'Reach consensus, draw conclusions, streamline operations...'
      },
      {
        id: 'comm_daily_travel',
        name: 'Travel & Everyday Problem Solving',
        author: 'Community Hub',
        description: 'Frases indispensables para resolver situaciones en aeropuertos, hoteles y emergencias.',
        color: '#f59e0b',
        wordsCount: 20,
        level: 'A2-B1',
        sample: 'Boarding pass, lost baggage, exchange currency...'
      }
    ];

    let filtered = communityDecks;
    if (this.communitySearch) {
      const q = this.communitySearch.toLowerCase();
      filtered = communityDecks.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.level.toLowerCase().includes(q)
      );
    }

    let html = `
      <div style="margin-bottom: 24px;">
        <input type="text" id="community-search-input" class="form-control" style="max-width: 480px; font-size: 14px;" 
          placeholder="Buscar mazos públicos por título, nivel o descripción..." value="${this.communitySearch}" />
      </div>

      <div class="decks-grid">
    `;

    filtered.forEach(cd => {
      html += `
        <div class="deck-card">
          <div class="deck-card-header">
            <div class="deck-info">
              <div class="deck-color-icon" style="background: ${cd.color}">
                ${cd.name.charAt(0)}
              </div>
              <div class="deck-meta">
                <div class="deck-title">${cd.name}</div>
                <div class="deck-subtitle">Por ${cd.author} • <span class="badge badge-1">${cd.level}</span></div>
              </div>
            </div>
          </div>

          <p class="deck-description">${cd.description}</p>
          <div style="font-size: 12px; color: var(--text-dim); margin-bottom: 16px;">
            Muestras: <em>${cd.sample}</em>
          </div>

          <div class="deck-card-actions">
            <button class="btn-primary" style="width: 100%;" onclick="LibraryView.adoptCommunityDeck('${cd.id}')">
              📥 Adoptar Mazo (${cd.wordsCount} palabras)
            </button>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    return html;
  }

  static async adoptCommunityDeck(commDeckId) {
    const samples = {
      comm_b2_idioms: {
        name: 'Cambridge B2 First: Key Idioms',
        desc: 'Modismos esenciales en contexto real con alta frecuencia de examen.',
        color: '#0ea5e9',
        words: [
          {
            phrase: 'Passing the driving test was a piece of cake for him.',
            tokens: ['piece', 'cake'],
            target: 'piece of cake',
            targetTr: 'pan comido / muy fácil',
            phraseTr: 'Aprobar el examen de conducir fue pan comido para él.',
            notes: '**A piece of cake**: Expresión informal que denota gran facilidad.'
          },
          {
            phrase: 'We must bite the bullet and finish this difficult task today.',
            tokens: ['bite', 'bullet'],
            target: 'bite the bullet',
            targetTr: 'hacer de tripas corazón / aguantarse',
            phraseTr: 'Debemos hacer de tripas corazón y terminar esta difícil tarea hoy.',
            notes: 'Afrontar una situación inevitable con valentía.'
          },
          {
            phrase: 'He was feeling under the weather so he stayed in bed.',
            tokens: ['under', 'weather'],
            target: 'under the weather',
            targetTr: 'indispuesto / enfermo',
            phraseTr: 'Se sentía indispuesto, así que se quedó en cama.',
            notes: 'Uso muy común en conversaciones cotidianas británicas.'
          }
        ]
      },
      comm_c1_business: {
        name: 'C1 Business English Collocations',
        desc: 'Colocaciones formales de negocios y negociación.',
        color: '#10b981',
        words: [
          {
            phrase: 'The committee failed to reach consensus on the new budget.',
            tokens: ['reach', 'consensus'],
            target: 'reach consensus',
            targetTr: 'llegar a un consenso',
            phraseTr: 'El comité no logró llegar a un consenso sobre el nuevo presupuesto.',
            notes: 'Colocación formal con verbo *reach*.'
          },
          {
            phrase: 'We need to streamline operations to minimize operational costs.',
            tokens: ['streamline', 'operations'],
            target: 'streamline operations',
            targetTr: 'optimizar / simplificar operaciones',
            phraseTr: 'Necesitamos optimizar las operaciones para minimizar los costes.',
            notes: '**Streamline**: Hacer los procesos más eficientes y fluidos.'
          }
        ]
      },
      comm_daily_travel: {
        name: 'Travel & Everyday Problem Solving',
        desc: 'Frases clave para situaciones de viaje y emergencias.',
        color: '#f59e0b',
        words: [
          {
            phrase: 'Please present your boarding pass at gate number four.',
            tokens: ['boarding', 'pass'],
            target: 'boarding pass',
            targetTr: 'tarjeta de embarque',
            phraseTr: 'Por favor, presente su tarjeta de embarque en la puerta número cuatro.',
            notes: 'Documento indispensable para abordar vuelos.'
          },
          {
            phrase: 'I went to the service counter to report my lost baggage.',
            tokens: ['lost', 'baggage'],
            target: 'lost baggage',
            targetTr: 'equipaje extraviado',
            phraseTr: 'Fui al mostrador de atención para reportar mi equipaje extraviado.',
            notes: '*Baggage* es un sustantivo incontable.'
          }
        ]
      }
    };

    const template = samples[commDeckId];
    if (!template) return;

    const newDeckId = 'deck_' + Date.now();
    await window.api.createDeck({
      id: newDeckId,
      name: template.name,
      description: template.desc,
      color: template.color
    });

    for (let i = 0; i < template.words.length; i++) {
      const w = template.words[i];
      await window.api.createWord({
        id: `w_adopt_${Date.now()}_${i}`,
        deckId: newDeckId,
        phrase: w.phrase,
        targetTokens: w.tokens,
        targetText: w.target,
        notes: w.notes,
        targetTranslation: w.targetTr,
        phraseTranslation: w.phraseTr
      });
    }

    window.ModalManager.showToast(`Mazo "${template.name}" adoptado con éxito`, 'success');
    this.activeTab = 'my-decks';
    this.render();
  }

  static calculateSelectedDueCount(decks, selectedIds) {
    let total = 0;
    decks.forEach(d => {
      if (selectedIds.has(d.id)) {
        total += (d.dueWords || 0);
      }
    });
    return total;
  }

  static attachEvents(decks) {
    // Checkboxes
    document.querySelectorAll('.deck-checkbox').forEach(cb => {
      cb.onchange = (e) => {
        const id = e.target.getAttribute('data-id');
        window.store.toggleDeckSelection(id);
        LibraryView.render();
      };
    });

    // Deck contextual menu
    document.querySelectorAll('.btn-deck-menu').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const deck = decks.find(d => d.id === id);
        if (deck) LibraryView.showDeckContextMenu(deck, btn);
      };
    });

    // FAB Action
    const fab = document.getElementById('fab-main-action');
    if (fab) {
      fab.onclick = () => {
        const selectedIds = window.store.get('selectedDeckIds') || new Set();
        if (selectedIds.size > 0) {
          LibraryView.startStudyBatch([...selectedIds]);
        } else {
          window.app.navigate('creator');
        }
      };
    }

    // Community search input
    const commSearch = document.getElementById('community-search-input');
    if (commSearch) {
      commSearch.oninput = (e) => {
        LibraryView.communitySearch = e.target.value;
        LibraryView.render();
      };
    }
  }

  static setupDragAndDrop() {
    const dropZone = document.getElementById('library-drop-zone');
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.outline = '2px dashed var(--primary)';
        dropZone.style.outlineOffset = '-10px';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.outline = 'none';
      }, false);
    });
  }

  static showDeckContextMenu(deck, targetBtn) {
    const isPaused = !deck.isActive;
    const items = [
      {
        label: isPaused ? '▶ Reactivar Mazo' : '⏸ Pausar / Desactivar',
        action: async () => {
          await window.api.setDeckActive(deck.id, isPaused);
          window.ModalManager.showToast(isPaused ? 'Mazo reactivado' : 'Mazo pausado y SRS reiniciado', 'info');
          LibraryView.render();
        }
      },
      {
        label: '✏️ Editar Mazo',
        action: () => LibraryView.openEditDeckModal(deck)
      },
      {
        label: '📤 Exportar CSV',
        action: async () => {
          const res = await window.api.exportFilePrompt([deck.id], 'csv');
          if (res && res.success) {
            window.ModalManager.showToast('Mazo exportado a CSV con éxito', 'success');
          }
        }
      },
      {
        label: '📊 Exportar XLSX (Excel)',
        action: async () => {
          const res = await window.api.exportFilePrompt([deck.id], 'xlsx');
          if (res && res.success) {
            window.ModalManager.showToast('Mazo exportado a Excel con éxito', 'success');
          }
        }
      },
      {
        label: '🗑️ Eliminar Mazo',
        danger: true,
        action: () => {
          window.ModalManager.openModal({
            title: '¿Eliminar mazo?',
            bodyHtml: `<p>¿Estás seguro de que deseas eliminar permanentemente el mazo <strong>"${deck.name}"</strong> y todas sus palabras asociadas?</p>`,
            confirmText: 'Sí, Eliminar',
            onConfirm: async () => {
              await window.api.deleteDeck(deck.id);
              window.ModalManager.showToast('Mazo eliminado', 'info');
              LibraryView.render();
            }
          });
        }
      }
    ];

    let menuHtml = `<div style="display: flex; flex-direction: column; gap: 8px;">`;
    items.forEach((item, idx) => {
      menuHtml += `
        <button class="btn-secondary" style="justify-content: flex-start; ${item.danger ? 'color: var(--error);' : ''}" id="ctx-item-${idx}">
          ${item.label}
        </button>
      `;
    });
    menuHtml += `</div>`;

    window.ModalManager.openModal({
      title: deck.name,
      bodyHtml: menuHtml,
      confirmText: 'Cerrar',
      onConfirm: () => true
    });

    items.forEach((item, idx) => {
      const el = document.getElementById(`ctx-item-${idx}`);
      if (el) {
        el.onclick = () => {
          window.ModalManager.closeModal();
          item.action();
        };
      }
    });
  }

  static openCreateDeckModal() {
    const html = `
      <div class="form-group">
        <label class="form-label">Nombre del Mazo</label>
        <input type="text" id="new-deck-name" class="form-control" placeholder="Ej: C1 Advanced Expressions" autofocus />
      </div>
      <div class="form-group">
        <label class="form-label">Descripción</label>
        <textarea id="new-deck-desc" class="form-control" rows="3" placeholder="Propósito u objetivo de este mazo..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Color Distintivo</label>
        <input type="color" id="new-deck-color" value="#6366f1" style="width: 100%; height: 38px; border: none; border-radius: 6px; cursor: pointer;" />
      </div>
    `;

    window.ModalManager.openModal({
      title: 'Crear Nuevo Mazo',
      bodyHtml: html,
      confirmText: 'Crear Mazo',
      onConfirm: async () => {
        const nameInput = document.getElementById('new-deck-name');
        const descInput = document.getElementById('new-deck-desc');
        const colorInput = document.getElementById('new-deck-color');

        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
          window.ModalManager.showToast('El nombre del mazo es obligatorio', 'error');
          return false;
        }

        const id = 'deck_' + Date.now();
        await window.api.createDeck({
          id,
          name,
          description: descInput ? descInput.value.trim() : '',
          color: colorInput ? colorInput.value : '#6366f1'
        });

        window.ModalManager.showToast('Mazo creado con éxito', 'success');
        LibraryView.render();
        return true;
      }
    });
  }

  static openEditDeckModal(deck) {
    const html = `
      <div class="form-group">
        <label class="form-label">Nombre del Mazo</label>
        <input type="text" id="edit-deck-name" class="form-control" value="${deck.name}" />
      </div>
      <div class="form-group">
        <label class="form-label">Descripción</label>
        <textarea id="edit-deck-desc" class="form-control" rows="3">${deck.description || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Color Distintivo</label>
        <input type="color" id="edit-deck-color" value="${deck.color || '#6366f1'}" style="width: 100%; height: 38px; border: none; border-radius: 6px; cursor: pointer;" />
      </div>
    `;

    window.ModalManager.openModal({
      title: 'Editar Mazo',
      bodyHtml: html,
      confirmText: 'Guardar Cambios',
      onConfirm: async () => {
        const name = document.getElementById('edit-deck-name').value.trim();
        const description = document.getElementById('edit-deck-desc').value.trim();
        const color = document.getElementById('edit-deck-color').value;

        if (!name) return false;

        await window.api.updateDeck(deck.id, { name, description, color });
        window.ModalManager.showToast('Mazo actualizado', 'success');
        LibraryView.render();
        return true;
      }
    });
  }

  static openExplorer(deckId) {
    window.store.set('activeExplorerDeckId', deckId);
    window.app.navigate('explorer');
  }

  // --- Study Gateway (EstudioScreen / Compuerta de Estudio) ---
  static async startStudySingle(deckId) {
    LibraryView.routeStudyFlow([deckId], 'normal');
  }

  static async startStudyBatch(deckIds) {
    LibraryView.routeStudyFlow(deckIds, 'normal');
  }

  static async routeStudyFlow(deckIds, mode = 'normal') {
    const words = await window.api.getWordsForStudy(deckIds, mode);

    if (words.length === 0) {
      window.ModalManager.showToast('No hay palabras pendientes para estudiar hoy en los mazos seleccionados', 'info');
      return;
    }

    const preSessionLevelMap = {};
    words.forEach(w => {
      preSessionLevelMap[w.id] = w.level;
    });

    const decks = window.store.get('decks') || [];
    const deckNames = deckIds.map(id => {
      const d = decks.find(x => x.id === id);
      return d ? d.name : 'Mazo';
    });

    const onlyNewWords = words.every(w => Boolean(w.isNew));

    window.store.set('studySession', {
      mode,
      deckIds,
      deckNames,
      words,
      currentIndex: 0,
      stashedSuccesses: [],
      round1Failures: [],
      currentFailures: [],
      sessionResults: [],
      startTime: Date.now(),
      isReQuiz: false,
      preSessionLevelMap
    });

    if (onlyNewWords) {
      // Flowchart: Solo hay palabras NUEVAS -> Sesión de FLASHCARDS primero!
      window.app.navigate('flashcards');
    } else {
      // Flowchart: Hay palabras de repaso -> Sesión de QUIZ directamente!
      window.app.navigate('quiz');
    }
  }
}

LibraryView.init();
window.LibraryView = LibraryView;
