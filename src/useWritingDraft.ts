import { useEffect, useState } from 'react';
import { SAVE_KEY, draftContext, parseDrafts, type WritingDraft } from './storage';
import type { GameState } from './types';

function loadDrafts(game: GameState) {
  let notice = '';
  try {
    const raw = localStorage.getItem(`${SAVE_KEY}_drafts`);
    if (raw) {
      try { return { drafts: parseDrafts(raw), notice }; }
      catch {
        localStorage.setItem(`${SAVE_KEY}_drafts_recovery`, raw);
        notice = '집필 초안을 읽지 못했습니다. 기기 복구함에 원본을 보관했습니다.';
      }
    }
    // One-time migration of older versions' single draft. Keep earlier abandoned text recoverable.
    const drafts: Record<string, WritingDraft> = {};
    const journalText = localStorage.getItem(`${SAVE_KEY}_draft`) ?? '';
    const experience = localStorage.getItem(`${SAVE_KEY}_experience`) ?? '';
    const context = draftContext(game);
    if (journalText || experience) drafts[context] = { context, characterName: game.characterName, promptId: game.currentPromptId, journalText, experience, updatedAt: 0 };
    try {
      const previous = JSON.parse(localStorage.getItem(`${SAVE_KEY}_previous_draft`) ?? 'null');
      if (previous && typeof previous.journalText === 'string' && typeof previous.experience === 'string') {
        drafts.legacy = { context: 'legacy', characterName: '이전 초안', promptId: 0, journalText: previous.journalText, experience: previous.experience, updatedAt: 0 };
      }
    } catch { /* The original key is retained. */ }
    return { drafts, notice };
  } catch { return { drafts: {}, notice: '집필 초안을 읽지 못했습니다. 저장 공간 권한을 확인하고 파일로 보관해 주세요.' }; }
}

export function useWritingDraft(game: GameState) {
  const [loaded] = useState(() => loadDrafts(game));
  const [drafts, setDrafts] = useState<Record<string, WritingDraft>>(loaded.drafts);
  const [draftNotice, setDraftNotice] = useState(loaded.notice);
  const [draftError, setDraftError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const context = draftContext(game);
  const draft = drafts[context];
  useEffect(() => {
    try {
      localStorage.setItem(`${SAVE_KEY}_drafts`, JSON.stringify(Object.values(drafts)));
      setDraftError('');
    } catch { setDraftError('작성 중인 초안을 기기에 저장하지 못했습니다. 내보내기로 보관해 주세요.'); }
  }, [drafts, attempt]);
  const replaceDraft = (target: GameState, journalText: string, experience: string) => {
    const key = draftContext(target);
    setDrafts(previous => ({ ...previous, [key]: { context: key, characterName: target.characterName,
      promptId: target.currentPromptId, journalText, experience, updatedAt: Date.now() } }));
  };
  return { journalText: draft?.journalText ?? '', experience: draft?.experience ?? '', drafts, draftError, draftNotice, dismissDraftNotice: () => setDraftNotice(''), replaceDraft, retryDrafts: () => setAttempt(value => value + 1),
    setJournalText: (text: string) => replaceDraft(game, text, draft?.experience ?? ''),
    setExperience: (text: string) => replaceDraft(game, draft?.journalText ?? '', text),
    clearDraft: () => replaceDraft(game, '', ''),
  };
}
