// ============================================================================
// Lexispelling V2 - Import & Export Service
// Handles Excel (.xlsx) and CSV with auto delimiter detection, BOM cleaning,
// canonical header mapping, deck auto-creation, and deduplication
// ============================================================================

const fs = require('node:fs');
const xlsx = require('xlsx');

class ImportExportService {
  constructor(repository) {
    this.repo = repository;
  }

  static normalizeText(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  static detectCsvDelimiter(text) {
    const firstLine = text.split(/\r?\n/)[0] || '';
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    if (semiCount > commaCount && semiCount > tabCount) return ';';
    if (tabCount > commaCount && tabCount > semiCount) return '\t';
    return ',';
  }

  static parseCsv(content) {
    // 1. Clean UTF-8 BOM
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }

    const delimiter = ImportExportService.detectCsvDelimiter(content);
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return [];

    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] || '';
      });
      rows.push(obj);
    }
    return rows;
  }

  static mapHeaders(rawRow) {
    const mapped = {
      deckName: '',
      word: '',
      phrase: '',
      notes: '',
      targetTranslation: '',
      phraseTranslation: ''
    };

    for (const [key, value] of Object.entries(rawRow)) {
      const normKey = ImportExportService.normalizeText(key);

      if (normKey === 'mazo' || normKey === 'deck' || normKey === 'categoria') {
        mapped.deckName = String(value).trim();
      } else if (normKey === 'palabra' || normKey === 'word' || normKey === 'target' || normKey === 'token') {
        mapped.word = String(value).trim();
      } else if (normKey === 'frase' || normKey === 'sentence' || normKey === 'oracion' || normKey === 'contexto') {
        mapped.phrase = String(value).trim();
      } else if (normKey === 'nota' || normKey === 'notes' || normKey === 'regla' || normKey === 'gramatica') {
        mapped.notes = String(value).trim();
      } else if (normKey === 'traduccion palabra' || normKey === 'traduccion' || normKey === 'target translation' || normKey === 'meaning') {
        mapped.targetTranslation = String(value).trim();
      } else if (normKey === 'traduccion frase' || normKey === 'phrase translation' || normKey === 'sentence translation') {
        mapped.phraseTranslation = String(value).trim();
      }
    }

    return mapped;
  }

  /**
   * Imports a file (CSV or XLSX) into SQLite
   * @param {string} filePath - Path on disk
   * @returns {Object} { importedCount, skippedCount, createdDecksCount }
   */
  importFile(filePath) {
    let rows = [];

    if (filePath.endsWith('.csv')) {
      const content = fs.readFileSync(filePath, 'utf8');
      rows = ImportExportService.parseCsv(content);
    } else {
      // XLSX or XLS
      const workbook = xlsx.readFile(filePath);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
    }

    const existingDecks = this.repo.getAllDecks();
    const deckMap = new Map();
    existingDecks.forEach(d => {
      deckMap.set(ImportExportService.normalizeText(d.name), d);
    });

    let createdDecksCount = 0;
    let importedCount = 0;
    let skippedCount = 0;

    // Get existing words for deduplication
    const allExistingWords = this.repo.db.prepare('SELECT deckId, targetText, phrase FROM words').all();
    const dedupeSet = new Set();
    allExistingWords.forEach(w => {
      const key = `${ImportExportService.normalizeText(w.deckId)}||${ImportExportService.normalizeText(w.targetText)}||${ImportExportService.normalizeText(w.phrase)}`;
      dedupeSet.add(key);
    });

    for (const raw of rows) {
      const item = ImportExportService.mapHeaders(raw);
      if (!item.phrase && !item.word) {
        skippedCount++;
        continue;
      }

      // If phrase is missing, set phrase = word
      if (!item.phrase) item.phrase = item.word;
      // If word is missing, extract target tokens from phrase
      if (!item.word) item.word = item.phrase;

      // Deck resolution: create if absent, default to "General"
      let deckName = item.deckName || 'General';
      let normDeckName = ImportExportService.normalizeText(deckName);
      let targetDeck = deckMap.get(normDeckName);

      if (!targetDeck) {
        const newDeckId = 'deck_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        targetDeck = this.repo.createDeck({
          id: newDeckId,
          name: deckName,
          description: 'Mazo importado automáticamente',
          color: '#0ea5e9'
        });
        deckMap.set(normDeckName, targetDeck);
        createdDecksCount++;
      }

      // Deduplication check
      const dedupeKey = `${ImportExportService.normalizeText(targetDeck.id)}||${ImportExportService.normalizeText(item.word)}||${ImportExportService.normalizeText(item.phrase)}`;
      if (dedupeSet.has(dedupeKey)) {
        skippedCount++;
        continue;
      }

      // Calculate target tokens from word string
      const tokens = item.word.split(/\s+/).filter(t => t.length > 0);

      const wordId = 'w_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      this.repo.createWord({
        id: wordId,
        deckId: targetDeck.id,
        phrase: item.phrase,
        targetTokens: tokens,
        targetText: item.word,
        notes: item.notes,
        phraseTranslation: item.phraseTranslation,
        targetTranslation: item.targetTranslation,
        tags: [deckName]
      });

      dedupeSet.add(dedupeKey);
      importedCount++;
    }

    return {
      importedCount,
      skippedCount,
      createdDecksCount
    };
  }

  /**
   * Exports words of specified deck(s) to CSV or XLSX format
   */
  exportData(deckIds = [], format = 'csv') {
    const decks = this.repo.getAllDecks();
    const selectedDecks = deckIds.length > 0 ? decks.filter(d => deckIds.includes(d.id)) : decks;
    const deckNameMap = new Map(selectedDecks.map(d => [d.id, d.name]));

    const targetDeckIds = selectedDecks.map(d => d.id);
    const words = this.repo.getAllWordsInDecks(targetDeckIds);

    const rows = words.map(w => ({
      Mazo: deckNameMap.get(w.deckId) || 'General',
      Palabra: w.targetText,
      Frase: w.phrase,
      'Traduccion palabra': w.targetTranslation || '',
      'Traduccion frase': w.phraseTranslation || '',
      Notas: w.notes || '',
      Nivel: w.level !== null ? w.level : 'Nueva',
      'Es Aprendida': w.isLearned ? 'Sí' : 'No'
    }));

    if (format === 'xlsx') {
      const worksheet = xlsx.utils.json_to_sheet(rows);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Lexispelling');
      return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    } else {
      // CSV format with UTF-8 BOM
      const headers = ['Mazo', 'Palabra', 'Frase', 'Traduccion palabra', 'Traduccion frase', 'Notas', 'Nivel', 'Es Aprendida'];
      const escapeCsv = (str) => {
        const val = String(str || '');
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };

      const lines = [headers.join(',')];
      for (const r of rows) {
        lines.push(headers.map(h => escapeCsv(r[h])).join(','));
      }
      return '\uFEFF' + lines.join('\r\n');
    }
  }
}

module.exports = ImportExportService;

