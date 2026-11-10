// ============================================================================
// Lexispelling V2 - Preload Script
// Secure context isolation bridge exposing sanitized IPC methods
// ============================================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Decks
  getDecks: () => ipcRenderer.invoke('decks:getAll'),
  getDeck: (id) => ipcRenderer.invoke('decks:getById', id),
  createDeck: (deck) => ipcRenderer.invoke('decks:create', deck),
  updateDeck: (id, updates) => ipcRenderer.invoke('decks:update', id, updates),
  setDeckActive: (id, isActive) => ipcRenderer.invoke('decks:setActive', id, isActive),
  deleteDeck: (id) => ipcRenderer.invoke('decks:delete', id),

  // Words
  getWordsByDeck: (deckId) => ipcRenderer.invoke('words:getByDeck', deckId),
  getWord: (id) => ipcRenderer.invoke('words:getById', id),
  createWord: (word) => ipcRenderer.invoke('words:create', word),
  updateWord: (id, updates) => ipcRenderer.invoke('words:update', id, updates),
  deleteWord: (id) => ipcRenderer.invoke('words:delete', id),
  resetWordProgress: (id) => ipcRenderer.invoke('words:resetProgress', id),
  getWordsForStudy: (deckIds, mode) => ipcRenderer.invoke('words:getForStudy', deckIds, mode),
  getAllWordsInDecks: (deckIds) => ipcRenderer.invoke('words:getAllInDecks', deckIds),
  updateWordOutcome: (params) => ipcRenderer.invoke('words:updateOutcome', params),

  // Profile
  getProfile: () => ipcRenderer.invoke('profile:get'),
  updateProfile: (updates) => ipcRenderer.invoke('profile:update', updates),

  // Stats & History
  getDailyStats: (dateStr) => ipcRenderer.invoke('stats:getDaily', dateStr),
  recordActiveTime: (type, minutes) => ipcRenderer.invoke('stats:recordTime', type, minutes),
  recordEvaluation: (evaluated, failed) => ipcRenderer.invoke('stats:recordEvaluation', evaluated, failed),
  getPast7DaysStats: () => ipcRenderer.invoke('stats:getPast7Days'),
  getOverallMetrics: () => ipcRenderer.invoke('stats:getOverallMetrics'),
  saveQuizResult: (result) => ipcRenderer.invoke('history:saveQuiz', result),
  getRecentHistory: (limit) => ipcRenderer.invoke('history:getRecent', limit),

  // Files Import & Export
  importFilePrompt: () => ipcRenderer.invoke('files:importDialog'),
  importFilePath: (filePath) => ipcRenderer.invoke('files:importPath', filePath),
  exportFilePrompt: (deckIds, format) => ipcRenderer.invoke('files:exportDialog', deckIds, format)
});

