// ============================================================================
// Lexispelling V2 - Reactive Store (Pub/Sub)
// Ultra-lightweight state manager without bloated frameworks
// ============================================================================

class Store {
  constructor() {
    this.state = {
      currentView: 'library', // library, flashcards, quiz, report, creator, explorer, dashboard
      decks: [],
      selectedDeckIds: new Set(),
      activeExplorerDeckId: null,
      profile: null,
      
      // Active study / quiz session state
      studySession: {
        mode: 'normal', // 'normal' | 'maintenance' | 'requiz'
        deckIds: [],
        deckNames: [],
        words: [],
        currentIndex: 0,
        stashedSuccesses: [], // words passed in round 1
        round1Failures: [],   // words failed in round 1
        currentFailures: [],  // failures in current round
        sessionResults: [],   // final list of word performance records
        startTime: null,
        isReQuiz: false,
        preSessionLevelMap: {} // wordId -> preSessionLevel
      }
    };

    this.listeners = new Map();
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    this.state[key] = value;
    this.emit(key, value);
  }

  update(key, fn) {
    this.state[key] = fn(this.state[key]);
    this.emit(key, this.state[key]);
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => this.listeners.get(key).delete(callback);
  }

  emit(key, data) {
    if (this.listeners.has(key)) {
      for (const cb of this.listeners.get(key)) {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in store listener for "${key}":`, err);
        }
      }
    }
  }

  // --- Deck selection helpers ---
  toggleDeckSelection(deckId) {
    const s = new Set(this.state.selectedDeckIds);
    if (s.has(deckId)) {
      s.delete(deckId);
    } else {
      s.add(deckId);
    }
    this.set('selectedDeckIds', s);
  }

  clearDeckSelection() {
    this.set('selectedDeckIds', new Set());
  }
}

window.store = new Store();

