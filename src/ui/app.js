// ============================================================================
// Lexispelling V2 - Main Application Controller & View Router
// Unified navigation, state cleanup, AppBar coordinator, and drawer access
// ============================================================================

class App {
  constructor() {
    this.currentViewName = 'library';
  }

  async init() {
    // 1. Initialize Profile Drawer & settings
    window.ProfileDrawer.init();

    // 2. Load User Profile
    const profile = await window.api.getProfile();
    window.store.set('profile', profile);

    if (profile) {
      if (window.soundFeedback) {
        window.soundFeedback.setMuted(!profile.soundEnabled);
      }
      if (window.ttsService) {
        window.ttsService.setSpeechRate(profile.ttsSpeechRate || 0.88);
        window.ttsService.setLanguage(profile.learnLanguageCode || 'en');
      }
    }

    // 3. Attach Top AppBar button handlers
    this.attachHeaderEvents();

    // 4. Navigate to initial view
    this.navigate('library');
  }

  attachHeaderEvents() {
    // Brand title -> Always safely returns to Library
    const brand = document.getElementById('brand-home');
    if (brand) {
      brand.onclick = () => this.exitSessionToLibrary();
    }

    // Exit / Return button in Top AppBar (visible during Quiz, Flashcards, Creator, Explorer, etc.)
    const btnExit = document.getElementById('btn-appbar-exit');
    if (btnExit) {
      btnExit.onclick = () => {
        if (this.currentViewName === 'quiz' && window.QuizView && window.QuizView.confirmExit) {
          window.QuizView.confirmExit();
        } else {
          this.exitSessionToLibrary();
        }
      };
    }

    // Quick New Word Creator Button in AppBar
    const btnCreator = document.getElementById('btn-appbar-creator');
    if (btnCreator) {
      btnCreator.onclick = () => this.navigate('creator');
    }

    // Bar Chart icon -> Dashboard
    const btnChart = document.getElementById('btn-dashboard-nav');
    if (btnChart) {
      btnChart.onclick = () => this.navigate('dashboard');
    }

    // Sync button -> Fast reload
    const btnSync = document.getElementById('btn-sync');
    if (btnSync) {
      btnSync.onclick = () => {
        window.ModalManager.showToast('Datos sincronizados localmente', 'success');
        this.refreshCurrentView();
      };
    }

    // Top Right Menu [...] Dropdown
    const btnMore = document.getElementById('btn-top-menu');
    const menuDropdown = document.getElementById('top-menu-dropdown');

    if (btnMore && menuDropdown) {
      btnMore.onclick = (e) => {
        e.stopPropagation();
        menuDropdown.classList.toggle('show');
      };

      window.addEventListener('click', () => {
        menuDropdown.classList.remove('show');
      });

      // Import Excel/CSV
      const optImport = document.getElementById('menu-opt-import');
      if (optImport) {
        optImport.onclick = async () => {
          menuDropdown.classList.remove('show');
          const res = await window.api.importFilePrompt();
          if (res) {
            if (res.success) {
              window.ModalManager.showToast(
                `Importación completada: ${res.importedCount} palabras importadas, ${res.createdDecksCount} mazos creados (${res.skippedCount} omitidas/duplicadas)`,
                'success',
                5000
              );
              this.refreshCurrentView();
            } else {
              window.ModalManager.showToast('Error en importación: ' + res.error, 'error');
            }
          }
        };
      }

      // Export All CSV
      const optExportCsv = document.getElementById('menu-opt-export-csv');
      if (optExportCsv) {
        optExportCsv.onclick = async () => {
          menuDropdown.classList.remove('show');
          const res = await window.api.exportFilePrompt([], 'csv');
          if (res && res.success) {
            window.ModalManager.showToast('Todos los mazos exportados a CSV', 'success');
          }
        };
      }

      // Export All XLSX
      const optExportXlsx = document.getElementById('menu-opt-export-xlsx');
      if (optExportXlsx) {
        optExportXlsx.onclick = async () => {
          menuDropdown.classList.remove('show');
          const res = await window.api.exportFilePrompt([], 'xlsx');
          if (res && res.success) {
            window.ModalManager.showToast('Todos los mazos exportados a Excel (XLSX)', 'success');
          }
        };
      }
    }
  }

  /**
   * Immediate, non-blocking exit that terminates active evaluations/flashcards,
   * stops active timers, detaches keyboard listeners, and returns to Library.
   */
  exitSessionToLibrary() {
    if (this.currentViewName === 'quiz' && window.QuizView && window.QuizView.destroy) {
      window.QuizView.destroy();
    }
    if (this.currentViewName === 'flashcards' && window.FlashcardsView && window.FlashcardsView.destroy) {
      window.FlashcardsView.destroy();
    }
    if (window.activeTimer) {
      window.activeTimer.stop();
    }

    const wasInStudy = this.currentViewName === 'quiz' || this.currentViewName === 'flashcards';
    window.store.set('studySession', null);
    this.navigate('library');

    if (wasInStudy) {
      window.ModalManager.showToast('Sesión de estudio cerrada. Has vuelto a la Biblioteca.', 'info');
    }
  }

  updateAppBar(viewName) {
    const btnExit = document.getElementById('btn-appbar-exit');
    const btnCreator = document.getElementById('btn-appbar-creator');
    const badge = document.getElementById('appbar-context-badge');

    if (!btnExit || !btnCreator || !badge) return;

    if (viewName === 'library') {
      btnExit.style.display = 'none';
      btnCreator.style.display = 'inline-flex';
      badge.style.display = 'none';
    } else if (viewName === 'quiz') {
      btnExit.style.display = 'inline-flex';
      btnExit.textContent = '✕ Salir del Quiz';
      btnCreator.style.display = 'none';
      badge.style.display = 'inline-flex';
      badge.className = 'badge badge-0';
      badge.textContent = 'Quiz Activo';
    } else if (viewName === 'flashcards') {
      btnExit.style.display = 'inline-flex';
      btnExit.textContent = '✕ Salir de Flashcards';
      btnCreator.style.display = 'none';
      badge.style.display = 'inline-flex';
      badge.className = 'badge badge-new';
      badge.textContent = 'Flashcards 3D';
    } else if (viewName === 'explorer') {
      btnExit.style.display = 'inline-flex';
      btnExit.textContent = '← Volver a Biblioteca';
      btnCreator.style.display = 'inline-flex';
      badge.style.display = 'inline-flex';
      badge.className = 'badge badge-2';
      badge.textContent = 'Explorador';
    } else if (viewName === 'creator') {
      btnExit.style.display = 'inline-flex';
      btnExit.textContent = '← Volver a Biblioteca';
      btnCreator.style.display = 'none';
      badge.style.display = 'inline-flex';
      badge.className = 'badge badge-1';
      badge.textContent = 'Laboratorio';
    } else if (viewName === 'dashboard') {
      btnExit.style.display = 'inline-flex';
      btnExit.textContent = '← Volver a Biblioteca';
      btnCreator.style.display = 'inline-flex';
      badge.style.display = 'inline-flex';
      badge.className = 'badge badge-3';
      badge.textContent = 'Dashboard';
    } else if (viewName === 'report') {
      btnExit.style.display = 'inline-flex';
      btnExit.textContent = '← Volver a Biblioteca';
      btnCreator.style.display = 'inline-flex';
      badge.style.display = 'inline-flex';
      badge.className = 'badge badge-4';
      badge.textContent = 'Informe Final';
    }
  }

  async openExplorerDefault() {
    let decks = window.store.get('decks');
    if (!decks || decks.length === 0) {
      if (window.api && window.api.getDecks) {
        decks = await window.api.getDecks();
        window.store.set('decks', decks);
      }
    }
    const targetDeckId = (decks && decks.length > 0) ? decks[0].id : null;
    if (targetDeckId) {
      window.store.set('activeExplorerDeckId', targetDeckId);
      this.navigate('explorer');
    } else {
      window.ModalManager.showToast('No hay mazos creados todavía. Crea uno primero.', 'info');
      this.navigate('library');
    }
  }

  navigate(viewName, params = null) {
    try {
      // Clean up previous view hooks & listeners
      if (this.currentViewName === 'quiz' && window.QuizView && window.QuizView.destroy) {
        window.QuizView.destroy();
      }
      if (this.currentViewName === 'flashcards' && window.FlashcardsView && window.FlashcardsView.destroy) {
        window.FlashcardsView.destroy();
      }
      if (viewName !== 'quiz' && viewName !== 'flashcards' && window.activeTimer) {
        window.activeTimer.stop();
      }

      this.currentViewName = viewName;
      window.store.set('currentView', viewName);

      // Update Top AppBar controls
      this.updateAppBar(viewName);

      // Hide all view panels
      document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.remove('active');
      });

      const targetPanel = document.getElementById(`view-${viewName}`);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }

      // Call render/mount on corresponding view controller
      switch (viewName) {
        case 'library':
          window.LibraryView.render();
          break;
        case 'flashcards':
          window.FlashcardsView.render();
          break;
        case 'quiz':
          window.QuizView.mount(params);
          break;
        case 'report':
          window.ReportView.render();
          break;
        case 'creator':
          window.CreatorView.render();
          break;
        case 'explorer':
          window.ExplorerView.render();
          break;
        case 'dashboard':
          window.DashboardView.render();
          break;
        default:
          console.warn(`View "${viewName}" not found.`);
      }
    } catch (err) {
      console.error(`Error navigating to view "${viewName}":`, err);
      window.ModalManager.showToast(`Error al abrir vista: ${err.message}`, 'error');
    }
  }

  refreshCurrentView() {
    this.navigate(this.currentViewName);
  }

  async openCreateDeckModal(onCreated = null) {
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
      cancelText: 'Cancelar',
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
        const newDeck = {
          id,
          name,
          description: descInput ? descInput.value.trim() : '',
          color: colorInput ? colorInput.value : '#6366f1'
        };

        if (window.api && window.api.createDeck) {
          await window.api.createDeck(newDeck);
        }

        // Refresh global decks store
        if (window.api && window.api.getDecks) {
          const updatedDecks = await window.api.getDecks();
          window.store.set('decks', updatedDecks);
        }

        window.ModalManager.showToast(`Mazo "${name}" creado con éxito`, 'success');

        if (typeof onCreated === 'function') {
          await onCreated(newDeck);
        } else if (this.currentViewName === 'library' && window.LibraryView) {
          window.LibraryView.render();
        } else if (this.currentViewName === 'creator' && window.CreatorView) {
          await window.CreatorView.reloadDecks(newDeck.id);
        }

        return true;
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});
