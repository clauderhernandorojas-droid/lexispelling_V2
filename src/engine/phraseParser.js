// ============================================================================
// Lexispelling V2 - Phrase Segment Parser
// Greedy token extraction with Unicode word boundaries & contiguous merge
// ============================================================================

class PhraseSegmentParser {
  /**
   * Parses a full sentence against a set of target tokens.
   * Returns:
   *  - segments: array of { text: string, isTarget: boolean, tokenIndex?: number }
   *  - orderedTargetTokens: array of target tokens in the EXACT order they appear in the phrase
   *  - unifiedTargetText: string that user must type in order, space-joined (e.g. "turn on" or "give up")
   */
  static parse(phrase, targetTokens = [], fallbackTargetText = '') {
    if (!phrase) {
      const text = fallbackTargetText || '';
      return {
        segments: text ? [{ text, isTarget: true, tokenIndex: 0 }] : [],
        orderedTargetTokens: text ? [text] : [],
        unifiedTargetText: text
      };
    }

    // 1. Normalize targetTokens
    let validTokens = [];
    if (typeof targetTokens === 'string') {
      try {
        const parsed = JSON.parse(targetTokens);
        if (Array.isArray(parsed)) validTokens = parsed;
        else validTokens = [targetTokens];
      } catch (e) {
        validTokens = targetTokens.split(/[,\s]+/).filter(Boolean);
      }
    } else if (Array.isArray(targetTokens)) {
      validTokens = [...targetTokens];
    }

    // Also include fallbackTargetText if validTokens is empty
    if (validTokens.length === 0 && fallbackTargetText) {
      validTokens = fallbackTargetText.split(/\s+/).filter(Boolean);
    }

    // Clean tokens
    validTokens = validTokens
      .map(t => String(t || '').trim())
      .filter(t => t.length > 0);

    // If completely empty, try finding fallbackTargetText in phrase
    if (validTokens.length === 0) {
      if (fallbackTargetText && phrase.toLowerCase().includes(fallbackTargetText.toLowerCase())) {
        validTokens = [fallbackTargetText];
      } else {
        return {
          segments: [{ text: phrase, isTarget: false }],
          orderedTargetTokens: [],
          unifiedTargetText: ''
        };
      }
    }

    // 2. Find occurrences with Unicode word boundary protection
    const matches = [];

    // First try full fallbackTargetText as a compound unit if provided (e.g. "give up")
    if (fallbackTargetText && fallbackTargetText.includes(' ')) {
      const escapedFull = fallbackTargetText.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regexFull = new RegExp(`(?<![\\p{L}\\p{N}_])${escapedFull}(?![\\p{L}\\p{N}_])`, 'gui');
      let mFull;
      while ((mFull = regexFull.exec(phrase)) !== null) {
        matches.push({
          token: fallbackTargetText,
          matchedText: mFull[0],
          startIndex: mFull.index,
          endIndex: mFull.index + mFull[0].length
        });
      }
    }

    // If full compound didn't match, match individual tokens
    if (matches.length === 0) {
      for (const token of validTokens) {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'gui');
        let match;
        while ((match = regex.exec(phrase)) !== null) {
          matches.push({
            token,
            matchedText: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length
          });
        }
      }
    }

    // Sort matches by startIndex ascending
    matches.sort((a, b) => a.startIndex - b.startIndex);

    // Filter overlapping matches
    const nonOverlapping = [];
    let lastEnd = 0;
    for (const m of matches) {
      if (m.startIndex >= lastEnd) {
        nonOverlapping.push(m);
        lastEnd = m.endIndex;
      }
    }

    // Merge contiguous matches separated only by whitespace into compound target segments!
    // Example: "give" + " " + "up" -> single target segment "give up"
    const mergedMatches = [];
    for (let i = 0; i < nonOverlapping.length; i++) {
      const curr = nonOverlapping[i];
      if (mergedMatches.length === 0) {
        mergedMatches.push({ ...curr });
      } else {
        const prev = mergedMatches[mergedMatches.length - 1];
        const inBetween = phrase.substring(prev.endIndex, curr.startIndex);
        // If between them is only whitespace, merge!
        if (/^\s+$/.test(inBetween)) {
          prev.endIndex = curr.endIndex;
          prev.matchedText = phrase.substring(prev.startIndex, curr.endIndex);
        } else {
          mergedMatches.push({ ...curr });
        }
      }
    }

    // If still no matches found, fallback: search direct substring
    if (mergedMatches.length === 0 && fallbackTargetText) {
      const idx = phrase.toLowerCase().indexOf(fallbackTargetText.toLowerCase());
      if (idx !== -1) {
        mergedMatches.push({
          token: fallbackTargetText,
          matchedText: phrase.substring(idx, idx + fallbackTargetText.length),
          startIndex: idx,
          endIndex: idx + fallbackTargetText.length
        });
      }
    }

    // Build segments
    const segments = [];
    const orderedTargetTokens = [];
    let currentIndex = 0;

    for (let i = 0; i < mergedMatches.length; i++) {
      const m = mergedMatches[i];
      if (m.startIndex > currentIndex) {
        segments.push({
          text: phrase.substring(currentIndex, m.startIndex),
          isTarget: false
        });
      }

      segments.push({
        text: phrase.substring(m.startIndex, m.endIndex),
        isTarget: true,
        tokenIndex: i
      });
      orderedTargetTokens.push(m.matchedText);
      currentIndex = m.endIndex;
    }

    if (currentIndex < phrase.length) {
      segments.push({
        text: phrase.substring(currentIndex),
        isTarget: false
      });
    }

    // Unified target string to spell
    const unifiedTargetText = orderedTargetTokens.join(' ') || fallbackTargetText || '';

    return {
      segments,
      orderedTargetTokens,
      unifiedTargetText
    };
  }

  /**
   * Tokenizes a raw phrase into clickable candidate words for CreatorScreen
   */
  static extractClickableTokens(phrase) {
    if (!phrase) return [];
    const tokens = [];
    const regex = /([\p{L}\p{N}_'-]+|[^\s\p{L}\p{N}_'-]+)/gu;
    let match;
    while ((match = regex.exec(phrase)) !== null) {
      const text = match[0];
      const isWord = /[\p{L}\p{N}]/u.test(text);
      if (isWord) {
        tokens.push(text);
      }
    }
    return tokens;
  }
}

if (typeof window !== 'undefined') {
  window.PhraseSegmentParser = PhraseSegmentParser;
}
if (typeof global !== 'undefined') {
  global.PhraseSegmentParser = PhraseSegmentParser;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PhraseSegmentParser };
}
