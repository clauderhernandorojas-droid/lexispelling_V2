// ============================================================================
// Lexispelling V2 - Contextual Distorted Clues Engine
// Generates dynamic masked sentence hints from peer words in the deck
// Strictly compliant with Section 2.2 of Lexispelling Specifications
// ============================================================================

class HintEngine {
  static escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Generates a distorted contextual clue strictly from peer words in the deck.
   * NEVER uses the current active word.
   * 
   * @param {string} failedLetter - The letter where the user made a mistake
   * @param {Object} currentWord - The current word being evaluated (strictly excluded)
   * @param {Array<Object>} deckWords - All words in the current deck/session
   * @returns {Object|null} { title, distortedPhrase, distortedHtml, rawPhrase, phraseTranslation, maskedLetter }
   */
  static generateDistortedHint(failedLetter, currentWord, deckWords = []) {
    if (!failedLetter || !currentWord) return null;
    const targetChar = String(failedLetter).toLowerCase();

    // 1. Strict Exclusion (Section 2.2):
    // Must search in the REST of the words in the deck (candidate.id !== currentWord.id).
    // NEVER fallback to the current word being evaluated.
    const candidates = deckWords.filter(w => {
      if (!w || !w.id || !w.phrase) return false;
      if (w.id === currentWord.id) return false; // Strictly exclude current word
      return w.phrase.toLowerCase().includes(targetChar);
    });

    if (candidates.length === 0) {
      // Neutral signal: no other candidate phrase in deck contains this letter
      return null;
    }

    const chosenCandidate = candidates[Math.floor(Math.random() * candidates.length)];
    const rawPhrase = chosenCandidate.phrase;
    const phraseTranslation = chosenCandidate.phraseTranslation || 'Sin traducción disponible';

    // 2. Identify exact character indices for mandatory target masking & other candidate letters
    const targetCharIndices = [];
    const otherLetterIndices = [];

    for (let i = 0; i < rawPhrase.length; i++) {
      const ch = rawPhrase[i];
      if (/[\p{L}\p{N}]/u.test(ch)) {
        if (ch.toLowerCase() === targetChar) {
          targetCharIndices.push(i);
        } else {
          otherLetterIndices.push(i);
        }
      }
    }

    if (targetCharIndices.length === 0) return null;

    // 3. Strict masking logic (Section 2.2):
    // "Enmascara obligatoriamente la posición donde aparece la letra fallada
    // y selecciona al azar otras 2 letras más de la frase para enmascararlas con guiones bajos _"
    const maskedIndicesSet = new Set();

    // Mandatory: mask all occurrences of the target failed letter so it is NEVER exposed in plain text
    for (const idx of targetCharIndices) {
      maskedIndicesSet.add(idx);
    }

    // Shuffle other letter indices to pick 2 additional random letters
    for (let i = otherLetterIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherLetterIndices[i], otherLetterIndices[j]] = [otherLetterIndices[j], otherLetterIndices[i]];
    }

    if (otherLetterIndices.length > 0) maskedIndicesSet.add(otherLetterIndices[0]);
    if (otherLetterIndices.length > 1) maskedIndicesSet.add(otherLetterIndices[1]);

    // 4. Construct natural masked phrase: continuous words, standard single spaces
    // DO NOT separate individual characters with spaces (e.g. no .split('').join(' ')).
    let distortedPhrase = '';
    for (let i = 0; i < rawPhrase.length; i++) {
      if (maskedIndicesSet.has(i)) {
        distortedPhrase += '_';
      } else {
        distortedPhrase += rawPhrase[i];
      }
    }

    // Wrap each word token in <span class="distorted-word"> so words do not break mid-word,
    // while preserving exact standard whitespace between words.
    const distortedHtml = distortedPhrase
      .split(/(\s+)/)
      .map(segment => {
        if (/^\s+$/.test(segment)) {
          return segment; // Retain exact space/whitespace characters
        }
        return `<span class="distorted-word">${HintEngine.escapeHtml(segment)}</span>`;
      })
      .join('');

    return {
      title: 'Pista Contextual Distorsionada',
      distortedPhrase,
      distortedHtml,
      rawPhrase,
      phraseTranslation,
      maskedLetter: failedLetter
    };
  }
}

if (typeof window !== 'undefined') {
  window.HintEngine = HintEngine;
}
if (typeof global !== 'undefined') {
  global.HintEngine = HintEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HintEngine };
}
