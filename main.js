// ============================================================================
// Lexispelling V2 - Electron Main Process
// Native performance, secure contextBridge, IPC communication
// ============================================================================

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DatabaseManager = require('./src/database/db');
const Repository = require('./src/database/repository');
const ImportExportService = require('./src/services/importExport');
const { SrsEngine } = require('./src/engine/srs');

let mainWindow = null;
let dbManager = null;
let repository = null;
let importExportService = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 840,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#090d16',
    title: 'Lexispelling V2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    },
    autoHideMenuBar: true,
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'src/ui/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

function registerIpcHandlers() {
  // --- Decks ---
  ipcMain.handle('decks:getAll', () => repository.getAllDecks());
  ipcMain.handle('decks:getById', (_, id) => repository.getDeckById(id));
  ipcMain.handle('decks:create', (_, deck) => repository.createDeck(deck));
  ipcMain.handle('decks:update', (_, id, updates) => repository.updateDeck(id, updates));
  ipcMain.handle('decks:setActive', (_, id, isActive) => repository.setDeckActive(id, isActive));
  ipcMain.handle('decks:delete', (_, id) => repository.deleteDeck(id));

  // --- Words ---
  ipcMain.handle('words:getByDeck', (_, deckId) => repository.getWordsByDeckId(deckId));
  ipcMain.handle('words:getById', (_, id) => repository.getWordById(id));
  ipcMain.handle('words:create', (_, word) => repository.createWord(word));
  ipcMain.handle('words:update', (_, id, updates) => repository.updateWord(id, updates));
  ipcMain.handle('words:delete', (_, id) => repository.deleteWord(id));
  ipcMain.handle('words:resetProgress', (_, id) => repository.resetWordProgress(id));
  ipcMain.handle('words:getForStudy', (_, deckIds, mode) => repository.getWordsForStudy(deckIds, mode));
  ipcMain.handle('words:getAllInDecks', (_, deckIds) => repository.getAllWordsInDecks(deckIds));

  // Word SRS Outcome evaluation
  ipcMain.handle('words:updateOutcome', (_, { wordId, success, isReQuiz, preSessionLevel }) => {
    const word = repository.getWordById(wordId);
    if (!word) return null;
    const updates = SrsEngine.evaluateOutcome(word, success, isReQuiz, preSessionLevel);
    return repository.updateWord(wordId, updates);
  });

  // --- Profile ---
  ipcMain.handle('profile:get', () => repository.getProfile());
  ipcMain.handle('profile:update', (_, updates) => repository.updateProfile(updates));

  // --- Stats & History ---
  ipcMain.handle('stats:getDaily', (_, dateStr) => repository.getDailyStats(dateStr));
  ipcMain.handle('stats:recordTime', (_, type, minutes) => repository.recordActiveTime(type, minutes));
  ipcMain.handle('stats:recordEvaluation', (_, evaluated, failed) => repository.recordEvaluationCounts(evaluated, failed));
  ipcMain.handle('stats:getPast7Days', () => repository.getPast7DaysStats());
  ipcMain.handle('stats:getOverallMetrics', () => repository.getOverallSRSMetrics());
  ipcMain.handle('history:saveQuiz', (_, result) => repository.saveQuizResult(result));
  ipcMain.handle('history:getRecent', (_, limit) => repository.getRecentHistory(limit));

  // --- Import / Export ---
  ipcMain.handle('files:importPath', async (_, filePath) => {
    try {
      const summary = importExportService.importFile(filePath);
      return { success: true, ...summary };
    } catch (err) {
      console.error('Import error for path:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('files:importDialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar lista de palabras (Excel o CSV)',
      filters: [
        { name: 'Archivos compatibles (*.csv, *.xlsx, *.xls)', extensions: ['csv', 'xlsx', 'xls'] },
        { name: 'CSV (*.csv)', extensions: ['csv'] },
        { name: 'Excel (*.xlsx, *.xls)', extensions: ['xlsx', 'xls'] }
      ],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) return null;
    try {
      const summary = importExportService.importFile(filePaths[0]);
      return { success: true, ...summary };
    } catch (err) {
      console.error('Import error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('files:exportDialog', async (_, deckIds, format = 'csv') => {
    const ext = format === 'xlsx' ? 'xlsx' : 'csv';
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: `Exportar mazo(s) a ${format.toUpperCase()}`,
      defaultPath: `Lexispelling_Export_${Date.now()}.${ext}`,
      filters: [{ name: format.toUpperCase(), extensions: [ext] }]
    });

    if (canceled || !filePath) return null;
    try {
      const bufferOrStr = importExportService.exportData(deckIds, format);
      fs.writeFileSync(filePath, bufferOrStr);
      return { success: true, filePath };
    } catch (err) {
      console.error('Export error:', err);
      return { success: false, error: err.message };
    }
  });
}

app.whenReady().then(() => {
  dbManager = new DatabaseManager();
  repository = new Repository(dbManager);
  importExportService = new ImportExportService(repository);

  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (dbManager) dbManager.close();
  if (process.platform !== 'darwin') app.quit();
});

