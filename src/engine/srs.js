// ============================================================================
// Lexispelling V2 - Spaced Repetition System (SRS) Engine
// Strict 5-level finite state machine with maintenance and Re-Quiz recovery
// ============================================================================

const SRS_LEVEL_CONFIG = {
  NEW: { name: 'Nueva', intervalDays: 0, initialLives: 3 },
  0:   { name: 'Nivel 0 (Penalizada)', intervalDays: 1, initialLives: 3 },
  1:   { name: 'Nivel 1 (Inicial)', intervalDays: 2, initialLives: 3 },
  2:   { name: 'Nivel 2 (Afianzamiento)', intervalDays: 5, initialLives: 2 },
  3:   { name: 'Nivel 3 (Retención intermedia)', intervalDays: 15, initialLives: 1 },
  4:   { name: 'Nivel 4 (Dominio / Mantenimiento)', intervalDays: 30, initialLives: 0 }
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

class SrsEngine {
  /**
   * Returns start of day timestamp for a given time (00:00:00.000 local)
   */
  static getStartOfDay(timestamp = Date.now()) {
    const d = new Date(timestamp);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  /**
   * Returns the initial number of lives allowed for a word based on its current SRS level
   */
  static getInitialLives(word) {
    if (word.isNew || word.level === null || word.level === undefined) {
      return SRS_LEVEL_CONFIG.NEW.initialLives; // 3 lives
    }
    const cfg = SRS_LEVEL_CONFIG[word.level];
    return cfg ? cfg.initialLives : 3;
  }

  /**
   * Computes the nextReviewAt timestamp based on target level
   */
  static computeNextReview(targetLevel, baseTimestamp = Date.now()) {
    const startOfDay = SrsEngine.getStartOfDay(baseTimestamp);
    const intervalDays = SRS_LEVEL_CONFIG[targetLevel]?.intervalDays || 1;
    return startOfDay + (intervalDays * ONE_DAY_MS);
  }

  /**
   * Evaluates the outcome of a word in a Quiz session
   * @param {Object} word - The WordEntry object
   * @param {boolean} success - True if successfully spelled, False if lives exhausted
   * @param {boolean} isReQuiz - True if this was in a Re-Quiz second-round
   * @param {number} preSessionLevel - The level the word had BEFORE the session started
   * @returns {Object} updates to apply to the WordEntry
   */
  static evaluateOutcome(word, success, isReQuiz = false, preSessionLevel = null) {
    const now = Date.now();
    const currentLevel = word.level;
    const isNew = Boolean(word.isNew);
    const isLearned = Boolean(word.isLearned);

    let nextLevel = currentLevel;
    let nextIsLearned = isLearned;
    let reachedLevel4At = word.reachedLevel4At;
    let failedCount = word.failedCount || 0;
    let reviewFailures = word.reviewFailures || 0;

    if (success) {
      if (isReQuiz) {
        // Section 2.5: "Al acertar en el Re-Quiz, la palabra no sube +1 nivel respecto a su estado previo,
        // sino que recupera el nivel que tenía antes de empezar la sesión del día"
        nextLevel = preSessionLevel !== null ? preSessionLevel : (currentLevel ?? 1);
        if (nextLevel === 4) {
          nextIsLearned = true;
          if (!reachedLevel4At) reachedLevel4At = now;
        }
      } else {
        // Normal quiz success progression
        if (isNew || currentLevel === null) {
          nextLevel = 1;
        } else if (currentLevel === 0) {
          nextLevel = 1;
        } else if (currentLevel === 1) {
          nextLevel = 2;
        } else if (currentLevel === 2) {
          nextLevel = 3;
        } else if (currentLevel >= 3) {
          nextLevel = 4;
          nextIsLearned = true;
          if (!reachedLevel4At) reachedLevel4At = now;
        }
      }

      return {
        isNew: false,
        level: nextLevel,
        isLearned: nextIsLearned,
        nextReviewAt: SrsEngine.computeNextReview(nextLevel, now),
        lastReviewed: now,
        reachedLevel4At
      };
    } else {
      // Failure
      failedCount++;
      reviewFailures++;

      if (isNew || currentLevel === null) {
        nextLevel = 0;
      } else if (currentLevel === 0) {
        nextLevel = 0;
      } else if (currentLevel === 1) {
        nextLevel = 0;
      } else if (currentLevel === 2) {
        nextLevel = 1;
      } else if (currentLevel === 3) {
        nextLevel = 2;
      } else if (currentLevel === 4) {
        // Handled in maintenance logic (if second full fail, degrades)
        nextLevel = 3;
        nextIsLearned = false;
      }

      return {
        isNew: false,
        level: nextLevel,
        isLearned: nextIsLearned,
        failedCount,
        reviewFailures,
        nextReviewAt: SrsEngine.computeNextReview(nextLevel, now),
        lastReviewed: now
      };
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SrsEngine, SRS_LEVEL_CONFIG };
}

