import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};
const { gamePrompts } = require('../src/data/prompts.ts');
const { alternatePrompts, alternateEndingPrompts } = require('../src/data/alternatePrompts.ts');

// Independent evidence: the PDF page/indentation census in PROMPT_AUDIT.md.
// This is deliberately not generated from the application catalog. The source
// is ver 1.2, second printing, SHA-256 42a04ed32c7d6eb4c1ff2bddf9de5439d91e9a59fef25caf61345b87e2f48616.
const audit = readFileSync(new URL('../docs/PROMPT_AUDIT.md', import.meta.url), 'utf8');
const appendixCensus = [];
for (const match of audit.matchAll(/^\| (\d+) \| ([^\n]+) \|$/gm)) {
  for (const item of match[2].split(', ')) {
    const entry = /^(\d+(?:a|b)?):(\d+)$/.exec(item);
    if (entry) appendixCensus.push({ label: entry[1], page: Number(match[1]), visits: Number(entry[2]) });
  }
}
const byId = (id) => {
  const prompt = alternatePrompts.find((entry) => entry.id === id);
  assert.ok(prompt, `Missing alternate ${id}`);
  return prompt;
};
const metadata = (catalog, key) => catalog.flatMap((prompt) =>
  Object.entries(prompt[key] ?? {}).map(([visit, value]) => [prompt.id, Number(visit), value]));

test('base source pages 32–111 contain all 80 prompts and 222 visits, with nine single-entry endings', () => {
  assert.deepEqual(gamePrompts.map((prompt) => prompt.id), Array.from({ length: 80 }, (_, index) => index + 1));
  assert.equal(gamePrompts.reduce((sum, prompt) => sum + prompt.entries.length, 0), 222);
  for (const prompt of gamePrompts) {
    assert.equal(prompt.page, prompt.id + 31, `Source page for base ${prompt.id}`);
    assert.equal(prompt.entries.length, prompt.id <= 71 ? 3 : 1, `Source visit count for base ${prompt.id}`);
  }
});

test('every numbered appendix entry has the page and visit count independently transcribed in the source audit', () => {
  // Guard the evidence parser itself: a missing or reformatted table must fail.
  assert.equal(appendixCensus.length, 136);
  assert.equal(new Set(appendixCensus.map((entry) => entry.label)).size, 136);
  assert.equal(appendixCensus.reduce((sum, entry) => sum + entry.visits, 0), 265);
  const numbered = alternatePrompts.filter((prompt) => prompt.kind !== 'ending');
  assert.equal(numbered.length, 136);
  assert.deepEqual(numbered.map((prompt) => prompt.sourceLabel).sort(), appendixCensus.map((entry) => entry.label).sort());
  for (const source of appendixCensus) {
    const prompt = numbered.find((entry) => entry.sourceLabel === source.label);
    assert.equal(prompt.page, source.page, `Source page for alternate ${source.label}`);
    assert.equal(prompt.entries.length, source.visits, `Source visit count for alternate ${source.label}`);
    assert.equal(prompt.sourceNumber, Number.parseInt(source.label, 10));
  }
});

test('both printed no. 74s and all five unnumbered ending choices survive without ID collisions', () => {
  assert.deepEqual(alternatePrompts.map((prompt) => prompt.id), Array.from({ length: 141 }, (_, index) => index + 1));
  assert.equal(alternatePrompts.reduce((sum, prompt) => sum + prompt.entries.length, 0), 270);
  assert.deepEqual([byId(74).sourceLabel, byId(74).sourceNumber, byId(74).page, byId(74).entries.length], ['74a', 74, 132, 3]);
  assert.deepEqual([byId(136).sourceLabel, byId(136).sourceNumber, byId(136).page, byId(136).entries.length], ['74b', 74, 134, 1]);
  assert.deepEqual(alternateEndingPrompts.map((prompt) => prompt.id), [137, 138, 139, 140, 141]);
  for (const prompt of alternateEndingPrompts) {
    assert.equal(prompt.page, 133);
    assert.equal(prompt.kind, 'ending');
    assert.equal(prompt.entries.length, 1);
    assert.equal(byId(prompt.id), prompt);
  }
  assert.deepEqual(alternatePrompts.filter((prompt) => prompt.seasonBreak).map((prompt) => prompt.id), [141]);
});

test('ending metadata matches the explicit source endings and keeps branch-dependent deaths conditional', () => {
  assert.deepEqual(metadata(gamePrompts, 'endingByVisit'), [
    [69, 3, 'optional'],
    ...Array.from({ length: 9 }, (_, index) => [72 + index, 1, 'required']),
  ]);
  assert.deepEqual(metadata(alternatePrompts, 'endingByVisit'), [
    [12, 3, 'optional'], [58, 2, 'optional'], [73, 3, 'optional'],
    [137, 1, 'required'], [138, 1, 'required'], [139, 1, 'required'], [140, 1, 'required'], [141, 1, 'optional'],
  ]);
  assert.deepEqual(alternatePrompts.filter((prompt) => prompt.conditionalEndingVisits)
    .map((prompt) => [prompt.id, prompt.conditionalEndingVisits]), [[58, [2]], [73, [3]]]);
});

test('no-Experience and additional-Experience instructions are attached to the source visits', () => {
  assert.deepEqual(metadata(gamePrompts, 'experienceByVisit'), [[24, 2, 0], [37, 1, 0], [43, 2, 0], [54, 2, 0]]);
  assert.deepEqual(metadata(alternatePrompts, 'experienceByVisit'), [[46, 2, 0], [65, 1, 2], [66, 1, 2]]);
});

test('the art workshop spans six visits and no catalog text or metadata entry is missing', () => {
  assert.equal(byId(88).page, 137);
  assert.equal(byId(88).entries.length, 6);
  for (const prompt of [...gamePrompts, ...alternatePrompts]) {
    assert.ok(prompt.entries.every((entry) => typeof entry === 'string' && /[가-힣]/.test(entry) && entry.trim().length > 10), `Missing Korean text at ${prompt.id}`);
    assert.ok(prompt.entries.every((entry) => !/[\u0000-\u0008\uFFFD]/.test(entry)), `Corrupted extraction at ${prompt.id}`);
    for (const key of ['endingByVisit', 'experienceByVisit']) {
      for (const visit of Object.keys(prompt[key] ?? {})) {
        assert.ok(Number(visit) >= 1 && Number(visit) <= prompt.entries.length, `Invalid ${key} visit ${prompt.id}.${visit}`);
      }
    }
  }
});
