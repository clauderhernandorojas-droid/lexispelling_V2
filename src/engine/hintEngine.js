// ============================================================================
// Lexispelling V2 - Contextual Distorted Clues Engine
// Generates dynamic masked sentence hints from peer words in the deck
// ============================================================================

class HintEngine {
  /**
   * Generates a distorted contextual clue
   * @param {string} failedLetter - The letter where the user made a mistake
   * @param {Object} currentWord - The current word being evaluated
   * @param {Array<Object>} deckWords - All words in the current deck/session
   * @returns {Object|null} { distortedPhrase, rawPhrase, phraseTranslation, maskedLetter }
   */
  static generateDistortedHint(failedLetter, currentWord, deckWords = []) {
    if (!failedLetter) return null;
    const targetChar = failedLetter.toLowerCase();

    // 1. Filter other candidate words containing the target character
    const candidates = deckWords.filter(w => {
      if (w.id === currentWord.id) return false;
      if (!w.phrase) return false;
      return w.phrase.toLowerCase().includes(targetChar);
    });

    let chosenCandidate = null;
    if (candidates.length > 0) {
      const idx = Math.floor(Math.random() * candidates.length);
      chosenCandidate = candidates[idx];
    } else {
      // Fallback: use current word's sentence if no other word contains it
      if (currentWord && currentWord.phrase && currentWord.phrase.toLowerCase().includes(targetChar)) {
        chosenCandidate = currentWord;
      } else {
        return null;
      }
    }

    const rawPhrase = chosenCandidate.phrase;
    const phraseTranslation = chosenCandidate.phraseTranslation || 'Sin traducción disponible';

    // Find all indices where failedLetter appears (case-insensitive)
    const letterIndices = [];
    for (let i = 0; i < rawPhrase.length; i++) {
      if (rawPhrase[i].toLowerCase() === targetChar) {
        letterIndices.push(i);
      }
    }

    if (letterIndices.length === 0) return null;

    // Pick one of the failed letter occurrences to mask
    const primaryMaskIdx = letterIndices[Math.floor(Math.random() * letterIndices.length)];

    // Pick 2 other letters at random to mask
    const otherLetterIndices = [];
    for (let i = 0; i < rawPhrase.length; i++) {
      if (i !== primaryMaskIdx && /[\p{L}\p{N}]/u.test(rawPhrase[i])) {
        otherLetterIndices.push(i);
      }
    }

    // Shuffle other letter indices
    for (let i = otherLetterIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherLetterIndices[i], otherLetterIndices[j]] = [otherLetterIndices[j], otherLetterIndices[i]];
    }

    const maskedIndicesSet = new Set();
    maskedIndicesSet.add(primaryMaskIdx);
    if (otherLetterIndices.length > 0) maskedIndicesSet.add(otherLetterIndices[0]);
    if (otherLetterIndices.length > 1) maskedIndicesSet.add(otherLetterIndices[1]);

    // Format output: each letter separated by space, words separated by double space
    // e.g. "H e l l o   w o r l d" or "_ e _ l o   _ o r l d"
    const words = rawPhrase.split(/\s+/);
    let charScanPos = 0;
    const formattedWords = [];

    for (const w of words) {
      const letters = [];
      for (let i = 0; i < w.length; i++) {
        // Find exact index in original string
        const originalIndex = rawPhrase.indexOf(w, charScanPos) + i;
        if (maskedIndicesSet.has(originalIndex)) {
          letters.push('_');
        } else {
          letters.push(w[i]);
        }
      }
      charScanPos = rawPhrase.indexOf(w, charScanPos) + w.length;
      formattedWords.push(letters.join(' '));
    }

    // Section 2.2: "Formatea la salida separando cada letra con un espacio y palabras con doble espacio"
    const distortedPhrase = formattedWords.join('  ');

    return {
      title: 'Pista Contextual Distorsionada',
      distortedPhrase,
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

