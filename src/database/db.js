// ============================================================================
// Lexispelling V2 - Local Native SQLite Database Manager
// High-performance local storage powered by Node 24 native SQLite (DatabaseSync)
// ============================================================================

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

class DatabaseManager {
  constructor(dbPath) {
    if (!dbPath) {
      const dataDir = path.join(process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library/Preferences') : path.join(process.env.HOME, '.local/share')), 'Lexispelling');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      dbPath = path.join(dataDir, 'lexispelling_v2.db');
    }
    this.dbPath = dbPath;
    this.db = null;
    this.init();
  }

  init() {
    this.db = new DatabaseSync(this.dbPath);
    // Performance pragma tweaks for instant responsive desktop UX
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
    `);

    this.createTables();
    this.seedDefaultsIfEmpty();
  }

  createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS decks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        color TEXT DEFAULT '#4f46e5',
        iconCodePoint INTEGER DEFAULT 58712,
        isActive INTEGER DEFAULT 1,
        isPublic INTEGER DEFAULT 0,
        wordCount INTEGER DEFAULT 0,
        ownerId TEXT DEFAULT 'user_local',
        ownerDisplayName TEXT DEFAULT 'Estudiante',
        adoptedFromDeckId TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS words (
        id TEXT PRIMARY KEY,
        deckId TEXT NOT NULL,
        phrase TEXT NOT NULL,
        targetTokens TEXT NOT NULL,
        targetText TEXT NOT NULL,
        notes TEXT DEFAULT '',
        isNew INTEGER DEFAULT 1,
        level INTEGER,
        nextReviewAt INTEGER,
        failedCount INTEGER DEFAULT 0,
        reviewFailures INTEGER DEFAULT 0,
        reachedLevel4At INTEGER,
        lastReviewed INTEGER,
        isLearned INTEGER DEFAULT 0,
        isActive INTEGER DEFAULT 1,
        phraseTranslation TEXT DEFAULT '',
        targetTranslation TEXT DEFAULT '',
        audioWordPath TEXT DEFAULT '',
        audioPhrasePath TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY (deckId) REFERENCES decks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_words_deck ON words(deckId);
      CREATE INDEX IF NOT EXISTS idx_words_review ON words(nextReviewAt, isActive);
      CREATE INDEX IF NOT EXISTS idx_words_learned ON words(isLearned);
      CREATE INDEX IF NOT EXISTS idx_words_level ON words(level);

      CREATE TABLE IF NOT EXISTS user_profile (
        userId TEXT PRIMARY KEY,
        displayName TEXT NOT NULL,
        soundEnabled INTEGER DEFAULT 1,
        vibrationEnabled INTEGER DEFAULT 1,
        dailyHoursGoal REAL DEFAULT 0.5,
        appLanguageCode TEXT DEFAULT 'es',
        learnLanguageCode TEXT DEFAULT 'en',
        ttsSpeechRate REAL DEFAULT 0.85,
        tutorModeEnabled INTEGER DEFAULT 0,
        tutorCode TEXT DEFAULT 'LEX789',
        monitorTutorCode TEXT DEFAULT '',
        notificationsEnabled INTEGER DEFAULT 1,
        offlineModeEnabled INTEGER DEFAULT 1,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_stats (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        date TEXT NOT NULL,
        studyMinutes REAL DEFAULT 0,
        evaluationMinutes REAL DEFAULT 0,
        wordsEvaluatedCount INTEGER DEFAULT 0,
        wordsFailedCount INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS quiz_history (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        deckIds TEXT NOT NULL,
        totalCorrect INTEGER NOT NULL,
        totalFailed INTEGER NOT NULL,
        durationSeconds REAL NOT NULL,
        rows TEXT NOT NULL
      );
    `);
  }

  seedDefaultsIfEmpty() {
    // Seed default profile if not present
    const profileStmt = this.db.prepare('SELECT * FROM user_profile LIMIT 1');
    const profile = profileStmt.get();
    const now = Date.now();

    if (!profile) {
      this.db.prepare(`
        INSERT INTO user_profile (
          userId, displayName, soundEnabled, vibrationEnabled, dailyHoursGoal,
          appLanguageCode, learnLanguageCode, ttsSpeechRate, tutorModeEnabled,
          tutorCode, monitorTutorCode, notificationsEnabled, offlineModeEnabled, updatedAt
        ) VALUES (?, ?, 1, 1, 0.5, 'es', 'en', 0.85, 0, 'LEX789', '', 1, 1, ?)
      `).run('user_local', 'Estudiante', now);
    }

    // Seed default starter deck if empty
    const deckCountStmt = this.db.prepare('SELECT COUNT(*) as count FROM decks');
    const { count } = deckCountStmt.get();

    if (count === 0) {
      const deckId = 'deck_seed_b2';
      this.db.prepare(`
        INSERT INTO decks (id, name, description, color, iconCodePoint, isActive, isPublic, wordCount, ownerId, ownerDisplayName, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, 1, 1, 5, 'user_local', 'Lexispelling Team', ?, ?)
      `).run(
        deckId,
        'B2 Essential Phrasal Verbs',
        'Phrasal verbs clave en contexto para nivel intermedio-avanzado',
        '#6366f1',
        58712,
        now,
        now
      );

      const sampleWords = [
        {
          id: 'w_seed_1',
          phrase: 'Never give up when facing unexpected challenges.',
          tokens: ['give', 'up'],
          targetText: 'give up',
          phraseTr: 'Nunca te rindas al enfrentar desafíos inesperados.',
          targetTr: 'rendirse / abandonar',
          notes: '**Give up** es un phrasal verb separable en otros contextos, pero aquí actúa intransitivo.'
        },
        {
          id: 'w_seed_2',
          phrase: 'They decided to call off the football match because of torrential rain.',
          tokens: ['call', 'off'],
          targetText: 'call off',
          phraseTr: 'Decidieron cancelar el partido de fútbol debido a la lluvia torrencial.',
          targetTr: 'cancelar',
          notes: 'Sinónimo formal: _cancel_.'
        },
        {
          id: 'w_seed_3',
          phrase: 'We must carry on working until the project is completely finished.',
          tokens: ['carry', 'on'],
          targetText: 'carry on',
          phraseTr: 'Debemos continuar trabajando hasta que el proyecto esté completamente terminado.',
          targetTr: 'continuar / seguir',
          notes: 'Generalmente seguido de gerundio (_-ing_).'
        },
        {
          id: 'w_seed_4',
          phrase: 'Can you look after my cat while I am traveling abroad?',
          tokens: ['look', 'after'],
          targetText: 'look after',
          phraseTr: '¿Puedes cuidar de mi gato mientras viajo al extranjero?',
          targetTr: 'cuidar de',
          notes: 'Cuidado de personas, animales o pertenencias.'
        },
        {
          id: 'w_seed_5',
          phrase: 'I ran into an old friend at the supermarket this afternoon.',
          tokens: ['ran', 'into'],
          targetText: 'ran into',
          phraseTr: 'Me encontré por casualidad con un viejo amigo en el supermercado esta tarde.',
          targetTr: 'encontrarse por casualidad',
          notes: 'Pasado de _run into_.'
        }
      ];

      const insertWordStmt = this.db.prepare(`
        INSERT INTO words (
          id, deckId, phrase, targetTokens, targetText, notes, isNew, level,
          nextReviewAt, failedCount, reviewFailures, reachedLevel4At, lastReviewed,
          isLearned, isActive, phraseTranslation, targetTranslation, tags, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, 1, NULL, NULL, 0, 0, NULL, NULL, 0, 1, ?, ?, '["Phrasal Verbs"]', ?, ?)
      `);

      for (const w of sampleWords) {
        insertWordStmt.run(
          w.id,
          deckId,
          w.phrase,
          JSON.stringify(w.tokens),
          w.targetText,
          w.notes,
          w.phraseTr,
          w.targetTr,
          now,
          now
        );
      }
    }
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = DatabaseManager;

