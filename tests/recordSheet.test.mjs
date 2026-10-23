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
const sheet = require('../src/recordSheet.ts');

test('an empty or partly filled sheet retains three distinct numbered positions', () => {
  assert.deepEqual(sheet.recordSlots([]), [
    { number: 1, item: null }, { number: 2, item: null }, { number: 3, item: null },
  ]);
  const item = { id: 'skill-1', name: '필사' };
  assert.equal(sheet.recordSlots([item])[0].item, item);
  assert.equal(sheet.recordSlots([item])[2].item, null);
});

test('acquired and lost records keep their original order, identities and state beyond three slots', () => {
  const records = Object.freeze([
    Object.freeze({ id: 'a', isChecked: true }),
    Object.freeze({ id: 'b', isLost: true, isChecked: true }),
    Object.freeze({ id: 'c' }), Object.freeze({ id: 'new-d' }), Object.freeze({ id: 'diary' }),
  ]);
  const slots = sheet.recordSlots(records);
  assert.equal(slots.length, 5);
  assert.deepEqual(slots.map(slot => slot.number), [1, 2, 3, 4, 5]);
  assert.deepEqual(slots.map(slot => slot.item.id), ['a', 'b', 'c', 'new-d', 'diary']);
  slots.forEach((slot, index) => assert.equal(slot.item, records[index]));
  assert.equal(slots[1].item.isLost, true);
  assert.equal(slots[1].item.isChecked, true);
});

test('minimum sizes add placeholders without trimming any existing records', () => {
  assert.equal(sheet.recordSlots(['a', 'b', 'c', 'd'], 2).length, 4);
  assert.equal(sheet.recordSlots(['a'], 5).length, 5);
  assert.deepEqual(sheet.recordSlots([], 0), []);
});

test('creation entries preserve middle and trailing blanks and legacy entries beyond three', () => {
  assert.deepEqual(sheet.setupEntries(''), ['', '', '']);
  assert.deepEqual(sheet.setupEntries('필사\n\n검술'), ['필사', '', '검술']);
  assert.deepEqual(sheet.setupEntries('필사\r\n사냥\r\n'), ['필사', '사냥', '']);
  assert.deepEqual(sheet.setupEntries('첫째\n둘째\n셋째\n넷째\n'), ['첫째', '둘째', '셋째', '넷째', '']);
});

test('editing or clearing one creation position never shifts or loses another position', () => {
  const original = '필사\n\n검술\n항해';
  assert.equal(sheet.updateSetupEntry(original, 1, '사냥'), '필사\n사냥\n검술\n항해');
  assert.equal(sheet.updateSetupEntry(original, 0, ''), '\n\n검술\n항해');
  assert.equal(sheet.updateSetupEntry('', 2, '셋째 기술'), '\n\n셋째 기술');
  assert.equal(sheet.updateSetupEntry('첫째', 4, '다섯째'), '첫째\n\n\n\n다섯째');
  assert.throws(() => sheet.updateSetupEntry(original, -1, '오류'), RangeError);
  assert.throws(() => sheet.updateSetupEntry(original, 1.5, '오류'), RangeError);
});

test('legacy stationary markers are decoded without altering portable resource names', () => {
  assert.deepEqual(sheet.parseSetupResource(' [정착] 강가의 서고 '), { name: '강가의 서고 ', stationary: true });
  assert.deepEqual(sheet.parseSetupResource('[정착]성채'), { name: '성채', stationary: true });
  assert.deepEqual(sheet.parseSetupResource(' 은반지 '), { name: ' 은반지 ', stationary: false });
  assert.deepEqual(sheet.parseSetupResource('[정착]  강가의 서고  '), { name: ' 강가의 서고  ', stationary: true });
  assert.deepEqual(sheet.parseSetupResource('정착민의 편지'), { name: '정착민의 편지', stationary: false });
});

test('resource stationarity can be toggled and saved repeatedly without duplicating its marker', () => {
  let line = sheet.formatSetupResource('강가의 서고', true);
  assert.equal(line, '[정착] 강가의 서고');
  assert.equal(sheet.formatSetupResource(sheet.parseSetupResource(line).name, true), line);
  const parsed = sheet.parseSetupResource(line);
  line = sheet.formatSetupResource(parsed.name, false);
  assert.equal(line, '강가의 서고');
  assert.deepEqual(sheet.parseSetupResource(line), { name: '강가의 서고', stationary: false });
  assert.equal(sheet.formatSetupResource('', true), '[정착] ');
  assert.equal(sheet.parseSetupResource('[정착]').name, '');
});

for (const stationary of [false, true]) {
  test(`typing a ${stationary ? 'stationary' : 'portable'} resource preserves every space across controlled updates`, () => {
    const expected = ' 강가의 작은 집 ';
    let entry = sheet.formatSetupResource('', stationary);
    let typed = '';
    for (const character of expected) {
      const current = sheet.parseSetupResource(entry);
      entry = sheet.formatSetupResource(current.name + character, current.stationary);
      typed += character;
      assert.equal(sheet.parseSetupResource(entry).name, typed);
      assert.equal(sheet.parseSetupResource(entry).stationary, stationary);
    }
    assert.equal(sheet.parseSetupResource(entry).name, expected);
    const toggled = sheet.formatSetupResource(sheet.parseSetupResource(entry).name, !stationary);
    assert.equal(sheet.parseSetupResource(toggled).name, expected);
  });
}
