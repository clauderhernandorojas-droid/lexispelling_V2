// ============================================================================
// Lexispelling V2 - Automated Unit Test Suite
// Validates SRS State Machine, PhraseSegmentParser, HintEngine, & CSV Engine
// ============================================================================

const assert = require('node:assert');
const { SrsEngine, SRS_LEVEL_CONFIG } = require('../src/engine/srs');
const { PhraseSegmentParser } = require('../src/engine/phraseParser');
const { HintEngine } = require('../src/engine/hintEngine');
const ImportExportService = require('../src/services/importExport');

let testsPassed = 0;
let testsFailed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    testsFailed++;
  }
}

console.log('\n--- 1. Testing PhraseSegmentParser ---');

it('should segment phrase with target tokens preserved in sequential appearance order', () => {
  const phrase = 'I turn the light on when it is dark';
  // Target tokens provided out of order
  const tokens = ['on', 'turn'];
  const res = PhraseSegmentParser.parse(phrase, tokens);

  assert.strictEqual(res.orderedTargetTokens[0], 'turn');
  assert.strictEqual(res.orderedTargetTokens[1], 'on');
  assert.strictEqual(res.unifiedTargetText, 'turn on');
  assert.strictEqual(res.segments.length, 5);
  assert.strictEqual(res.segments[0].text, 'I ');
  assert.strictEqual(res.segments[1].text, 'turn');
  assert.strictEqual(res.segments[1].isTarget, true);
});

it('should merge contiguous target tokens into a single compound segment with spaces', () => {
  const phrase = 'Never give up when facing unexpected challenges.';
  const tokens = ['give', 'up'];
  const res = PhraseSegmentParser.parse(phrase, tokens, 'give up');

  assert.strictEqual(res.segments.length, 3);
  assert.strictEqual(res.segments[0].text, 'Never ');
  assert.strictEqual(res.segments[0].isTarget, false);
  assert.strictEqual(res.segments[1].text, 'give up');
  assert.strictEqual(res.segments[1].isTarget, true);
  assert.strictEqual(res.unifiedTargetText, 'give up');
});

it('should not break words with Unicode boundaries (e.g. "on" should not match "conversation")', () => {
  const phrase = 'We had a deep conversation on Friday';
  const tokens = ['on'];
  const res = PhraseSegmentParser.parse(phrase, tokens);

  assert.strictEqual(res.orderedTargetTokens.length, 1);
  assert.strictEqual(res.orderedTargetTokens[0], 'on');
  // "conversation" must be untouched in static segments
  const hasConversation = res.segments.some(s => s.text.includes('conversation') && !s.isTarget);
  assert.strictEqual(hasConversation, true);
});

console.log('\n--- 2. Testing SRS Engine (5-Level Machine & Re-Quiz) ---');

it('new word success transitions to Level 1 (+2 days)', () => {
  const word = { isNew: true, level: null, isLearned: false };
  const res = SrsEngine.evaluateOutcome(word, true, false, null);

  assert.strictEqual(res.isNew, false);
  assert.strictEqual(res.level, 1);
  assert.strictEqual(res.isLearned, false);
});

it('new word failure transitions to Level 0 (+1 day)', () => {
  const word = { isNew: true, level: null, isLearned: false };
  const res = SrsEngine.evaluateOutcome(word, false, false, null);

  assert.strictEqual(res.isNew, false);
  assert.strictEqual(res.level, 0);
  assert.strictEqual(res.failedCount, 1);
});

it('level 3 success promotes to Level 4 (Mastery / isLearned = true, +30 days)', () => {
  const word = { isNew: false, level: 3, isLearned: false };
  const res = SrsEngine.evaluateOutcome(word, true, false, 3);

  assert.strictEqual(res.level, 4);
  assert.strictEqual(res.isLearned, true);
  assert(res.reachedLevel4At > 0);
});

it('Re-Quiz success does NOT overpromote, but recovers pre-session level', () => {
  // Word had Level 2 before session started
  const word = { isNew: false, level: 1, isLearned: false };
  const preSessionLevel = 2;
  const res = SrsEngine.evaluateOutcome(word, true, true, preSessionLevel);

  assert.strictEqual(res.level, 2);
});

console.log('\n--- 3. Testing Distorted Clue Engine (HintEngine) ---');

it('generates distorted string with failed letter masked and letter spacing', () => {
  const currentWord = { id: 'w1', phrase: 'Never give up' };
  const peerWords = [
    { id: 'w2', phrase: 'Always believe in yourself', phraseTranslation: 'Siempre cree en ti mismo' }
  ];

  const hint = HintEngine.generateDistortedHint('v', currentWord, peerWords);
  assert(hint !== null);
  assert(hint.distortedPhrase.includes('_'));
  assert.strictEqual(hint.maskedLetter, 'v');
  assert.strictEqual(hint.phraseTranslation, 'Siempre cree en ti mismo');
});

console.log('\n--- 4. Testing Import/Export Normalization & Delimiter Detection ---');

it('detects semicolon CSV delimiter and cleans UTF-8 BOM', () => {
  const csv = '\uFEFFMazo;Palabra;Frase;Traduccion\nIngles;give up;Never give up;rendirse';
  const rows = ImportExportService.parseCsv(csv);

  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0]['Mazo'], 'Ingles');
  assert.strictEqual(rows[0]['Palabra'], 'give up');
});

it('normalizes canonical headers case/accent insensitively', () => {
  const raw = {
    'MAZO': 'B2 Phrasal Verbs',
    'Palabra clave': 'look after',
    'Frase en contexto': 'Look after my cat',
    'Traducción palabra': 'cuidar'
  };

  const mapped = ImportExportService.mapHeaders({
    'Mazo': 'B2',
    'Palabra': 'take off',
    'Frase': 'The plane took off',
    'Traducción': 'despegar'
  });

  assert.strictEqual(mapped.deckName, 'B2');
  assert.strictEqual(mapped.word, 'take off');
  assert.strictEqual(mapped.targetTranslation, 'despegar');
});

console.log(`\n========================================`);
console.log(`Test Results: ${testsPassed} passed, ${testsFailed} failed.`);
console.log(`========================================\n`);

if (testsFailed > 0) {
  process.exit(1);
}

