import { gamePrompts } from './data/prompts';
import { alternatePrompts } from './data/alternatePrompts';
import type { DiaryEntry, Experience, ForgottenMemory, GameState, Memory } from './types';

export const MEMORY_LIMIT = 5;
export const EXPERIENCE_LIMIT = 3;
export const DIARY_LIMIT = 4;
export const SCHEMA_VERSION = 2;

export class RuleError extends Error {
  constructor(message: string) { super(message); this.name = 'RuleError'; }
}

export interface CurrentPrompt {
  id: number;
  visit: number;
  entry: number;
  text: string;
  isAlternate: boolean;
  alternateId?: number;
  ending: 'required' | 'optional' | null;
  page: number;
  experienceRequired: boolean;
  requiredExperiences: number;
  seasonBreak: boolean;
}

function fail(message: string): never { throw new RuleError(message); }
const active = <T extends { isLost?: boolean }>(items: T[]) => items.filter(item => !item.isLost);
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const array = (value: unknown): Record<string, unknown>[] => Array.isArray(value)
  ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') : [];
const count = (value: unknown, fallback: number, minimum = 0) => typeof value === 'number' && Number.isFinite(value)
  ? Math.max(minimum, Math.floor(value)) : fallback;
const stamp = (state: GameState) => count(state.sequence, 1, 1);
const next = (state: GameState) => ({ ...state, sequence: stamp(state) + 1 });
const copyMemory = (memory: Memory): Memory => ({ ...memory, experiences: memory.experiences.map(exp => ({ ...exp })) });
const assertNotOver = (state: GameState) => { if (state.isGameOver) fail('이미 끝난 이야기입니다. 새 이야기로 시작하십시오.'); };
const assertPlaying = (state: GameState) => {
  if (!state.setupComplete) fail('먼저 흡혈귀 창조를 완료하십시오.');
  if (state.isGameOver) fail('이미 끝난 이야기입니다. 새 이야기로 시작하십시오.');
};
const requirePromptPermission = (state: GameState) => {
  assertNotOver(state);
  if (state.setupComplete && !state.promptEditEnabled) fail('이 변경은 사건이 명시적으로 허용할 때만 가능합니다. 사건 지시에 따른 수정 모드를 켜십시오.');
};

export function createInitialGameState(): GameState {
  return {
    schemaVersion: SCHEMA_VERSION, sequence: 1, turnCount: 0, season: 1, persistentRollMode: 'normal',
    currentPromptId: 1, promptVisitHistory: {},
    memories: Array.from({ length: MEMORY_LIMIT }, (_, i) => ({ id: `m${i + 1}`, experiences: [] })),
    diary: [], skills: [], resources: [], characters: [], marks: [], journal: [],
    isGameOver: false, gameOverText: '', characterName: '', vampireOrigin: '',
    setupComplete: false, playMode: 'journal', currentPromptResolved: false,
    experienceRecorded: false, experienceCount: 0, experienceWaived: false, promptEditEnabled: false,
    forgottenMemories: [], permanentMemories: [], diaryCapacity: DIARY_LIMIT,
    migrationNotes: [], promptAlternates: {}, nextRollMode: 'normal',
    isAltActive: false, activeAltIdx: null,
  };
}

export function validateSetup(state: GameState): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!state.characterName.trim()) errors.push('흡혈귀의 이름을 적으십시오.');
  if (!state.vampireOrigin.trim()) errors.push('필멸자 시절의 시대, 장소와 삶을 적으십시오.');
  if (state.memories.length !== MEMORY_LIMIT || state.memories.some(memory => memory.experiences.length !== 1 || !memory.experiences[0]?.text.trim())) errors.push('다섯 기억마다 경험을 정확히 하나씩 적으십시오.');
  if (active(state.skills).length !== 3 || active(state.skills).some(skill => !skill.name.trim() || skill.isChecked)) errors.push('체크하지 않은 기술을 정확히 세 가지 준비하십시오.');
  if (active(state.resources).filter(resource => !resource.isDiary).length !== 3 || active(state.resources).some(resource => !resource.name.trim())) errors.push('필멸자 시절 얻은 자원을 정확히 세 가지 준비하십시오.');
  if (state.characters.filter(character => character.type === 'mortal' && character.isAlive && character.name.trim()).length < 3) errors.push('살아 있는 필멸자 등장인물을 최소 세 명 준비하십시오.');
  if (state.characters.filter(character => character.type === 'immortal' && character.isAlive && character.name.trim()).length !== 1) errors.push('당신에게 불멸을 준 불멸자 한 명을 준비하십시오.');
  if (active(state.marks).length !== 1 || active(state.marks).some(mark => !mark.description.trim())) errors.push('불멸의 표식을 하나 준비하십시오.');
  if (active(state.diary).length) errors.push('시작 경험은 일기장이 아닌 다섯 기억에 있어야 합니다.');
  return { valid: errors.length === 0, errors };
}

export function startGame(state: GameState): GameState {
  assertNotOver(state);
  if (state.setupComplete) fail('이미 창조를 완료했습니다. 새 이야기를 시작하려면 새 기록을 만드십시오.');
  const result = validateSetup(state);
  if (!result.valid) fail(result.errors.join('\n'));
  return resolvePrompt({ ...state, setupComplete: true, promptVisitHistory: {}, isGameOver: false, gameOverText: '' }, 1);
}

function pageFor(state: GameState, id: number) {
  const alternateIndex = state.promptAlternates?.[id]
    ?? (id === state.currentPromptId && state.isAltActive ? state.activeAltIdx : undefined);
  const alternate = alternateIndex != null ? alternatePrompts[alternateIndex] : undefined;
  if (alternate) {
    const extended = alternate as typeof alternate & { entries?: string[]; page?: number; endingByVisit?: Record<number, 'required' | 'optional'> };
    return { ...extended, entries: extended.entries ?? [alternate.text], page: extended.page ?? 112, isAlternate: true, alternateId: alternate.id };
  }
  const regular = gamePrompts.find(prompt => prompt.id === id);
  if (!regular) fail('존재하지 않는 사건입니다.');
  return { ...regular, isAlternate: false, alternateId: undefined };
}

export function getCurrentPrompt(state: GameState): CurrentPrompt {
  if (state.currentPromptId === 0 && (state.season ?? 1) > 1) return { id: 0, visit: 0, entry: 0,
    text: '다음 천 년이 시작됩니다. 지난 사건의 방문 기록을 유지한 채 주사위를 굴려 새로운 밤으로 나아가십시오.',
    isAlternate: false, ending: null, page: 133, experienceRequired: false, requiredExperiences: 0, seasonBreak: false };
  const prompt = pageFor(state, state.currentPromptId);
  const visit = Math.max(1, state.promptVisitHistory[state.currentPromptId] ?? 1);
  const entry = Math.min(visit, prompt.entries.length);
  const explicit = (prompt as typeof prompt & { endingByVisit?: Record<number, 'required' | 'optional'> }).endingByVisit?.[entry];
  const ending = explicit ?? (!prompt.isAlternate && state.currentPromptId >= 72 ? 'required'
    : !prompt.isAlternate && state.currentPromptId === 69 && entry === 3 ? 'optional' : null);
  const fallbackExperienceRequired = !(!prompt.isAlternate && ((state.currentPromptId === 24 && entry === 2) || (state.currentPromptId === 37 && entry === 1) || (state.currentPromptId === 43 && entry === 2) || (state.currentPromptId === 54 && entry === 2)));
  const instructionCount = (prompt as typeof prompt & { experienceByVisit?: Record<number, number> }).experienceByVisit?.[entry];
  const requiredExperiences = instructionCount ?? (fallbackExperienceRequired ? 1 : 0);
  const experienceRequired = requiredExperiences > 0;
  return { id: state.currentPromptId, visit, entry, text: prompt.entries[entry - 1] ?? '', page: prompt.page,
    isAlternate: prompt.isAlternate, alternateId: prompt.alternateId, ending, experienceRequired, requiredExperiences, seasonBreak: !!(prompt as typeof prompt & { seasonBreak?: boolean }).seasonBreak };
}

/** Enter a page; fully used pages are passed over forwards regardless of movement direction. */
export function resolvePrompt(state: GameState, targetId: number, isAlternate = false): GameState {
  assertNotOver(state);
  if (!Number.isFinite(targetId)) fail('사건 번호가 올바르지 않습니다.');
  let id = Math.max(1, Math.min(80, Math.floor(targetId)));
  let prepared = state;
  if (isAlternate && state.activeAltIdx != null) prepared = {
    ...state, promptAlternates: { ...state.promptAlternates, [id]: state.activeAltIdx },
  };
  while (id <= 80 && (prepared.promptVisitHistory[id] ?? 0) >= pageFor(prepared, id).entries.length) id += 1;
  if (id > 80) fail('마지막 사건의 모든 항목을 이미 해결했습니다. 사건의 결말을 기록하십시오.');
  const altIndex = prepared.promptAlternates?.[id];
  const result: GameState = { ...prepared, currentPromptId: id,
    promptVisitHistory: { ...prepared.promptVisitHistory, [id]: (prepared.promptVisitHistory[id] ?? 0) + 1 },
    currentPromptResolved: false, experienceRecorded: false, experienceCount: 0, experienceWaived: false, promptEditEnabled: false,
    isAltActive: altIndex != null, activeAltIdx: altIndex ?? null };
  return { ...result, experienceWaived: !getCurrentPrompt(result).experienceRequired };
}

/** Replace this numbered page, preserving its visit number and future replacement entries. */
export function substitutePrompt(state: GameState, alternateIndex: number): GameState {
  assertPlaying(state);
  if (state.currentPromptResolved || state.experienceRecorded) fail('해결을 시작하기 전에 대체 사건을 선택하십시오.');
  if (!alternatePrompts[alternateIndex]) fail('존재하지 않는 대체 사건입니다.');
  const candidate = { ...state, promptAlternates: { ...state.promptAlternates, [state.currentPromptId]: alternateIndex },
    isAltActive: true, activeAltIdx: alternateIndex };
  const visit = state.promptVisitHistory[state.currentPromptId] ?? 1;
  if (visit > pageFor(candidate, state.currentPromptId).entries.length) fail('이 대체 사건에는 현재 방문에 해당하는 항목이 없습니다.');
  return { ...candidate, experienceWaived: !getCurrentPrompt(candidate).experienceRequired };
}

export function revertPrompt(state: GameState): GameState {
  assertPlaying(state);
  if (state.currentPromptResolved || state.experienceRecorded) fail('해결을 시작하기 전에 원래 사건으로 돌아가십시오.');
  const alternates = { ...state.promptAlternates };
  delete alternates[state.currentPromptId];
  const candidate = { ...state, promptAlternates: alternates, isAltActive: false, activeAltIdx: null };
  if ((state.promptVisitHistory[state.currentPromptId] ?? 1) > pageFor(candidate, state.currentPromptId).entries.length) fail('원래 사건의 항목은 모두 소진되었습니다.');
  return { ...candidate, experienceWaived: !getCurrentPrompt(candidate).experienceRequired };
}

/** Public selection uses the printed alternate number, rather than its array index. */
export function chooseAlternatePrompt(state: GameState, alternateId: number | null): GameState {
  if (alternateId === null) return revertPrompt(state);
  const index = alternatePrompts.findIndex(prompt => prompt.id === alternateId);
  if (index < 0) fail('존재하지 않는 대체 사건입니다.');
  return substitutePrompt(state, index);
}

export function rollMovement(state: GameState, d10: number, d6: number): GameState {
  assertPlaying(state);
  if (!state.currentPromptResolved) fail('현재 사건을 해결하고 경험을 기록한 뒤 주사위를 굴리십시오.');
  if (!Number.isInteger(d10) || d10 < 1 || d10 > 10 || !Number.isInteger(d6) || d6 < 1 || d6 > 6) fail('d10은 1–10, d6은 1–6이어야 합니다.');
  const mode = state.nextRollMode && state.nextRollMode !== 'normal' ? state.nextRollMode : state.persistentRollMode ?? 'normal';
  const offset = mode === 'reverse' ? d6 - d10 : mode === 'backward' ? -d6
    : mode === 'sum' ? d10 + d6 : d10 - d6;
  const target = Math.max(1, Math.min(80, state.currentPromptId + offset));
  const result = resolvePrompt(state, target);
  return { ...result, nextRollMode: 'normal', lastRoll: { d10, d6, offset, from: state.currentPromptId,
    to: result.currentPromptId, mode, skipped: Array.from({ length: result.currentPromptId - target }, (_, i) => target + i) } };
}

export function setExperienceWaived(state: GameState, waived: boolean): GameState {
  assertNotOver(state);
  if (waived && getCurrentPrompt(state).experienceRequired) requirePromptPermission(state);
  return { ...state, experienceWaived: waived };
}

export function addExperience(state: GameState, memoryId: string, value: string): GameState {
  assertNotOver(state);
  const memory = state.memories.find(item => item.id === memoryId);
  if (!memory) fail('기억 공간을 찾을 수 없습니다.');
  if (!value.trim()) fail('경험을 한 문장으로 적으십시오.');
  if (memory.isPermanent) fail('영구 보존한 기억은 바꿀 수 없습니다.');
  if (memory.experiences.length >= (memory.maxExperiences ?? EXPERIENCE_LIMIT)) fail('이 기억에는 더 이상 경험을 담을 수 없습니다. 기억 전체를 잊거나 일기장으로 옮기십시오.');
  if (state.setupComplete) {
    assertPlaying(state);
    if (state.currentPromptResolved) fail('이미 해결한 사건입니다. 다음 사건으로 이동하십시오.');
    const required = getCurrentPrompt(state).requiredExperiences;
    if ((state.experienceCount ?? (state.experienceRecorded ? 1 : 0)) >= required && !state.promptEditEnabled) fail('이 사건에 필요한 경험은 이미 기록했습니다. 추가 경험은 사건이 명시적으로 지시할 때만 만드십시오.');
  }
  return { ...next(state), memories: state.memories.map(item => item.id === memoryId
    ? { ...item, experiences: [...item.experiences, { id: `e-${stamp(state)}`, text: value.trim() }] } : item),
    experienceRecorded: state.setupComplete ? true : state.experienceRecorded,
    experienceCount: state.setupComplete ? (state.experienceCount ?? (state.experienceRecorded ? 1 : 0)) + 1 : state.experienceCount };
}

export function editExperience(state: GameState, memoryId: string, experienceId: string, value: string): GameState {
  requirePromptPermission(state);
  if (!value.trim()) fail('경험 내용을 적으십시오.');
  const memory = state.memories.find(item => item.id === memoryId);
  if (!memory || !memory.experiences.some(exp => exp.id === experienceId)) fail('경험을 찾을 수 없습니다.');
  if (memory.isPermanent) fail('영구 보존한 기억은 바꿀 수 없습니다.');
  return { ...state, memories: state.memories.map(item => item.id === memoryId ? { ...item,
    experiences: item.experiences.map(exp => exp.id === experienceId ? { ...exp, text: value.trim() } : exp) } : item) };
}

export function forgetMemory(state: GameState, memoryId: string, reason = '기억을 잊었습니다.', canRestore = true): GameState {
  assertNotOver(state);
  const memory = state.memories.find(item => item.id === memoryId);
  if (!memory || !memory.experiences.length) fail('잊을 기억이 없습니다.');
  if (memory.isPermanent) fail('영구 보존한 기억은 잊을 수 없습니다.');
  const forgotten: ForgottenMemory = { ...copyMemory(memory), id: `forgotten-${stamp(state)}`, forgottenAt: stamp(state), reason, canRestore };
  return { ...next(state), memories: state.memories.map(item => item.id === memoryId ? { ...item, experiences: [] } : item),
    forgottenMemories: [...(state.forgottenMemories ?? []), forgotten] };
}

export function archiveMemory(state: GameState, memoryId: string, description = '일기장 — 세월의 기록'): GameState {
  assertNotOver(state);
  if (!state.setupComplete) fail('창조를 완료한 뒤 기억을 일기장으로 옮길 수 있습니다.');
  const memory = state.memories.find(item => item.id === memoryId);
  if (!memory?.experiences.length) fail('빈 기억은 일기장으로 옮길 수 없습니다.');
  if (memory.isPermanent) fail('영구 보존한 기억은 옮길 수 없습니다.');
  const diaryCapacity = state.diaryCapacity ?? DIARY_LIMIT;
  if (state.diary.filter(entry => !entry.isLost && (!entry.resourceId || entry.resourceId === state.diaryResourceId)).length >= diaryCapacity) fail(diaryCapacity === DIARY_LIMIT
    ? '일기장은 네 기억까지 보관합니다. 기존 일기장 기억을 잊어 공간을 만드십시오.'
    : `현재 일기장은 기억 ${diaryCapacity}개까지 보관합니다. 기존 기억을 잊어 공간을 만드십시오.`);
  const existing = state.resources.find(resource => resource.id === state.diaryResourceId && !resource.isLost);
  const resourceId = existing?.id ?? `diary-resource-${stamp(state)}`;
  const entry: DiaryEntry = { id: `d-${stamp(state)}`, originalMemoryId: memoryId,
    experiences: memory.experiences.map(exp => ({ ...exp })), timestamp: stamp(state), resourceId,
    maxExperiences: memory.maxExperiences };
  return { ...next(state), diaryResourceId: resourceId,
    resources: existing ? state.resources : [...state.resources, { id: resourceId, name: description.trim() || '일기장', isStationary: false, isDiary: true }],
    diary: [...state.diary, entry], memories: state.memories.map(item => item.id === memoryId ? { ...item, experiences: [] } : item) };
}

export function forgetDiaryMemory(state: GameState, diaryId: string): GameState {
  assertNotOver(state);
  const entry = state.diary.find(item => item.id === diaryId && !item.isLost);
  if (!entry) fail('사용 가능한 일기장 기억이 없습니다.');
  const result = { ...state, diary: state.diary.map(item => item.id === diaryId ? { ...item, isLost: true, isForgotten: true } : item) };
  return result.diary.some(item => !item.isLost && item.resourceId === entry.resourceId) ? result : loseDiary(result, entry.resourceId);
}

/** Recollection is a Prompt exception, never a free capacity shortcut. */
export function restoreDiaryMemory(state: GameState, diaryId: string, memoryId: string): GameState {
  requirePromptPermission(state);
  const entry = state.diary.find(item => item.id === diaryId && !item.isLost);
  const memory = state.memories.find(item => item.id === memoryId);
  if (!entry || !memory) fail('일기장 기억이나 대상 기억 공간을 찾을 수 없습니다.');
  if (memory.experiences.length) fail('되찾을 기억을 담을 빈 기억 공간이 필요합니다.');
  if (entry.experiences.length > (memory.maxExperiences ?? EXPERIENCE_LIMIT)) fail('되찾을 기억이 대상 공간보다 큽니다.');
  const result = { ...state, diary: state.diary.map(item => item.id === diaryId ? { ...item, isLost: true, isForgotten: true } : item),
    memories: state.memories.map(item => item.id === memoryId ? { ...item, experiences: entry.experiences.map(exp => ({ ...exp })) } : item) };
  return result.diary.some(item => !item.isLost && item.resourceId === entry.resourceId) ? result : loseDiary(result, entry.resourceId);
}

/** Appendix 45.2 returns pages from an old lost Diary to the current book, retaining the old record. */
export function recoverLostDiaryMemory(state: GameState, diaryId: string): GameState {
  requirePromptPermission(state);
  const entry = state.diary.find(item => item.id === diaryId && item.isLost && !item.isForgotten && !item.recoveredToId);
  if (!entry?.experiences.length) fail('잃어버린 일기장에서 되찾을 기억을 선택하십시오.');
  const capacity = state.diaryCapacity ?? DIARY_LIMIT;
  const stored = state.diary.filter(item => !item.isLost && item.resourceId === state.diaryResourceId).length;
  if (stored >= capacity) fail(`현재 일기장의 기억 용량은 ${capacity}개입니다. 사건 지시에 따라 용량을 늘리거나 빈자리를 만드십시오.`);
  const currentDiary = state.resources.find(resource => resource.id === state.diaryResourceId && !resource.isLost && !resource.isExtraDiary);
  const id = currentDiary?.id ?? `diary-resource-${stamp(state)}`;
  const recoveredId = `recovered-diary-${stamp(state)}`;
  return { ...next(state), diaryResourceId: id,
    resources: currentDiary ? state.resources : [...state.resources, { id, name: '일기장 — 되찾은 페이지들', isStationary: false, isDiary: true }],
    diary: [...state.diary.map(item => item.id === diaryId ? { ...item, recoveredToId: recoveredId } : item), { ...entry, id: recoveredId, resourceId: id, isLost: false, isForgotten: false,
      experiences: entry.experiences.map(exp => ({ ...exp })), timestamp: stamp(state) }] };
}

export function restoreForgottenMemory(state: GameState, forgottenId: string, memoryId: string): GameState {
  requirePromptPermission(state);
  const forgotten = state.forgottenMemories?.find(item => item.id === forgottenId);
  const memory = state.memories.find(item => item.id === memoryId);
  if (!forgotten || !memory) fail('되찾을 기억이나 빈 기억 공간을 찾을 수 없습니다.');
  if (forgotten.canRestore === false) fail('이 기억은 사건의 지시로 영원히 지워졌습니다.');
  if (memory.experiences.length) fail('되찾을 기억을 담을 빈 기억 공간이 필요합니다.');
  if (forgotten.experiences.length > (memory.maxExperiences ?? EXPERIENCE_LIMIT)) fail('되찾을 기억이 대상 공간보다 큽니다.');
  return { ...state, memories: state.memories.map(item => item.id === memoryId
    ? { ...item, experiences: forgotten.experiences.map(exp => ({ ...exp })) } : item),
    forgottenMemories: state.forgottenMemories?.filter(item => item.id !== forgottenId) };
}

export function loseDiary(state: GameState, resourceId = state.diaryResourceId): GameState {
  assertNotOver(state);
  const id = resourceId;
  if (!id) return state;
  return { ...state, diary: state.diary.map(entry => !entry.isLost && (!id || !entry.resourceId || entry.resourceId === id) ? { ...entry, isLost: true } : entry),
    resources: state.resources.map(resource => resource.id === id || (!id && resource.isDiary && !resource.isExtraDiary) ? { ...resource, isLost: true } : resource),
    diaryResourceId: id === state.diaryResourceId ? undefined : state.diaryResourceId };
}

export function checkSkill(state: GameState, id?: string, fallbackResourceId?: string): GameState {
  assertNotOver(state);
  const available = state.skills.filter(skill => !skill.isLost && !skill.isChecked);
  const skill = id ? available.find(item => item.id === id) : available[0];
  if (available.length && !skill) fail('이미 체크했거나 잃은 기술은 다시 체크할 수 없습니다.');
  if (skill) return { ...state, skills: state.skills.map(item => item.id === skill.id ? { ...item, isChecked: true } : item) };
  const resources = active(state.resources);
  if (!resources.length) return endGame(state, '체크할 기술도 잃을 자원도 없습니다. 현재 사건을 바탕으로 흡혈귀의 최후를 기록하십시오.');
  const resource = fallbackResourceId ? resources.find(item => item.id === fallbackResourceId) : resources[0];
  if (!resource) fail('대신 잃을 자원을 선택하십시오.');
  return removeResource(state, resource.id);
}

function removeResource(state: GameState, id: string): GameState {
  const resource = state.resources.find(item => item.id === id && !item.isLost);
  if (!resource) fail('사용 가능한 자원을 찾을 수 없습니다.');
  if (resource.isDiary || id === state.diaryResourceId) return loseDiary(state, resource.id);
  return { ...state, resources: state.resources.map(item => item.id === id ? { ...item, isLost: true } : item) };
}

export function loseResource(state: GameState, id?: string, fallbackSkillId?: string): GameState {
  assertNotOver(state);
  const resources = active(state.resources);
  const resource = id ? resources.find(item => item.id === id) : resources[0];
  if (resources.length && !resource) fail('이미 잃었거나 없는 자원은 사용할 수 없습니다.');
  if (resource) return removeResource(state, resource.id);
  const available = state.skills.filter(skill => !skill.isLost && !skill.isChecked);
  if (!available.length) return endGame(state, '잃을 자원도 체크할 기술도 없습니다. 현재 사건을 바탕으로 흡혈귀의 최후를 기록하십시오.');
  return checkSkill(state, fallbackSkillId ?? available[0].id);
}

export function restoreResource(state: GameState, id: string): GameState {
  requirePromptPermission(state);
  const resource = state.resources.find(item => item.id === id && item.isLost);
  if (!resource) fail('되찾을 자원이 없습니다.');
  if (resource.isDiary) {
    if (!resource.isExtraDiary && state.resources.some(item => item.isDiary && !item.isExtraDiary && !item.isLost)) fail('이미 한 권의 일기장이 있습니다.');
    const entries = state.diary.filter(entry => entry.resourceId === id && !entry.isForgotten && !entry.recoveredToId);
    if (!entries.length) fail('이 일기장에는 기억이 없습니다.');
    if (entries.length > (resource.isExtraDiary ? resource.diaryCapacity ?? 1 : state.diaryCapacity ?? DIARY_LIMIT)) fail('일기장의 기억이 허용량을 초과합니다.');
    return { ...state, diaryResourceId: resource.isExtraDiary ? state.diaryResourceId : id, diary: state.diary.map(entry => entry.resourceId === id && !entry.isForgotten && !entry.recoveredToId ? { ...entry, isLost: false } : entry),
      resources: state.resources.map(item => item.id === id ? { ...item, isLost: false } : item) };
  }
  return { ...state, resources: state.resources.map(item => item.id === id ? { ...item, isLost: false } : item) };
}

export function loseSkill(state: GameState, id?: string): GameState {
  assertNotOver(state);
  const available = active(state.skills);
  if (!available.length) return endGame(state, '잃어야 할 기술이 남아 있지 않습니다. 현재 사건을 바탕으로 최후를 기록하십시오.');
  const skill = id ? available.find(item => item.id === id) : available[0];
  if (!skill) fail('잃을 기술을 선택하십시오.');
  return { ...state, skills: state.skills.map(item => item.id === skill.id ? { ...item, isLost: true } : item) };
}

export function restoreSkill(state: GameState, id: string): GameState {
  requirePromptPermission(state);
  if (!state.skills.some(skill => skill.id === id && skill.isLost)) fail('되찾을 기술이 없습니다.');
  return { ...state, skills: state.skills.map(skill => skill.id === id ? { ...skill, isLost: false } : skill) };
}

export function uncheckSkill(state: GameState, id: string): GameState {
  requirePromptPermission(state);
  if (!state.skills.some(skill => skill.id === id && !skill.isLost && skill.isChecked)) fail('체크를 해제할 기술이 없습니다.');
  return { ...state, skills: state.skills.map(skill => skill.id === id ? { ...skill, isChecked: false } : skill) };
}

export function loseMark(state: GameState, id: string): GameState {
  requirePromptPermission(state);
  if (!state.marks.some(mark => mark.id === id && !mark.isLost)) fail('잃을 표식이 없습니다.');
  return { ...state, marks: state.marks.map(mark => mark.id === id ? { ...mark, isLost: true } : mark) };
}
export function restoreMark(state: GameState, id: string): GameState {
  requirePromptPermission(state);
  if (!state.marks.some(mark => mark.id === id && mark.isLost)) fail('되찾을 표식이 없습니다.');
  return { ...state, marks: state.marks.map(mark => mark.id === id ? { ...mark, isLost: false } : mark) };
}

/** Use only when the selected Prompt directs leaving stationary assets behind. */
export function travel(state: GameState): GameState {
  assertNotOver(state);
  let result = state;
  for (const resource of state.resources.filter(item => item.isStationary && !item.isLost)) result = removeResource(result, resource.id);
  return result;
}
export function ageMortals(state: GameState): GameState {
  assertNotOver(state);
  return { ...state, characters: state.characters.map(character => character.type === 'mortal' && !character.isAgeless ? { ...character, isAlive: false } : character) };
}

export function reduceMemoryCapacity(state: GameState, memoryId: string): GameState {
  requirePromptPermission(state);
  const memory = state.memories.find(item => item.id === memoryId);
  if (!memory) fail('잃을 기억 공간이 없습니다.');
  if (memory.isPermanentSlot) fail('이 공간은 다음 시즌을 위해 얻은 영구 기억 칸이므로 잃을 수 없습니다.');
  const result = memory.experiences.length ? forgetMemory(state, memoryId, '사건 지시로 기억 공간을 잃었습니다.') : state;
  return { ...result, memories: result.memories.filter(item => item.id !== memoryId) };
}
export function addMemorySlot(state: GameState, label = ''): GameState {
  requirePromptPermission(state);
  return { ...next(state), memories: [...state.memories, { id: `m-${stamp(state)}`, experiences: [], label }] };
}
export function preserveMemory(state: GameState, memoryId: string): GameState {
  requirePromptPermission(state);
  const memory = state.memories.find(item => item.id === memoryId);
  if (!memory?.experiences.length) fail('영구 보존할 기억이 없습니다.');
  return { ...next(state), permanentMemories: [...(state.permanentMemories ?? []), { ...copyMemory(memory), id: `permanent-${stamp(state)}`, isPermanent: true }],
    memories: state.memories.map(item => item.id === memoryId ? { ...item, experiences: [] } : item) };
}
export function preserveDiaryMemory(state: GameState, diaryId: string): GameState {
  requirePromptPermission(state);
  const entry = state.diary.find(item => item.id === diaryId && !item.isLost);
  if (!entry) fail('영구 보존할 일기장 기억이 없습니다.');
  const result = { ...next(state), permanentMemories: [...(state.permanentMemories ?? []), {
    id: `permanent-${stamp(state)}`, experiences: entry.experiences.map(exp => ({ ...exp })), isPermanent: true }],
    diary: state.diary.map(item => item.id === diaryId ? { ...item, isLost: true, isForgotten: true } : item) };
  return result.diary.some(item => !item.isLost && item.resourceId === entry.resourceId) ? result : loseDiary(result, entry.resourceId);
}

export function editDiaryExperience(state: GameState, diaryId: string, experienceId: string, value: string): GameState {
  requirePromptPermission(state);
  const entry = state.diary.find(item => item.id === diaryId && !item.isLost);
  if (!entry || !entry.experiences.some(exp => exp.id === experienceId)) fail('수정할 일기장 경험이 없습니다.');
  if (!value.trim()) fail('경험 내용을 적으십시오.');
  return { ...state, diary: state.diary.map(item => item.id === diaryId ? { ...item,
    experiences: item.experiences.map(exp => exp.id === experienceId ? { ...exp, text: value.trim() } : exp) } : item) };
}

export function setMemoryCapacity(state: GameState, memoryId: string, capacity: number): GameState {
  requirePromptPermission(state);
  const memory = state.memories.find(item => item.id === memoryId);
  if (!memory) fail('수정할 기억 공간이 없습니다.');
  if (!Number.isInteger(capacity) || capacity < 1 || capacity < memory.experiences.length) fail('경험을 지우지 않고 담을 수 있는 양의 정수 용량을 지정하십시오.');
  return { ...state, memories: state.memories.map(item => item.id === memoryId ? { ...item, maxExperiences: capacity } : item) };
}

export function setMemoryLabel(state: GameState, memoryId: string, label: string): GameState {
  requirePromptPermission(state);
  if (!state.memories.some(item => item.id === memoryId)) fail('수정할 기억 공간이 없습니다.');
  return { ...state, memories: state.memories.map(item => item.id === memoryId ? { ...item, label: label.trim() } : item) };
}

export function setDiaryCapacity(state: GameState, capacity: number): GameState {
  requirePromptPermission(state);
  const stored = state.diary.filter(entry => !entry.isLost && entry.resourceId === state.diaryResourceId).length;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity < stored) fail('기억을 지우지 않고 담을 수 있는 양의 정수 용량을 지정하십시오.');
  return { ...state, diaryCapacity: capacity };
}

export function deleteExperience(state: GameState, memoryId: string, experienceId: string): GameState {
  requirePromptPermission(state);
  const memory = state.memories.find(item => item.id === memoryId);
  if (!memory?.experiences.some(exp => exp.id === experienceId)) fail('지울 경험이 없습니다.');
  if (memory.isPermanent) fail('영구 보존한 기억은 바꿀 수 없습니다.');
  return { ...state, memories: state.memories.map(item => item.id === memoryId ? { ...item,
    experiences: item.experiences.filter(exp => exp.id !== experienceId) } : item) };
}

export function deleteDiaryExperience(state: GameState, diaryId: string, experienceId: string): GameState {
  requirePromptPermission(state);
  const entry = state.diary.find(item => item.id === diaryId && !item.isLost);
  if (!entry?.experiences.some(exp => exp.id === experienceId)) fail('지울 일기장 경험이 없습니다.');
  if (entry.experiences.length === 1) return forgetDiaryMemory(state, diaryId);
  return { ...state, diary: state.diary.map(item => item.id === diaryId ? { ...item,
    experiences: item.experiences.filter(exp => exp.id !== experienceId) } : item) };
}

/** Appendix 51.2 permits combining two slots even beyond the ordinary three-Experience limit. */
export function mergeMemories(state: GameState, sourceId: string, targetId: string): GameState {
  requirePromptPermission(state);
  if (sourceId === targetId) fail('서로 다른 두 기억을 선택하십시오.');
  const source = state.memories.find(item => item.id === sourceId);
  const target = state.memories.find(item => item.id === targetId);
  if (!source?.experiences.length || !target?.experiences.length) fail('각각 경험이 있는 두 기억을 선택하십시오.');
  if (source.isPermanent || target.isPermanent) fail('영구 보존한 기억은 바꿀 수 없습니다.');
  const combined = [...target.experiences, ...source.experiences].map(exp => ({ ...exp }));
  return { ...state, memories: state.memories.map(item => item.id === sourceId ? { ...item, experiences: [] }
    : item.id === targetId ? { ...item, experiences: combined,
      maxExperiences: Math.max(target.maxExperiences ?? EXPERIENCE_LIMIT, combined.length) } : item) };
}

export function setCharacterAgeless(state: GameState, characterId: string, value = true): GameState {
  requirePromptPermission(state);
  if (!state.characters.some(character => character.id === characterId && character.type === 'mortal')) fail('필멸자 등장인물을 선택하십시오.');
  return { ...state, characters: state.characters.map(character => character.id === characterId ? { ...character, isAgeless: value } : character) };
}

/** A newly remembered Experience may be written straight into a Diary only when instructed. */
export function addDiaryMemory(state: GameState, value: string, description = '일기장 — 세월의 기록'): GameState {
  requirePromptPermission(state);
  if (!value.trim()) fail('일기장에 적을 경험을 입력하십시오.');
  const temporaryId = `temporary-${stamp(state)}`;
  const prepared = { ...next(state), memories: [...state.memories,
    { id: temporaryId, experiences: [{ id: `e-${stamp(state)}`, text: value.trim() }] }] };
  const result = archiveMemory(prepared, temporaryId, description);
  return { ...result, memories: result.memories.filter(memory => memory.id !== temporaryId),
    experienceRecorded: true, experienceCount: (state.experienceCount ?? (state.experienceRecorded ? 1 : 0)) + 1 };
}

/** Appendix 75.3 grants a separate book holding exactly its one newly written Memory. */
export function createExtraDiaryMemory(state: GameState, value: string, description = '잊힌 삶을 기록한 책'): GameState {
  requirePromptPermission(state);
  if (!value.trim()) fail('책에 적힌 새 기억을 입력하십시오.');
  const id = `extra-diary-${stamp(state)}`;
  return { ...next(state), resources: [...state.resources, { id, name: description.trim() || '별도의 책',
    isDiary: true, isExtraDiary: true, diaryCapacity: 1, isStationary: false }],
    diary: [...state.diary, { id: `d-${stamp(state)}`, originalMemoryId: '', resourceId: id,
      experiences: [{ id: `e-${stamp(state)}`, text: value.trim() }], timestamp: stamp(state) }] };
}

export function burnMemory(_state: GameState, _memoryId: string): GameState {
  return fail('제공된 룰북에는 기억을 태워 고대 기술을 얻는 규칙이 없습니다.');
}
export function endGame(state: GameState, reason: string): GameState {
  return { ...state, isGameOver: true, gameOverText: reason, currentPromptResolved: true };
}

export function completePrompt(state: GameState, journalText = '', endOptional = false): GameState {
  assertPlaying(state);
  if (state.currentPromptResolved) fail('이미 기록한 사건입니다.');
  const prompt = getCurrentPrompt(state);
  const recorded = state.experienceCount ?? (state.experienceRecorded ? 1 : 0);
  if (recorded < prompt.requiredExperiences && !state.experienceWaived) fail(prompt.requiredExperiences > 1
    ? `이 사건은 경험 ${prompt.requiredExperiences}개를 기록해야 합니다. 현재 ${recorded}개입니다.`
    : '사건의 결과를 경험 한 문장으로 기억에 먼저 기록하십시오.');
  if (state.playMode === 'journal' && !journalText.trim()) fail('기록형에서는 사건에 대한 연대기를 적으십시오.');
  const roll = state.lastRoll;
  const rollDescription = !roll ? '첫 사건' : roll.mode === 'reverse' ? `d6(${roll.d6}) − d10(${roll.d10}) = ${roll.offset}`
    : roll.mode === 'backward' ? `−d6(${roll.d6}) = ${roll.offset}`
    : roll.mode === 'sum' ? `d10(${roll.d10}) + d6(${roll.d6}) = ${roll.offset}`
    : `d10(${roll.d10}) − d6(${roll.d6}) = ${roll.offset}`;
  const result: GameState = { ...next(state), turnCount: (state.turnCount ?? state.journal.length) + 1, currentPromptResolved: true, promptEditEnabled: false,
    journal: state.playMode === 'quick' ? state.journal : [{ id: `j-${stamp(state)}`, promptId: prompt.id,
      visitCount: prompt.visit, rollText: rollDescription,
      dateString: `기록 ${state.journal.length + 1}`, textContent: journalText.trim(), timestamp: stamp(state),
      isAlternate: prompt.isAlternate, ...(prompt.alternateId ? { alternateId: prompt.alternateId } : {}) }, ...state.journal] };
  return prompt.ending === 'required' || (prompt.ending === 'optional' && endOptional) ? endGame(result, prompt.text) : result;
}

export interface NextSeasonTraits { mortals: string[]; resources: string[]; skills: string[] }

/** The fifth alternate ending resumes the same vampire at Prompt 0 with every used entry preserved. */
export function startNextSeason(state: GameState, traits: NextSeasonTraits): GameState {
  if (!traits || typeof traits !== 'object') fail('필멸자 둘, 자원 둘, 기술 둘을 입력하십시오.');
  if (!state.setupComplete || !state.isGameOver || !state.currentPromptResolved || !getCurrentPrompt(state).seasonBreak) {
    fail('다음 천 년의 평화라는 대체 결말을 기록한 뒤에만 다음 시즌을 시작할 수 있습니다.');
  }
  for (const [name, values] of Object.entries(traits)) {
    if (!Array.isArray(values) || values.length !== 2 || values.some(value => typeof value !== 'string' || !value.trim())) fail('다음 시즌에는 필멸자 둘, 자원 둘, 기술 둘을 각각 준비하십시오.');
    if (!['mortals', 'resources', 'skills'].includes(name)) fail('다음 시즌의 특성 형식이 올바르지 않습니다.');
  }
  if (!traits.mortals || !traits.resources || !traits.skills) fail('필멸자 둘, 자원 둘, 기술 둘이 필요합니다.');
  if (traits.resources.some(name => !name.replace(/^\[정착\]\s*/, '').trim())) fail('새 자원의 이름을 입력하십시오.');
  const season = (state.season ?? 1) + 1;
  const sequence = stamp(state);
  return { ...state, sequence: sequence + 9, season, currentPromptId: 0,
    currentPromptResolved: true, isGameOver: false, gameOverText: '',
    isAltActive: false, activeAltIdx: null, experienceRecorded: false, experienceCount: 0,
    experienceWaived: true, promptEditEnabled: false, lastRoll: undefined,
    memories: [...state.memories, ...Array.from({ length: 3 }, (_, i) => ({
      id: `season-memory-${sequence + i}`, label: `시즌 ${season} · 영구 기억 칸`, experiences: [], isPermanentSlot: true }))],
    characters: [...state.characters, ...traits.mortals.map((name, i) => ({
      id: `season-character-${sequence + 3 + i}`, name: name.trim(), type: 'mortal' as const, isAlive: true }))],
    resources: [...state.resources, ...traits.resources.map((name, i) => ({
      id: `season-resource-${sequence + 5 + i}`, name: name.replace(/^\[정착\]\s*/, '').trim(), isStationary: name.startsWith('[정착]') }))],
    skills: [...state.skills, ...traits.skills.map((name, i) => ({
      id: `season-skill-${sequence + 7 + i}`, name: name.trim(), isChecked: false }))],
  };
}

/** Validate untrusted cloud/import/local saves without silently destroying legacy records. */
export function normalizeGameState(input: unknown): GameState {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('게임 저장 파일의 형식이 올바르지 않습니다.');
  const raw = input as Record<string, unknown>;
  const initial = createInitialGameState();
  const notes = Array.isArray(raw.migrationNotes) ? raw.migrationNotes.filter((note): note is string => typeof note === 'string') : [];
  const experiences = (value: unknown, prefix: string): Experience[] => array(value).map((exp, i) => ({ id: text(exp.id, `${prefix}-e${i}`), text: text(exp.text) }));
  const memories = array(raw.memories).map((memory, i): Memory => ({ id: text(memory.id, `m${i + 1}`), experiences: experiences(memory.experiences, `m${i + 1}`),
    ...(typeof memory.maxExperiences === 'number' ? { maxExperiences: count(memory.maxExperiences, EXPERIENCE_LIMIT, 1) } : {}),
    ...(typeof memory.label === 'string' ? { label: memory.label } : {}), ...(memory.isPermanent ? { isPermanent: true } : {}), ...(memory.isPermanentSlot ? { isPermanentSlot: true } : {}) }));
  const skills = array(raw.skills).map((skill, i) => ({ id: text(skill.id, `s${i}`), name: text(skill.name), isChecked: !!skill.isChecked,
    isLost: !!skill.isLost, ...(skill.isAncient ? { isAncient: true } : {}) }));
  const resources = array(raw.resources).map((resource, i) => ({ id: text(resource.id, `r${i}`), name: text(resource.name),
    isStationary: !!resource.isStationary, isLost: !!resource.isLost, isDiary: !!resource.isDiary,
    isExtraDiary: !!resource.isExtraDiary, ...(typeof resource.diaryCapacity === 'number' ? { diaryCapacity: count(resource.diaryCapacity, 1, 1) } : {}) }));
  const diary = array(raw.diary).map((entry, i): DiaryEntry => ({ id: text(entry.id, `d${i}`), originalMemoryId: text(entry.originalMemoryId),
    experiences: experiences(entry.experiences, `d${i}`), timestamp: count(entry.timestamp, i), isLost: !!entry.isLost || !!entry.isForgotten, isForgotten: !!entry.isForgotten,
    ...(typeof entry.resourceId === 'string' ? { resourceId: entry.resourceId } : {}),
    ...(typeof entry.recoveredToId === 'string' ? { recoveredToId: entry.recoveredToId } : {}),
    ...(typeof entry.maxExperiences === 'number' ? { maxExperiences: count(entry.maxExperiences, 3, 1) } : {}) }));
  const history: Record<number, number> = {};
  if (raw.promptVisitHistory && typeof raw.promptVisitHistory === 'object') for (const [id, value] of Object.entries(raw.promptVisitHistory)) {
    const number = Number(id);
    if (Number.isInteger(number) && number >= 1 && number <= 80) history[number] = count(value, 0);
  }
  const alternates: Record<number, number> = {};
  if (raw.promptAlternates && typeof raw.promptAlternates === 'object') for (const [id, value] of Object.entries(raw.promptAlternates)) {
    const number = Number(id);
    if (Number.isInteger(number) && number >= 1 && number <= 80 && typeof value === 'number' && alternatePrompts[value]) alternates[number] = value;
  }
  const allocatedIds = [...memories, ...diary, ...skills, ...resources, ...array(raw.characters), ...array(raw.marks),
    ...array(raw.journal), ...array(raw.forgottenMemories), ...array(raw.permanentMemories),
    ...memories.flatMap(memory => memory.experiences), ...diary.flatMap(entry => entry.experiences)];
  const reservedSequence = Math.max(1, ...allocatedIds.map(item => {
    const suffix = Number(text(item.id).split('-').at(-1));
    return Number.isSafeInteger(suffix) && suffix >= 0 && suffix < Number.MAX_SAFE_INTEGER ? suffix + 1 : 1;
  }));
  const hasSchema = raw.schemaVersion === SCHEMA_VERSION;
  const state: GameState = { ...initial, schemaVersion: SCHEMA_VERSION,
    sequence: Math.max(reservedSequence, count(raw.sequence, reservedSequence, 1)),
    characterName: text(raw.characterName), vampireOrigin: text(raw.vampireOrigin),
    currentPromptId: raw.currentPromptId === 0 && count(raw.season, 1, 1) > 1 ? 0 : Math.min(80, count(raw.currentPromptId, 1, 1)), promptVisitHistory: history,
    memories: Array.isArray(raw.memories) ? memories : initial.memories, diary, skills, resources,
    characters: array(raw.characters).map((character, i) => ({ id: text(character.id, `c${i}`), name: text(character.name),
      type: character.type === 'immortal' ? 'immortal' : 'mortal', isAlive: character.isAlive !== false, isAgeless: !!character.isAgeless,
      ...(typeof character.relationship === 'string' ? { relationship: character.relationship } : {}) })),
    marks: array(raw.marks).map((mark, i) => ({ id: text(mark.id, `mark${i}`), description: text(mark.description), isLost: !!mark.isLost })),
    journal: array(raw.journal).map((entry, i) => ({ id: text(entry.id, `j${i}`), promptId: Math.min(80, count(entry.promptId, 1, 1)),
      visitCount: count(entry.visitCount, 1, 1), rollText: text(entry.rollText), dateString: text(entry.dateString), textContent: text(entry.textContent),
      timestamp: count(entry.timestamp, i), isAlternate: !!entry.isAlternate,
      ...(typeof entry.alternateId === 'number' ? { alternateId: entry.alternateId } : {}) })),
    setupComplete: typeof raw.setupComplete === 'boolean' ? raw.setupComplete : !!text(raw.characterName),
    playMode: raw.playMode === 'quick' ? 'quick' : 'journal', season: count(raw.season, 1, 1), turnCount: count(raw.turnCount, array(raw.journal).length),
    persistentRollMode: raw.persistentRollMode === 'reverse' ? 'reverse' : 'normal',
    currentPromptResolved: !!raw.currentPromptResolved, experienceRecorded: !!raw.experienceRecorded, experienceCount: count(raw.experienceCount, raw.experienceRecorded ? 1 : 0),
    experienceWaived: !!raw.experienceWaived, promptEditEnabled: false,
    isGameOver: !!raw.isGameOver, gameOverText: text(raw.gameOverText),
    diaryCapacity: count(raw.diaryCapacity, DIARY_LIMIT, 1), migrationNotes: notes, promptAlternates: alternates,
    forgottenMemories: array(raw.forgottenMemories).map((memory, i): ForgottenMemory => ({ id: text(memory.id, `forgotten${i}`),
      experiences: experiences(memory.experiences, `forgotten${i}`), forgottenAt: count(memory.forgottenAt, i), reason: text(memory.reason), canRestore: memory.canRestore !== false })),
    permanentMemories: array(raw.permanentMemories).map((memory, i) => ({ id: text(memory.id, `permanent${i}`),
      experiences: experiences(memory.experiences, `permanent${i}`), isPermanent: true })),
    nextRollMode: raw.nextRollMode === 'reverse' || raw.nextRollMode === 'backward' || raw.nextRollMode === 'sum' ? raw.nextRollMode : 'normal',
  };
  const savedDiaryId = text(raw.diaryResourceId);
  let diaryResource = resources.find(resource => resource.id === savedDiaryId && !resource.isLost)
    ?? resources.find(resource => resource.isDiary && !resource.isExtraDiary && !resource.isLost);
  if (diary.some(entry => !entry.isLost && (!entry.resourceId || !resources.some(resource => resource.id === entry.resourceId && resource.isExtraDiary))) && !diaryResource) {
    diaryResource = { id: `migrated-diary-${stamp(state)}`, name: '일기장 — 이전 기록에서 복구', isDiary: true, isExtraDiary: false, isStationary: false, isLost: false };
    state.resources = [...state.resources, diaryResource];
    state.sequence = stamp(state) + 1;
    notes.push('이전 저장의 일기장을 자원 목록에 연결했습니다.');
  }
  if (diaryResource) {
    state.diaryResourceId = diaryResource.id;
    state.resources = state.resources.map(resource => resource.id === diaryResource.id ? { ...resource, isDiary: true } : resource);
    state.diary = state.diary.map(entry => !entry.isLost && !entry.resourceId ? { ...entry, resourceId: diaryResource.id } : entry);
  }
  if (memories.some(memory => memory.experiences.length > (memory.maxExperiences ?? EXPERIENCE_LIMIT))) notes.push('이전 저장에서 경험 한도가 넘는 기억을 보존했습니다. 사건 예외가 없다면 기억을 정리하십시오.');
  if (state.diary.filter(entry => !entry.isLost && entry.resourceId === state.diaryResourceId).length > (state.diaryCapacity ?? DIARY_LIMIT)) notes.push('이전 저장의 일기장에 네 개를 넘는 기억이 있습니다. 기록을 보존했으며, 허용량 이하로 정리하기 전에는 더 보관할 수 없습니다.');
  if (skills.some(skill => skill.isAncient) && !hasSchema) notes.push('이전 고대 기술 표기는 보존했습니다. 제공된 룰북에 없는 효과는 적용하지 않습니다.');
  const legacyAlternate = count(raw.activeAltIdx, -1);
  if (!hasSchema && raw.isAltActive) notes.push('이전 대체 사건의 번호 체계가 잘못되어 본래 사건으로 복귀했습니다. 기존 연대기는 보존했습니다.');
  if (hasSchema && raw.isAltActive && alternatePrompts[legacyAlternate]) {
    state.promptAlternates = { ...state.promptAlternates, [state.currentPromptId]: legacyAlternate };
  }
  state.activeAltIdx = state.promptAlternates?.[state.currentPromptId] ?? null;
  state.isAltActive = state.activeAltIdx !== null;
  if (state.setupComplete && state.currentPromptId > 0 && !state.promptVisitHistory[state.currentPromptId]) state.promptVisitHistory[state.currentPromptId] = 1;
  if (raw.lastRoll && typeof raw.lastRoll === 'object') {
    const roll = raw.lastRoll as Record<string, unknown>;
    if (typeof roll.d10 === 'number' && typeof roll.d6 === 'number' && roll.d10 >= 1 && roll.d10 <= 10 && roll.d6 >= 1 && roll.d6 <= 6) {
      state.lastRoll = { d10: roll.d10, d6: roll.d6, mode: roll.mode === 'reverse' || roll.mode === 'backward' || roll.mode === 'sum' ? roll.mode : 'normal', offset: typeof roll.offset === 'number' ? roll.offset : roll.d10 - roll.d6,
        from: Math.min(80, count(roll.from, 1, (state.season ?? 1) > 1 ? 0 : 1)), to: Math.min(80, count(roll.to, state.currentPromptId, 1)),
        skipped: Array.isArray(roll.skipped) ? roll.skipped.filter((id): id is number => typeof id === 'number' && id >= 1 && id <= 80) : [] };
    }
  }
  state.migrationNotes = [...new Set(notes)];
  return state;
}
