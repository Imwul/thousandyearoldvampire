import { normalizeGameState, SCHEMA_VERSION } from './game';
import type { GameState } from './types';

export const SAVE_KEY = 'athousandyearoldvampire_savegame';
export interface Setup {
  name: string; origin: string; skills: string; resources: string; mortals: string;
  immortal: string; mark: string; memories: string[]; mode: 'quick' | 'journal';
}
export const emptySetup: Setup = {
  name: '', origin: '', skills: '', resources: '', mortals: '', immortal: '', mark: '',
  memories: ['', '', '', '', ''], mode: 'journal',
};

/** Drafts are untrusted input too: a valid JSON object need not be a valid form. */
export function parseSetup(raw: string): Setup {
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('시작 초안 형식이 올바르지 않습니다.');
  const result = { ...emptySetup };
  for (const key of ['name', 'origin', 'skills', 'resources', 'mortals', 'immortal', 'mark'] as const) {
    result[key] = typeof value[key] === 'string' ? value[key] : '';
  }
  result.memories = Array.from({ length: 5 }, (_, i) => typeof value.memories?.[i] === 'string' ? value.memories[i] : '');
  result.mode = value.mode === 'quick' ? 'quick' : 'journal';
  return result;
}

export function parseSave(raw: string): GameState {
  const value = JSON.parse(raw);
  if (!value || !Array.isArray(value.memories) || typeof value.currentPromptId !== 'number' || typeof value.characterName !== 'string') {
    throw new Error('흡혈귀 기록 파일 형식이 아닙니다.');
  }
  if (typeof value.schemaVersion === 'number' && value.schemaVersion > SCHEMA_VERSION) throw new Error('더 새로운 버전의 기록입니다. 앱을 업데이트한 뒤 불러와 주세요.');
  return normalizeGameState(value);
}

export function setupMarkdown(setup: Setup): string {
  return [`# ${setup.name || '새로운 인물'} · 시작 초안`, '', setup.origin, '',
    ...(['skills', 'resources', 'mortals', 'immortal', 'mark'] as const).flatMap((key, i) =>
      [`## ${['기술', '자원', '필멸자', '불멸자', '표식'][i]}`, '', setup[key], '']),
    '## 다섯 개의 처음', '', ...setup.memories.map((text, i) => `${i + 1}. ${text}`), '',
    `기록 방식: ${setup.mode === 'quick' ? '빠른 게임' : '저널링'}`, '',
  ].join('\n');
}

export function draftContext(game: GameState): string {
  return JSON.stringify([game.storyId || `${game.characterName}\n${game.vampireOrigin}`, game.currentPromptId,
    game.promptVisitHistory[game.currentPromptId] ?? 0, game.activeAltIdx ?? null, game.season ?? 1]);
}
export interface WritingDraft {
  context: string; characterName: string; promptId: number;
  journalText: string; experience: string; updatedAt: number;
}
export function parseDrafts(raw: string | null): Record<string, WritingDraft> {
  if (!raw) return {};
  const result: Record<string, WritingDraft> = Object.create(null);
  const value = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('집필 초안 형식이 올바르지 않습니다.');
  for (const item of value) {
    if (item && typeof item.context === 'string' && typeof item.journalText === 'string' && typeof item.experience === 'string') {
      result[item.context] = {
        context: item.context, characterName: typeof item.characterName === 'string' ? item.characterName : '이전 인물',
        promptId: Number.isInteger(item.promptId) ? item.promptId : 1,
        journalText: item.journalText, experience: item.experience,
        updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : 0,
      };
    }
  }
  return result;
}

export function saveBackup(game: GameState, draft = '', experienceDraft = '', key = 'backup', setupDraft?: Setup) {
  localStorage.setItem(`${SAVE_KEY}_${key}`, JSON.stringify({ ...game, draft, experienceDraft, ...(setupDraft ? { setupDraft } : {}), backedUpAt: new Date().toISOString() }));
}
export interface RecoveryFile { key: string; label: string; raw: string; game: GameState | null }
export function recoveryFiles(): RecoveryFile[] {
  const labels = { backup: '교체하기 전 기기 기록', cloud_backup: '선택하기 전 클라우드 기록', recovery: '읽지 못한 기기 기록', setup_recovery: '읽지 못한 시작 초안', drafts_recovery: '읽지 못한 집필 초안' };
  const files: RecoveryFile[] = [];
  for (const [key, label] of Object.entries(labels)) {
    const raw = localStorage.getItem(`${SAVE_KEY}_${key}`);
    if (!raw) continue;
    let game = null;
    try { game = parseSave(raw); } catch { /* Raw downloads remain available. */ }
    files.push({ key, label, raw, game });
  }
  return files;
}

/** Human-readable export stays separate from the lossless JSON backup. */
export function chronicleMarkdown(game: GameState, draft = '', experience = ''): string {
  const output = [`# ${game.characterName || '이름 없는 흡혈귀'}`, '', game.vampireOrigin, '',
    `기록 방식: ${game.playMode === 'quick' ? '빠른 게임' : '저널링'} · 지나온 사건 ${game.turnCount ?? 0}개`, ''];
  const section = (title: string, entries: string[]) => output.push(`## ${title}`, '', ...(entries.length ? entries : ['기록 없음']), '');
  section('지금의 기억', game.memories.flatMap((m, i) => [`### 기억 ${i + 1}${m.label ? ` · ${m.label}` : ''}`, ...m.experiences.map(e => `- ${e.text}`), '']));
  section('영구 기억', (game.permanentMemories ?? []).flatMap(m => m.experiences.map(e => `- ${e.text}`)));
  section('일기장', game.diary.flatMap((d, i) => [`### ${game.resources.find(r => r.id === d.resourceId)?.name || '일기장'} · 기억 ${i + 1}${d.isLost ? ' (잃음)' : ''}`, ...d.experiences.map(e => `- ${e.text}`), '']));
  section('기술', game.skills.map(s => `- ${s.name} — ${s.isLost ? '잃음' : s.isChecked ? '사용함' : '체크 가능'}`));
  section('자원', game.resources.map(r => `- ${r.name}${r.isStationary ? ' (정착)' : ''}${r.isLost ? ' — 잃음' : ''}`));
  section('등장인물', game.characters.map(c => `- ${c.name} — ${c.type === 'immortal' ? '불멸자' : '필멸자'}${c.isAlive ? '' : ', 죽음'}`));
  section('표식', game.marks.map(m => `- ${m.description}${m.isLost ? ' — 지워짐' : ''}`));
  section('연대기', game.journal.flatMap(j => [`### 사건 ${j.promptId} · ${j.visitCount}번째 방문${j.isAlternate ? ` · 대체 ${j.alternateId}` : ''}`, '', j.textContent, '', j.rollText, '']));
  section('잊은 기억', (game.forgottenMemories ?? []).flatMap(m => [...m.experiences.map(e => `- ${e.text}`), `  ${m.reason}`, '']));
  if (game.isGameOver) section('최후의 이야기', [game.gameOverText]);
  if (draft || experience) section('완성하지 않은 초안', [draft, '', experience]);
  return `${output.join('\n')}\n`;
}
