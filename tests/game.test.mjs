import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Compile the actual domain module in memory, with the repository's own TypeScript.
const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, fileName: filename,
  });
  module._compile(result.outputText, filename);
};
const g = require('../src/game.ts');
const { alternatePrompts } = require('../src/data/alternatePrompts.ts');

function setup() {
  let state = g.createInitialGameState();
  state = { ...state, characterName: 'Ada', vampireOrigin: 'Medieval Poland',
    skills: ['Butcher', 'Brewer', 'Wanderer'].map((name, i) => ({ id: `s${i}`, name, isChecked: false })),
    resources: ['Staff', 'Sheep', 'Silver'].map((name, i) => ({ id: `r${i}`, name, isStationary: i === 1 })),
    characters: ['Piotr', 'Roza', 'Hania', 'Baron'].map((name, i) => ({ id: `c${i}`, name, type: i === 3 ? 'immortal' : 'mortal', isAlive: true })),
    marks: [{ id: 'mark', description: 'Broken neck' }] };
  for (const memory of state.memories) state = g.addExperience(state, memory.id, `Origin ${memory.id}`);
  return state;
}
const playing = () => g.startGame(setup());
const ready = () => ({ ...playing(), currentPromptResolved: true });

test('creation requires every printed starting trait and exactly one experience in five memories', () => {
  assert.equal(g.validateSetup(setup()).valid, true);
  assert.equal(g.validateSetup({ ...setup(), skills: setup().skills.slice(1) }).valid, false);
  assert.equal(g.validateSetup({ ...setup(), characters: setup().characters.filter(c => c.id !== 'c1') }).valid, false);
  assert.equal(g.validateSetup({ ...setup(), memories: setup().memories.map((m, i) => i ? m : { ...m, experiences: [] }) }).valid, false);
  assert.throws(() => g.startGame(g.createInitialGameState()), /이름/);
  assert.equal(playing().promptVisitHistory[1], 1);
});

test('movement handles positive, negative, zero and skips every exhausted page forward', () => {
  const state = { ...ready(), currentPromptId: 11, promptVisitHistory: { 11: 1, 8: 3, 9: 3 } };
  assert.equal(g.rollMovement(state, 7, 4).currentPromptId, 14);
  assert.equal(g.rollMovement(state, 4, 4).promptVisitHistory[11], 2);
  const back = g.rollMovement(state, 1, 4);
  assert.equal(back.currentPromptId, 10);
  assert.deepEqual(back.lastRoll.skipped, [8, 9]);
  assert.equal(state.promptVisitHistory[8], 3);
  assert.equal(g.rollMovement(ready(), 1, 6).currentPromptId, 1);
  assert.throws(() => g.rollMovement(ready(), 0, 1), /1–10/);
  assert.throws(() => g.rollMovement(playing(), 6, 1), /현재 사건/);
});

test('ending is applied only after resolving the selected entry, including alternate replacement', () => {
  let state = g.resolvePrompt(playing(), 72);
  assert.equal(state.isGameOver, false);
  state = g.addExperience(state, 'm1', 'The sun catches me.');
  state = g.completePrompt(state, 'My last sunrise.');
  assert.equal(state.isGameOver, true);
  assert.throws(() => g.rollMovement(state, 1, 1), /끝난/);
  const replaced = g.chooseAlternatePrompt(g.resolvePrompt(playing(), 72), 1);
  assert.equal(g.getCurrentPrompt(replaced).isAlternate, true);
  assert.equal(g.getCurrentPrompt(replaced).ending, null);
  const continued = g.completePrompt(g.addExperience(replaced, 'm1', 'I make a vow.'), 'The vow.');
  assert.equal(continued.isGameOver, false);
});

test('optional ending does not force the story to end', () => {
  const state = g.resolvePrompt({ ...playing(), promptVisitHistory: { 69: 2 } }, 69);
  assert.equal(g.getCurrentPrompt(state).ending, 'optional');
  const experienced = g.addExperience(state, 'm1', 'We rule the world.');
  assert.equal(g.completePrompt(experienced, 'Our plan.').isGameOver, false);
  assert.equal(g.completePrompt(experienced, 'Our plan.', true).isGameOver, true);
});

test('every prompt requires an Experience except four printed exceptions, even in journal mode', () => {
  assert.throws(() => g.completePrompt(playing(), 'A lengthy journal.'), /경험 한 문장/);
  for (const [id, visit] of [[24, 2], [37, 1], [43, 2], [54, 2]]) {
    const state = g.resolvePrompt({ ...playing(), promptVisitHistory: { [id]: visit - 1 } }, id);
    assert.equal(state.experienceWaived, true);
    assert.equal(g.completePrompt(state, 'A change without a new experience.').currentPromptResolved, true);
  }
  assert.throws(() => g.completePrompt(g.addExperience(playing(), 'm1', 'First night.'), ''), /연대기/);
  const quick = { ...playing(), playMode: 'quick' };
  assert.equal(g.completePrompt(g.addExperience(quick, 'm1', 'First night.')).journal.length, 0);
});

test('memories cap at three and forgetting preserves the entire readable prior memory', () => {
  let state = g.addExperience({ ...playing(), promptEditEnabled: true }, 'm1', 'Second.');
  state = g.addExperience(state, 'm1', 'Third.');
  assert.throws(() => g.addExperience(state, 'm1', 'Fourth.'), /더 이상/);
  const forgotten = g.forgetMemory(state, 'm1');
  assert.equal(forgotten.memories[0].experiences.length, 0);
  assert.equal(forgotten.forgottenMemories[0].experiences.length, 3);
  assert.equal(state.memories[0].experiences.length, 3);
  assert.throws(() => g.editExperience({ ...state, promptEditEnabled: false }, 'm1', state.memories[0].experiences[0].id, 'Rewrite.'), /명시적으로/);
});

test('a single Diary resource holds four frozen memories and losing it loses every linked memory', () => {
  let state = playing();
  for (let i = 1; i <= 4; i++) state = g.archiveMemory(state, `m${i}`, 'Pots with pictograms');
  assert.equal(state.diary.filter(d => !d.isLost).length, 4);
  assert.equal(state.resources.filter(r => r.isDiary && !r.isLost).length, 1);
  assert.throws(() => g.archiveMemory(state, 'm5'), /네 기억/);
  const discarded = g.forgetDiaryMemory(state, state.diary[0].id);
  assert.equal(g.archiveMemory(discarded, 'm5').diary.filter(d => !d.isLost).length, 4);
  const lost = g.loseResource(state, state.diaryResourceId);
  assert.equal(lost.diary.every(d => d.isLost), true);
  assert.equal(lost.resources.find(r => r.isDiary).isLost, true);
  assert.equal(state.diary.every(d => !d.isLost), true);
  assert.throws(() => g.restoreDiaryMemory(state, state.diary[0].id, 'm1'), /명시적으로/);
});

test('checks and Resource losses substitute only for each other, then cause demise', () => {
  let state = playing();
  state = { ...state, skills: state.skills.map(s => ({ ...s, isChecked: true })) };
  const substituted = g.checkSkill(state, undefined, 'r1');
  assert.equal(substituted.resources[1].isLost, true);
  assert.equal(substituted.isGameOver, false);
  state = { ...playing(), resources: [] };
  assert.equal(g.loseResource(state).skills[0].isChecked, true);
  const none = { ...state, skills: state.skills.map(s => ({ ...s, isChecked: true })) };
  assert.equal(g.checkSkill(none).isGameOver, true);
  assert.equal(g.loseResource(none).isGameOver, true);
  assert.equal(g.loseSkill({ ...playing(), skills: [] }).isGameOver, true);
  assert.throws(() => g.checkSkill({ ...playing(), skills: playing().skills.map((s, i) => i ? s : { ...s, isChecked: true }) }, 's0'), /다시 체크/);
});

test('lost traits stay readable, restoration and unchecking require a Prompt exception', () => {
  const state = g.loseSkill(playing(), 's0');
  assert.equal(state.skills[0].name, 'Butcher');
  assert.equal(state.skills[0].isLost, true);
  assert.throws(() => g.restoreSkill(state, 's0'), /명시적으로/);
  assert.equal(g.restoreSkill({ ...state, promptEditEnabled: true }, 's0').skills[0].isLost, false);
  const checked = g.checkSkill(playing(), 's0');
  assert.throws(() => g.uncheckSkill(checked, 's0'), /명시적으로/);
  assert.equal(g.uncheckSkill({ ...checked, promptEditEnabled: true }, 's0').skills[0].isChecked, false);
});

test('stationary travel losses and mortal aging leave portable possessions and immortals intact', () => {
  const traveled = g.travel(playing());
  assert.equal(traveled.resources.find(r => r.isStationary).isLost, true);
  assert.equal(traveled.resources.find(r => !r.isStationary).isLost, undefined);
  const aged = g.ageMortals(traveled);
  assert.equal(aged.characters.filter(c => c.type === 'mortal').every(c => !c.isAlive), true);
  assert.equal(aged.characters.find(c => c.type === 'immortal').isAlive, true);
});

test('permanent memories free a slot, reduced capacity persists, and lost memories need permission to return', () => {
  const state = { ...playing(), promptEditEnabled: true };
  const permanent = g.preserveMemory(state, 'm1');
  assert.equal(permanent.permanentMemories[0].isPermanent, true);
  assert.equal(permanent.memories[0].experiences.length, 0);
  assert.equal(g.reduceMemoryCapacity(state, 'm1').memories.length, 4);
  const reduced = g.reduceMemoryCapacity(state, 'm1');
  assert.equal(g.normalizeGameState(reduced).memories.length, 4);
  const forgotten = g.forgetMemory(state, 'm1');
  const restored = g.restoreForgottenMemory(forgotten, forgotten.forgottenMemories[0].id, 'm1');
  assert.equal(restored.memories[0].experiences.length, 1);
  assert.throws(() => g.burnMemory(state, 'm1'), /규칙이 없습니다/);
});

test('normalization validates untrusted saves and preserves overfull legacy diary with explicit migration notes', () => {
  assert.throws(() => g.normalizeGameState(null), /형식/);
  assert.throws(() => g.normalizeGameState([]), /형식/);
  const legacy = { ...playing(), schemaVersion: undefined, diary: Array.from({ length: 6 }, (_, i) => ({ id: `d${i}`, experiences: [{ id: `de${i}`, text: 'Old.' }] })),
    resources: [], currentPromptId: 200, promptVisitHistory: { 1: -4, 200: 2, 3: 500 } };
  const normalized = g.normalizeGameState(legacy);
  assert.equal(normalized.diary.length, 6);
  assert.equal(normalized.resources.filter(r => r.isDiary).length, 1);
  assert.equal(normalized.currentPromptId, 80);
  assert.equal(normalized.promptVisitHistory[200], undefined);
  assert.ok(normalized.migrationNotes.some(note => note.includes('네 개를 넘는')));
  assert.throws(() => g.archiveMemory(normalized, 'm1'), /네 기억/);
  assert.deepEqual(g.normalizeGameState(normalized), normalized);
  assert.deepEqual(g.normalizeGameState(g.normalizeGameState(playing())), g.normalizeGameState(playing()));
});

test('alternate selection persists per page and respects the actual count of its entries', () => {
  const alternate = alternatePrompts.find(prompt => prompt.entries?.length === 1);
  assert.ok(alternate);
  let state = g.chooseAlternatePrompt(playing(), alternate.id);
  state = { ...state, currentPromptResolved: true };
  const next = g.rollMovement(state, 1, 1);
  assert.equal(next.currentPromptId, 2);
  const restored = g.normalizeGameState(state);
  assert.equal(g.getCurrentPrompt(restored).alternateId, alternate.id);
});

test('special next-roll modes are consumed once and preserve recorded dice', () => {
  for (const [mode, expected] of [['reverse', 27], ['backward', 28], ['sum', 37]]) {
    const state = { ...ready(), currentPromptId: 30, nextRollMode: mode };
    const moved = g.rollMovement(state, 5, 2);
    assert.equal(moved.currentPromptId, expected);
    assert.equal(moved.nextRollMode, 'normal');
    assert.equal(moved.lastRoll.d10, 5);
  }
});


test('discarded Diary memories do not resurrect when a lost book returns', () => {
  let state = playing();
  for (let i = 1; i <= 4; i++) state = g.archiveMemory(state, `m${i}`);
  const erasedId = state.diary[0].id;
  state = g.forgetDiaryMemory(state, erasedId);
  state = g.archiveMemory(state, 'm5');
  const resourceId = state.diaryResourceId;
  state = g.loseDiary(state);
  state = g.restoreResource({ ...state, promptEditEnabled: true }, resourceId);
  assert.equal(state.diary.filter(d => !d.isLost).length, 4);
  assert.equal(state.diary.find(d => d.id === erasedId).isLost, true);
});

test('ordinary events accept one Experience; extra Experiences require explicit instructions', () => {
  const state = g.addExperience(playing(), 'm1', 'One event.');
  assert.throws(() => g.addExperience(state, 'm2', 'Extra event.'), /이미 기록/);
});


test('imported counters cannot produce duplicate trait identifiers', () => {
  const initial = playing();
  const state = g.normalizeGameState({ ...initial, sequence: 1,
    memories: initial.memories.map((m, i) => i ? m : { ...m, experiences: [{ id: 'e-999', text: 'Saved.' }] }) });
  const updated = g.addExperience(state, 'm1', 'New.');
  assert.notEqual(updated.memories[0].experiences[1].id, 'e-999');
  assert.ok(updated.sequence > 1000);
});


test('a Prompt-granted ageless mortal survives age, and Diary publication needs no empty slot', () => {
  let state = playing();
  state = { ...state, characters: state.characters.map((c, i) => i ? c : { ...c, isAgeless: true }) };
  assert.equal(g.ageMortals(state).characters[0].isAlive, true);
  const saved = g.normalizeGameState(state);
  assert.equal(saved.characters[0].isAgeless, true);
  state = g.archiveMemory(state, 'm1');
  const permanent = g.preserveDiaryMemory({ ...state, promptEditEnabled: true }, state.diary[0].id);
  assert.equal(permanent.permanentMemories.length, 1);
  assert.equal(permanent.diary[0].isLost, true);
  assert.equal(permanent.resources.find(r => r.isDiary).isLost, true);
});

test('all rebuilt alternate visit groups, including six visits, use their actual entry counts', () => {
  assert.equal(alternatePrompts.find(p => p.id === 88).entries.length, 6);
  const state = g.chooseAlternatePrompt(playing(), 88);
  let current = state;
  for (let visit = 2; visit <= 6; visit++) {
    current = g.rollMovement({ ...current, currentPromptResolved: true }, 1, 1);
    assert.equal(current.currentPromptId, 1);
    assert.equal(g.getCurrentPrompt(current).visit, visit);
  }
  assert.equal(g.rollMovement({ ...current, currentPromptResolved: true }, 1, 1).currentPromptId, 2);
});

test('alternate Experience metadata enforces extra Experiences and the explicit no-Experience entry', () => {
  for (const id of [65, 66]) {
    let state = g.chooseAlternatePrompt(playing(), id);
    assert.equal(g.getCurrentPrompt(state).requiredExperiences, 2);
    state = g.addExperience(state, 'm1', 'The ordinary event.');
    assert.throws(() => g.completePrompt(state, 'Our child.'), /경험 2개/);
    state = g.addExperience(state, 'm2', 'The best day together.');
    assert.equal(g.completePrompt(state, 'Our child.').currentPromptResolved, true);
  }
  let state = g.chooseAlternatePrompt(playing(), 46);
  state = g.rollMovement({ ...state, currentPromptResolved: true }, 1, 1);
  assert.equal(g.getCurrentPrompt(state).requiredExperiences, 0);
  assert.equal(state.experienceWaived, true);
});

test('capacity changes, single Experience deletion and merging require explicit Prompt permission', () => {
  assert.throws(() => g.setMemoryCapacity(playing(), 'm1', 5), /명시적으로/);
  let state = { ...playing(), promptEditEnabled: true };
  state = g.setMemoryCapacity(state, 'm1', 5);
  for (let i = 0; i < 4; i++) state = g.addExperience(state, 'm1', `Extra ${i}.`);
  assert.equal(state.memories[0].experiences.length, 5);
  assert.throws(() => g.setMemoryCapacity(state, 'm1', 3), /용량/);
  state = g.setMemoryLabel(state, 'm1', 'vast');
  state = g.mergeMemories(state, 'm2', 'm1');
  assert.equal(state.memories[0].experiences.length, 6);
  assert.equal(state.memories[1].experiences.length, 0);
  assert.equal(state.memories[0].maxExperiences, 6);
  state = g.deleteExperience(state, 'm1', state.memories[0].experiences[0].id);
  assert.equal(state.memories[0].experiences.length, 5);
  assert.equal(g.normalizeGameState(state).memories[0].label, 'vast');
});

test('an explicitly expanded Diary and extra book keep separate capacities and loss associations', () => {
  let state = { ...playing(), promptEditEnabled: true };
  state = g.setDiaryCapacity(state, 6);
  for (let i = 1; i <= 5; i++) state = g.archiveMemory(state, `m${i}`);
  state = g.createExtraDiaryMemory(state, 'An author describes my forgotten youth.', 'A biography');
  const mainId = state.diaryResourceId;
  const extraId = state.resources.find(resource => resource.isExtraDiary).id;
  assert.equal(state.diary.filter(entry => !entry.isLost).length, 6);
  const lost = g.loseResource(state, extraId);
  assert.equal(lost.diary.filter(entry => !entry.isLost).length, 5);
  assert.equal(lost.resources.find(resource => resource.id === mainId).isLost, undefined);
  const restored = g.restoreResource(lost, extraId);
  assert.equal(restored.diary.filter(entry => !entry.isLost).length, 6);
  assert.equal(restored.diaryResourceId, mainId);
  const normalized = g.normalizeGameState(state);
  assert.deepEqual(g.normalizeGameState(normalized), normalized);
  const lostMain = g.loseDiary(state);
  assert.equal(lostMain.diary.filter(entry => !entry.isLost).length, 1);
  assert.equal(lostMain.resources.find(resource => resource.id === extraId).isLost, undefined);
});

test('direct Diary Experience is allowed by a Prompt even when head slots are full', () => {
  const state = { ...g.resolvePrompt(playing(), 43), promptEditEnabled: true };
  const recorded = g.addDiaryMemory(state, 'I discover a forgotten event.');
  assert.equal(recorded.experienceCount, 1);
  assert.equal(recorded.memories.length, 5);
  assert.equal(recorded.memories[0].experiences.length, 1);
  assert.equal(recorded.diary.filter(entry => !entry.isLost).length, 1);
});

test('persistent reverse rolls continue until the Mark is removed, while next-roll exceptions last once', () => {
  let state = { ...ready(), currentPromptId: 30, persistentRollMode: 'reverse' };
  state = g.rollMovement(state, 5, 2);
  assert.equal(state.currentPromptId, 27);
  state = g.rollMovement({ ...state, currentPromptResolved: true }, 5, 2);
  assert.equal(state.currentPromptId, 24);
  assert.equal(state.lastRoll.mode, 'reverse');
  const normalized = g.normalizeGameState(state);
  assert.equal(normalized.persistentRollMode, 'reverse');
  const overridden = g.rollMovement({ ...state, currentPromptResolved: true, nextRollMode: 'sum' }, 5, 2);
  assert.equal(overridden.currentPromptId, 31);
  assert.equal(overridden.persistentRollMode, 'reverse');
  const completed = g.completePrompt(g.addExperience(overridden, 'm1', 'I walk backwards through time.'), 'The backwards world.');
  assert.ok(completed.journal[0].rollText.includes('+'));
});

test('quick play counts completed turns without creating a hidden journal', () => {
  const state = { ...playing(), playMode: 'quick' };
  const completed = g.completePrompt(g.addExperience(state, 'm1', 'I hunger.'));
  assert.equal(completed.turnCount, 1);
  assert.equal(completed.journal.length, 0);
  assert.equal(g.normalizeGameState(completed).turnCount, 1);
});

test('finished stories reject mechanical changes and normalize idempotently', () => {
  const ended = g.endGame(playing(), 'The last night.');
  for (const action of [() => g.checkSkill(ended), () => g.loseResource(ended), () => g.archiveMemory(ended, 'm1'),
    () => g.forgetMemory(ended, 'm1'), () => g.ageMortals(ended), () => g.travel(ended), () => g.resolvePrompt(ended, 1)]) {
    assert.throws(action, /끝난 이야기/);
  }
  const normalized = g.normalizeGameState(ended);
  assert.deepEqual(g.normalizeGameState(normalized), normalized);
});

test('two lost Diary memories can return as pages in the existing expanded Diary without reviving the old book', () => {
  let state = { ...playing(), promptEditEnabled: true };
  state = g.archiveMemory(state, 'm1', 'Old diary');
  state = g.archiveMemory(state, 'm2');
  const oldDiaryId = state.diaryResourceId;
  const oldEntryIds = state.diary.map(entry => entry.id);
  state = g.loseDiary(state);
  state = g.archiveMemory(state, 'm3', 'New diary');
  const currentDiaryId = state.diaryResourceId;
  state = g.setDiaryCapacity(state, 6);
  for (const id of oldEntryIds) state = g.recoverLostDiaryMemory(state, id);
  assert.equal(state.diary.filter(entry => !entry.isLost && entry.resourceId === currentDiaryId).length, 3);
  assert.equal(state.resources.find(resource => resource.id === oldDiaryId).isLost, true);
  assert.equal(state.diary.filter(entry => entry.resourceId === oldDiaryId).every(entry => entry.isLost), true);
  assert.throws(() => g.recoverLostDiaryMemory(state, oldEntryIds[0]), /되찾을 기억/);
  const normalized = g.normalizeGameState(state);
  assert.deepEqual(g.normalizeGameState(normalized), normalized);
  assert.throws(() => g.recoverLostDiaryMemory({ ...state, promptEditEnabled: false }, oldEntryIds[0]), /명시적으로/);
});

test('lost Diary recovery creates a new ordinary book when none is currently held', () => {
  let state = g.archiveMemory({ ...playing(), promptEditEnabled: true }, 'm1');
  const oldId = state.diaryResourceId;
  const entryId = state.diary[0].id;
  state = g.loseDiary(state);
  state = g.recoverLostDiaryMemory(state, entryId);
  assert.notEqual(state.diaryResourceId, oldId);
  assert.equal(state.diary.filter(entry => !entry.isLost).length, 1);
});

test('peaceful alternate ending can resume at Prompt 0 with new traits, three permanent slots and all visits preserved', () => {
  let state = g.chooseAlternatePrompt(playing(), 141);
  assert.equal(g.getCurrentPrompt(state).seasonBreak, true);
  state = g.completePrompt(g.addExperience(state, 'm1', 'A thousand peaceful years.'), 'Peace.', true);
  const traits = { mortals: ['Second-season friend', 'Second-season rival'], resources: ['New home', '[정착] A tower'], skills: ['Patience', 'Distant sight'] };
  const history = { ...state.promptVisitHistory };
  assert.throws(() => g.startNextSeason(playing(), traits), /다음 천 년/);
  assert.throws(() => g.startNextSeason(state, { ...traits, skills: ['Only one'] }), /둘/);
  const resumed = g.startNextSeason(state, traits);
  assert.equal(resumed.isGameOver, false);
  assert.equal(resumed.season, 2);
  assert.equal(resumed.currentPromptId, 0);
  assert.equal(resumed.currentPromptResolved, true);
  assert.equal(resumed.memories.length, state.memories.length + 3);
  assert.equal(resumed.memories.filter(memory => memory.isPermanentSlot).length, 3);
  assert.equal(resumed.characters.length, state.characters.length + 2);
  assert.equal(resumed.resources.length, state.resources.length + 2);
  assert.equal(resumed.skills.length, state.skills.length + 2);
  assert.deepEqual(resumed.promptVisitHistory, history);
  assert.deepEqual(resumed.promptAlternates, state.promptAlternates);
  const normalized = g.normalizeGameState(resumed);
  assert.equal(normalized.currentPromptId, 0);
  assert.deepEqual(g.normalizeGameState(normalized), normalized);
  assert.equal(g.getCurrentPrompt(normalized).requiredExperiences, 0);
  assert.equal(normalized.promptVisitHistory[0], undefined);
  const moved = g.rollMovement(normalized, 5, 1);
  assert.equal(moved.currentPromptId, 4);
  assert.equal(moved.lastRoll.from, 0);
  assert.equal(g.normalizeGameState(moved).lastRoll.from, 0);
  assert.throws(() => g.reduceMemoryCapacity({ ...moved, promptEditEnabled: true }, moved.memories.at(-1).id), /영구 기억 칸/);
});
