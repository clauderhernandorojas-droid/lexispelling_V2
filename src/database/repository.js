// ============================================================================
// Lexispelling V2 - Data Repository
// Encapsulates all domain operations, queries, and transactions
// ============================================================================

class Repository {
  constructor(dbManager) {
    this.db = dbManager.db;
  }

  // --- Start of Day Helper ---
  static getStartOfDay(timestamp = Date.now()) {
    const d = new Date(timestamp);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  static getTodayString(timestamp = Date.now()) {
    const d = new Date(timestamp);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // --- DECKS ---
  getAllDecks() {
    const todayStart = Repository.getStartOfDay();
    const query = `
      SELECT 
        d.*,
        COUNT(w.id) AS totalWords,
        SUM(CASE WHEN (w.isLearned = 1 OR w.level = 4) THEN 1 ELSE 0 END) AS masteredWords,
        SUM(CASE WHEN w.isActive = 1 AND (w.isNew = 0 OR w.isNew IS NULL) AND w.nextReviewAt <= ? THEN 1 ELSE 0 END) AS reviewDueWords,
        SUM(CASE WHEN w.isActive = 1 AND w.isNew = 1 THEN 1 ELSE 0 END) AS newWords,
        SUM(CASE WHEN w.isActive = 1 AND (w.isNew = 1 OR w.nextReviewAt <= ?) THEN 1 ELSE 0 END) AS dueWords
      FROM decks d
      LEFT JOIN words w ON w.deckId = d.id
      GROUP BY d.id
      ORDER BY d.createdAt ASC
    `;
    return this.db.prepare(query).all(todayStart);
  }

  getDeckById(id) {
    return this.db.prepare('SELECT * FROM decks WHERE id = ?').get(id);
  }

  createDeck(deck) {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO decks (id, name, description, color, iconCodePoint, isActive, isPublic, wordCount, ownerId, ownerDisplayName, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      deck.id,
      deck.name,
      deck.description || '',
      deck.color || '#4f46e5',
      deck.iconCodePoint || 58712,
      deck.isActive !== undefined ? (deck.isActive ? 1 : 0) : 1,
      deck.isPublic !== undefined ? (deck.isPublic ? 1 : 0) : 0,
      0,
      deck.ownerId || 'user_local',
      deck.ownerDisplayName || 'Estudiante',
      now,
      now
    );
    return this.getDeckById(deck.id);
  }

  updateDeck(id, updates) {
    const now = Date.now();
    const fields = [];
    const values = [];

    for (const [k, v] of Object.entries(updates)) {
      if (k === 'id') continue;
      fields.push(`${k} = ?`);
      values.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
    fields.push('updatedAt = ?');
    values.push(now);
    values.push(id);

    this.db.prepare(`UPDATE decks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getDeckById(id);
  }

  setDeckActive(id, isActive) {
    const activeInt = isActive ? 1 : 0;
    const now = Date.now();

    // Section 6.3: "Si un usuario desactiva un mazo (isActive = false):
    // Todas las palabras pertenecientes a ese mazo reinician su nivel SRS a estado
    // isNew = true, level = null y nextReviewAt = null. El mazo deja de aparecer en los
    // selectores de estudio diario hasta que sea reactivado."
    if (!isActive) {
      this.db.prepare(`
        UPDATE words 
        SET isNew = 1, level = NULL, nextReviewAt = NULL, updatedAt = ?
        WHERE deckId = ?
      `).run(now, id);
    }

    this.db.prepare('UPDATE decks SET isActive = ?, updatedAt = ? WHERE id = ?').run(activeInt, now, id);
    return this.getDeckById(id);
  }

  deleteDeck(id) {
    this.db.prepare('DELETE FROM words WHERE deckId = ?').run(id);
    return this.db.prepare('DELETE FROM decks WHERE id = ?').run(id);
  }

  // --- WORDS ---
  getWordById(id) {
    const row = this.db.prepare('SELECT * FROM words WHERE id = ?').get(id);
    if (!row) return null;
    return this._formatWordRow(row);
  }

  getWordsByDeckId(deckId) {
    const rows = this.db.prepare('SELECT * FROM words WHERE deckId = ? ORDER BY createdAt DESC').all(deckId);
    return rows.map(r => this._formatWordRow(r));
  }

  createWord(word) {
    const now = Date.now();
    const tokens = Array.isArray(word.targetTokens) ? JSON.stringify(word.targetTokens) : (word.targetTokens || '[]');
    const tags = Array.isArray(word.tags) ? JSON.stringify(word.tags) : (word.tags || '[]');

    this.db.prepare(`
      INSERT INTO words (
        id, deckId, phrase, targetTokens, targetText, notes, isNew, level,
        nextReviewAt, failedCount, reviewFailures, reachedLevel4At, lastReviewed,
        isLearned, isActive, phraseTranslation, targetTranslation, audioWordPath,
        audioPhrasePath, tags, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, 1, NULL, NULL, 0, 0, NULL, NULL, 0, 1, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      word.id,
      word.deckId,
      word.phrase,
      tokens,
      word.targetText,
      word.notes || '',
      word.phraseTranslation || '',
      word.targetTranslation || '',
      word.audioWordPath || '',
      word.audioPhrasePath || '',
      tags,
      now,
      now
    );

    this._updateDeckWordCount(word.deckId);
    return this.getWordById(word.id);
  }

  updateWord(id, updates) {
    const now = Date.now();
    const fields = [];
    const values = [];

    for (const [k, v] of Object.entries(updates)) {
      if (k === 'id') continue;
      fields.push(`${k} = ?`);
      if (k === 'targetTokens' || k === 'tags') {
        values.push(Array.isArray(v) ? JSON.stringify(v) : v);
      } else if (typeof v === 'boolean') {
        values.push(v ? 1 : 0);
      } else {
        values.push(v);
      }
    }
    fields.push('updatedAt = ?');
    values.push(now);
    values.push(id);

    this.db.prepare(`UPDATE words SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const updated = this.getWordById(id);
    if (updated) this._updateDeckWordCount(updated.deckId);
    return updated;
  }

  deleteWord(id) {
    const w = this.getWordById(id);
    if (!w) return;
    this.db.prepare('DELETE FROM words WHERE id = ?').run(id);
    this._updateDeckWordCount(w.deckId);
  }

  resetWordProgress(id) {
    const now = Date.now();
    this.db.prepare(`
      UPDATE words 
      SET isNew = 1, level = NULL, nextReviewAt = NULL, failedCount = 0, reviewFailures = 0,
          reachedLevel4At = NULL, lastReviewed = NULL, isLearned = 0, updatedAt = ?
      WHERE id = ?
    `).run(now, id);
    return this.getWordById(id);
  }

  _updateDeckWordCount(deckId) {
    const { count } = this.db.prepare('SELECT COUNT(*) as count FROM words WHERE deckId = ?').get(deckId);
    this.db.prepare('UPDATE decks SET wordCount = ?, updatedAt = ? WHERE id = ?').run(count, Date.now(), deckId);
  }

  _formatWordRow(row) {
    return {
      ...row,
      isNew: Boolean(row.isNew),
      isLearned: Boolean(row.isLearned),
      isActive: Boolean(row.isActive),
      targetTokens: typeof row.targetTokens === 'string' ? JSON.parse(row.targetTokens || '[]') : row.targetTokens,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags || '[]') : row.tags
    };
  }

  // Study selection query
  getWordsForStudy(deckIds = [], mode = 'normal') {
    const todayStart = Repository.getStartOfDay();
    if (!deckIds || deckIds.length === 0) return [];

    const placeholders = deckIds.map(() => '?').join(',');
    let sql = '';
    const params = [...deckIds];

    if (mode === 'maintenance') {
      // Only learned / level 4 words
      sql = `
        SELECT * FROM words
        WHERE deckId IN (${placeholders})
          AND isActive = 1
          AND (isLearned = 1 OR level = 4)
        ORDER BY RANDOM()
      `;
    } else if (mode === 'review_due') {
      // Strictly due review words (Quiz priority)
      sql = `
        SELECT * FROM words
        WHERE deckId IN (${placeholders})
          AND isActive = 1
          AND (isNew = 0 OR isNew IS NULL)
          AND nextReviewAt <= ?
        ORDER BY nextReviewAt ASC
      `;
      params.push(todayStart);
    } else if (mode === 'new_only') {
      // Strictly new words (Flashcards)
      sql = `
        SELECT * FROM words
        WHERE deckId IN (${placeholders})
          AND isActive = 1
          AND isNew = 1
        ORDER BY createdAt ASC
      `;
    } else {
      // Normal mode: Rule 5 Pedagogical Priority
      // If there are words due for review today, evaluate pending words FIRST.
      // New words enter flashcards only when there are no quices pending today.
      const reviewRows = this.db.prepare(`
        SELECT * FROM words
        WHERE deckId IN (${placeholders})
          AND isActive = 1
          AND (isNew = 0 OR isNew IS NULL)
          AND nextReviewAt <= ?
        ORDER BY nextReviewAt ASC
      `).all(...params, todayStart);

      if (reviewRows.length > 0) {
        return reviewRows.map(r => this._formatWordRow(r));
      }

      // No reviews due today -> study new words
      sql = `
        SELECT * FROM words
        WHERE deckId IN (${placeholders})
          AND isActive = 1
          AND isNew = 1
        ORDER BY createdAt ASC
      `;
    }

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(r => this._formatWordRow(r));
  }

  getAllWordsInDecks(deckIds = []) {
    if (!deckIds || deckIds.length === 0) return [];
    const placeholders = deckIds.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT * FROM words WHERE deckId IN (${placeholders}) AND isActive = 1
    `).all(...deckIds);
    return rows.map(r => this._formatWordRow(r));
  }

  // --- USER PROFILE ---
  getProfile() {
    const p = this.db.prepare('SELECT * FROM user_profile LIMIT 1').get();
    if (!p) return null;
    return {
      ...p,
      soundEnabled: Boolean(p.soundEnabled),
      vibrationEnabled: Boolean(p.vibrationEnabled),
      tutorModeEnabled: Boolean(p.tutorModeEnabled),
      notificationsEnabled: Boolean(p.notificationsEnabled),
      offlineModeEnabled: Boolean(p.offlineModeEnabled)
    };
  }

  updateProfile(updates) {
    const p = this.getProfile();
    const userId = p ? p.userId : 'user_local';
    const now = Date.now();
    const fields = [];
    const values = [];

    for (const [k, v] of Object.entries(updates)) {
      if (k === 'userId') continue;
      fields.push(`${k} = ?`);
      values.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
    fields.push('updatedAt = ?');
    values.push(now);
    values.push(userId);

    this.db.prepare(`UPDATE user_profile SET ${fields.join(', ')} WHERE userId = ?`).run(...values);
    return this.getProfile();
  }

  // --- DAILY STATS & METRICS ---
  getDailyStats(dateStr = Repository.getTodayString()) {
    let stat = this.db.prepare('SELECT * FROM daily_stats WHERE date = ?').get(dateStr);
    if (!stat) {
      this.db.prepare(`
        INSERT INTO daily_stats (id, userId, date, studyMinutes, evaluationMinutes, wordsEvaluatedCount, wordsFailedCount)
        VALUES (?, 'user_local', ?, 0, 0, 0, 0)
      `).run(dateStr, dateStr);
      stat = this.db.prepare('SELECT * FROM daily_stats WHERE date = ?').get(dateStr);
    }
    return stat;
  }

  recordActiveTime(type, minutes, dateStr = Repository.getTodayString()) {
    this.getDailyStats(dateStr); // Ensure exists
    if (type === 'study') {
      this.db.prepare(`
        UPDATE daily_stats 
        SET studyMinutes = ROUND(studyMinutes + ?, 2)
        WHERE date = ?
      `).run(minutes, dateStr);
    } else if (type === 'evaluation') {
      this.db.prepare(`
        UPDATE daily_stats 
        SET evaluationMinutes = ROUND(evaluationMinutes + ?, 2)
        WHERE date = ?
      `).run(minutes, dateStr);
    }
    return this.getDailyStats(dateStr);
  }

  recordEvaluationCounts(evaluatedCount, failedCount, dateStr = Repository.getTodayString()) {
    this.getDailyStats(dateStr);
    this.db.prepare(`
      UPDATE daily_stats 
      SET wordsEvaluatedCount = wordsEvaluatedCount + ?,
          wordsFailedCount = wordsFailedCount + ?
      WHERE date = ?
    `).run(evaluatedCount, failedCount, dateStr);
    return this.getDailyStats(dateStr);
  }

  getPast7DaysStats() {
    const list = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = Repository.getTodayString(d.getTime());
      const stat = this.getDailyStats(dateStr);
      list.push({
        date: dateStr,
        dayName: d.toLocaleDateString('es-ES', { weekday: 'short' }),
        studyMinutes: stat.studyMinutes,
        evaluationMinutes: stat.evaluationMinutes,
        totalMinutes: Number((stat.studyMinutes + stat.evaluationMinutes).toFixed(1)),
        wordsEvaluatedCount: stat.wordsEvaluatedCount,
        wordsFailedCount: stat.wordsFailedCount
      });
    }
    return list;
  }

  getOverallSRSMetrics() {
    const todayStart = Repository.getStartOfDay();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // All active words
    const allWords = this.db.prepare('SELECT id, level, isNew, isLearned, nextReviewAt, reachedLevel4At FROM words WHERE isActive = 1').all();

    const distribution = {
      new: 0,
      level0: 0,
      level1: 0,
      level2: 0,
      level3: 0,
      level4: 0
    };

    let wordsToEvaluateToday = 0;
    let delayedCount = 0;
    let delayedDaysTotal = 0;
    let nextScheduledExamDate = null;
    let nextScheduledExamVolume = 0;
    const futureScheduleMap = {};

    for (const w of allWords) {
      if (w.isNew) {
        distribution.new++;
        wordsToEvaluateToday++;
      } else {
        if (w.level === 0) distribution.level0++;
        else if (w.level === 1) distribution.level1++;
        else if (w.level === 2) distribution.level2++;
        else if (w.level === 3) distribution.level3++;
        else if (w.level === 4) distribution.level4++;

        if (w.nextReviewAt) {
          const reviewStart = Repository.getStartOfDay(w.nextReviewAt);
          if (reviewStart < todayStart) {
            delayedCount++;
            const daysDiff = Math.max(1, Math.round((todayStart - reviewStart) / oneDayMs));
            delayedDaysTotal += daysDiff;
            wordsToEvaluateToday++;
          } else if (reviewStart === todayStart) {
            wordsToEvaluateToday++;
          } else {
            // Future review
            futureScheduleMap[reviewStart] = (futureScheduleMap[reviewStart] || 0) + 1;
          }
        }
      }
    }

    // Find nearest future review day
    const futureTimestamps = Object.keys(futureScheduleMap).map(Number).sort((a, b) => a - b);
    if (futureTimestamps.length > 0) {
      nextScheduledExamDate = futureTimestamps[0];
      nextScheduledExamVolume = futureScheduleMap[futureTimestamps[0]];
    }

    // Achievements: Words reached level 4 this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { monthlyLearnedCount } = this.db.prepare(`
      SELECT COUNT(*) as monthlyLearnedCount
      FROM words
      WHERE reachedLevel4At >= ? AND (isLearned = 1 OR level = 4)
    `).get(startOfMonth.getTime());

    return {
      wordsToEvaluateToday,
      distribution,
      delayedCount,
      delayedDaysTotal,
      nextScheduledExamDate,
      nextScheduledExamVolume,
      monthlyLearnedCount
    };
  }

  // --- QUIZ HISTORY ---
  saveQuizResult(result) {
    this.db.prepare(`
      INSERT INTO quiz_history (id, userId, timestamp, deckIds, totalCorrect, totalFailed, durationSeconds, rows)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      result.id,
      result.userId || 'user_local',
      result.timestamp || Date.now(),
      JSON.stringify(result.deckIds || []),
      result.totalCorrect,
      result.totalFailed,
      result.durationSeconds,
      JSON.stringify(result.rows || [])
    );
  }

  getRecentHistory(limit = 20) {
    const rows = this.db.prepare('SELECT * FROM quiz_history ORDER BY timestamp DESC LIMIT ?').all(limit);
    return rows.map(r => ({
      ...r,
      deckIds: JSON.parse(r.deckIds || '[]'),
      rows: JSON.parse(r.rows || '[]')
    }));
  }
}

module.exports = Repository;

