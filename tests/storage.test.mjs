import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, fileName: filename,
  }).outputText, filename);
};
const storage = require('../src/storage.ts');
const game = require('../src/game.ts');

test('damaged setup fields never escape the form boundary and valid writing is preserved', () => {
  const setup = storage.parseSetup('{"name":"서윤","origin":45,"memories":null,"mode":"invalid"}');
  assert.equal(setup.name, '서윤');
  assert.equal(setup.origin, '');
  assert.deepEqual(setup.memories, ['', '', '', '', '']);
  assert.equal(setup.mode, 'journal');
  assert.deepEqual(storage.parseSetup('{"memories":["남겨 둔 문장",false,"다른 기억"]}').memories,
    ['남겨 둔 문장', '', '다른 기억', '', '']);
  for (const raw of ['null', '[]', '"text"', '{']) assert.throws(() => storage.parseSetup(raw));
});

test('a valid JSON value is not automatically accepted as a save', () => {
  for (const value of [{}, null, [], { characterName: 'A', currentPromptId: 1 }]) {
    assert.throws(() => storage.parseSave(JSON.stringify(value)));
  }
  const original = { ...game.createInitialGameState(), storyId: 'story-A', characterName: 'A' };
  assert.throws(() => storage.parseSave(JSON.stringify({ ...original, schemaVersion: 999 })), /새로운 버전/);
  assert.equal(storage.parseSave(JSON.stringify(original)).storyId, 'story-A');
  assert.equal(storage.parseSave(JSON.stringify(original)).characterName, 'A');
});

test('writing contexts separate same-named stories, visits, alternate pages and seasons', () => {
  const first = { ...game.createInitialGameState(), storyId: 'first', characterName: 'A' };
  const contexts = [first, { ...first, storyId: 'second' }, { ...first, currentPromptId: 2 },
    { ...first, promptVisitHistory: { 1: 2 } }, { ...first, activeAltIdx: 4 }, { ...first, season: 2 }].map(storage.draftContext);
  assert.equal(new Set(contexts).size, contexts.length);
  assert.equal(storage.draftContext(first), storage.draftContext(storage.parseSave(JSON.stringify(first))));
  const legacy = { ...first, storyId: undefined };
  assert.equal(storage.draftContext(legacy), storage.draftContext(storage.parseSave(JSON.stringify(legacy))));
});

test('draft loader validates every entry without throwing away other valid drafts', () => {
  const raw = JSON.stringify([{ context: 'a', journalText: '긴 글', experience: '한 문장', characterName: 'A', promptId: 7 },
    null, { context: 'broken', journalText: null, experience: 42 }, { context: '__proto__', journalText: 'kept', experience: '' }]);
  const drafts = storage.parseDrafts(raw);
  assert.deepEqual(Object.keys(drafts), ['a', '__proto__']);
  assert.equal(drafts.a.journalText, '긴 글');
  assert.equal(drafts.__proto__.journalText, 'kept');
  assert.throws(() => storage.parseDrafts('{}'));
});

test('recovery backups retain unfinished writing and damaged originals remain downloadable', () => {
  const data = new Map();
  globalThis.localStorage = { setItem: (k, v) => data.set(k, v), getItem: k => data.get(k) ?? null };
  const state = { ...game.createInitialGameState(), characterName: 'A' };
  storage.saveBackup(state, 'unfinished', 'one sentence');
  data.set(`${storage.SAVE_KEY}_recovery`, '{broken');
  const files = storage.recoveryFiles();
  assert.equal(files.length, 2);
  assert.equal(files[0].game.characterName, 'A');
  assert.equal(JSON.parse(files[0].raw).draft, 'unfinished');
  assert.equal(JSON.parse(files[0].raw).experienceDraft, 'one sentence');
  assert.equal(files[1].game, null);
  assert.equal(files[1].raw, '{broken');
  delete globalThis.localStorage;
});

test('readable export includes written history, lost traits, finale and unfinished text without mutating the save', () => {
  const state = { ...game.createInitialGameState(), characterName: '서윤', vampireOrigin: '개경', playMode: 'quick',
    isGameOver: true, gameOverText: '끝의 문장',
    skills: [{ id: 's', name: '필사', isChecked: true }, { id: 's2', name: '검술', isChecked: false, isLost: true }],
    journal: [{ id: 'j', promptId: 7, visitCount: 2, textContent: '잊지 않은 밤', rollText: 'D10 − D6', isAlternate: true, alternateId: 5 }],
    forgottenMemories: [{ id: 'f', experiences: [{ id: 'e', text: '잊은 문장' }], reason: '사건 지시' }] };
  const before = JSON.stringify(state);
  const document = storage.chronicleMarkdown(state, '미완성 기록', '초안 경험');
  for (const text of ['# 서윤', '빠른 게임', '필사 — 사용함', '검술 — 잃음', '대체 5', '잊지 않은 밤', '잊은 문장', '끝의 문장', '미완성 기록', '초안 경험']) assert.ok(document.includes(text), text);
  assert.equal(JSON.stringify(state), before);
});


test('creation draft is also available as a readable export before starting a story', () => {
  const setup = storage.parseSetup('{"name":"초안 인물","skills":"필사\\n해독","memories":["첫 경험"]}');
  const document = storage.setupMarkdown(setup);
  for (const text of ['# 초안 인물', '필사', '해독', '1. 첫 경험', '## 표식']) assert.ok(document.includes(text));
});
