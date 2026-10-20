import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, BookOpen, Check, ChevronRight, CircleHelp, Cloud, Feather, Fingerprint, Gem, History, Library, LogIn, LogOut, Plus, RotateCcw, ScrollText, Settings2, Sparkles, Sword, Trash2, Users, X } from 'lucide-react';
import * as rules from './game';
import { alternatePrompts } from './data/alternatePrompts';
import type { GameState, Memory } from './types';
import { SAVE_KEY, useGameSave } from './useGameSave';
type Page = 'play' | 'memories' | 'skills' | 'resources' | 'characters' | 'marks' | 'diary' | 'journal' | 'rules';
type Entity = 'skills' | 'resources' | 'characters' | 'marks';
type Editor = {
  kind: Entity;
  id?: string;
  text: string;
  stationary: boolean;
  immortal: boolean;
};
type Confirmation = {
  title: string;
  text: string;
  action: () => void;
};
type Setup = {
  name: string;
  origin: string;
  skills: string;
  resources: string;
  mortals: string;
  immortal: string;
  mark: string;
  memories: string[];
  mode: 'quick' | 'journal';
};
const uid = () => crypto.randomUUID();
const lines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean);
const readDraft = (key: string) => {
  try {
    return localStorage.getItem(`${SAVE_KEY}_${key}`) ?? '';
  } catch {
    return '';
  }
};
const draftKey = (state: GameState) => JSON.stringify([state.characterName, state.currentPromptId, state.promptVisitHistory[state.currentPromptId], state.activeAltIdx]);
const titles: Record<Page, [string, string, string]> = {
  play: ['THE UNFOLDING', '이야기 이어가기', '사건을 읽고, 당신에게 남은 한 문장을 기록하세요.'],
  memories: ['WHAT REMAINS', '당신이 기억하는 것들', '다섯 기억, 저마다 세 개의 경험. 모든 것을 간직할 수는 없습니다.'],
  skills: ['WHAT YOU HAVE BECOME', '몸에 밴 것들', '체크한 기술은 한 번 사용한 기술이자, 당신이 어떤 존재가 되었는지를 말합니다.'],
  resources: ['THINGS YOU HOLD', '손에 남은 것들', '성채도 반지도 하나의 자원입니다. 잃어버린 것의 이름도 남겨 두세요.'],
  characters: ['THOSE WHO PASS', '스쳐 가는 얼굴들', '누군가는 당신을 사랑하고, 누군가는 오래도록 당신을 기억합니다.'],
  marks: ['THE VISIBLE CURSE', '숨길 수 없는 흔적', '불멸의 징표, 그리고 그것을 감추기 위해 당신이 하는 일.'],
  diary: ['BORROWED MEMORY', '종이 위의 기억', '일기장 속 기억은 당신의 머릿속에 없습니다. 쓰인 것만이 진실입니다.'],
  journal: ['THE CHRONICLE', '사라지지 않는 기록', '지나온 사건을 돌아보세요. 이야기보다 기억과 경험이 우선합니다.'],
  rules: ['A COMPANION TO THE BOOK', '긴 밤을 위한 안내', '소장한 룰북 1.2판의 기본 규칙을 따라 진행합니다.']
};
const navigation = [['play', '이야기 이어가기', Feather], ['memories', '기억과 경험', Library], ['skills', '기술', Sword], ['resources', '자원', Gem], ['characters', '등장인물', Users], ['marks', '표식', Fingerprint], ['diary', '일기장', BookOpen], ['journal', '연대기', History]] as const;
function Modal({
  title,
  children,
  close,
  footer
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  footer?: ReactNode;
}) {
  const element = useRef<HTMLDivElement>(null);
  const onClose = useRef(close);
  onClose.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const items = () => Array.from(element.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea,select,a[href]') ?? []);
    items()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose.current();
      const first = items()[0],
        last = items().at(-1);
      if (event.key === 'Tab' && event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (event.key === 'Tab' && !event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget) close();
  }}><div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={element}><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="창 닫기"><X size={20} /></button></div><div className="modal-body">{children}</div>{footer && <div className="modal-footer">{footer}</div>}</div></div>;
}
function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return <label className="form-field"><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}
const emptySetup: Setup = {
  name: '',
  origin: '',
  skills: '',
  resources: '',
  mortals: '',
  immortal: '',
  mark: '',
  memories: ['', '', '', '', ''],
  mode: 'journal'
};
function setupFromGame(game: GameState): Setup {
  try {
    const saved = readDraft('setup');
    if (saved && !game.setupComplete) return {
      ...emptySetup,
      ...JSON.parse(saved)
    };
  } catch {/* Ignore a damaged draft. */}
  return {
    name: game.characterName,
    origin: game.vampireOrigin,
    skills: game.skills.map(item => item.name).join('\n'),
    resources: game.resources.map(item => `${item.isStationary ? '[정착] ' : ''}${item.name}`).join('\n'),
    mortals: game.characters.filter(item => item.type === 'mortal').map(item => item.name).join('\n'),
    immortal: game.characters.find(item => item.type === 'immortal')?.name ?? '',
    mark: game.marks[0]?.description ?? '',
    memories: Array.from({
      length: 5
    }, (_, index) => game.memories[index]?.experiences[0]?.text ?? ''),
    mode: game.playMode ?? 'journal'
  };
}
const sample: Setup = {
  name: '서윤',
  origin: '고려 말, 개경의 서고를 지키던 필사자. 불에 탄 책을 구하려다 영원한 밤을 얻었다.',
  skills: '기록을 읽는 눈\n거짓말을 알아채기\n조용한 발걸음',
  resources: '스승의 먹과 벼루\n[정착] 강가의 작은 서고\n누이의 은비녀',
  mortals: '연화: 내 귀가를 기다리는 누이\n도겸: 글을 가르쳐 준 스승\n우진: 서고에 책을 팔러 오는 친구',
  immortal: '백야: 불타는 서고에서 나를 꺼낸 이름 없는 귀족',
  mark: '피가 흐르지 않는 손목의 상처; 긴 소매로 가린다.',
  memories: ['나는 개경의 필사자 서윤이었다; 종이 위의 말만은 오래 살아남으리라 믿었다.', '연화는 첫 품삯으로 은비녀를 샀다; 그것을 맡길 만큼 나를 믿었다.', '도겸의 벼루로 밤새 글을 베꼈다; 스승은 내 눈이 진실을 알아본다고 했다.', '우진과 강가 서고에서 금서를 숨겼다; 우리는 서로의 비밀을 지키기로 했다.', '백야가 불길 속에서 내 손목을 물었다; 구원이라고 여긴 것이 끝나지 않는 갈증이었다.'],
  mode: 'journal'
};
const ruleNotes = [['01 / CREATION · PDF 21–22쪽', '인간이었던 당신부터', '필멸자 최소 3명, 불멸자 1명, 기술 3개, 자원 3개, 표식 1개를 만듭니다. 다섯 기억에는 경험 한 문장씩을 씁니다. 첫 경험은 인간 시절, 가운데 세 경험은 특성 두 가지의 관계, 마지막은 흡혈귀가 된 사건을 담습니다.'], ['02 / EXPERIENCE · PDF 10–13, 26쪽', '사건 하나, 경험 한 문장', '경험은 1인칭으로 사건과 그 의미를 담습니다. 관련된 경험을 같은 기억에 넣되 한 기억에는 3개까지 담습니다. 자리가 없거나 주제가 다르면 기억 전체를 잊거나 일기장으로 옮깁니다. 사건의 별도 지시 없이는 경험을 고치거나 하나만 지우지 않습니다.'], ['03 / DIARY · PDF 16쪽', '당신 대신 기억하는 물건', '일기장은 자원 하나이며 동시에 하나만 소유합니다. 기억을 최대 4개 보관하며, 옮긴 기억에는 경험을 더하지 않습니다. 일기장을 잃으면 그 안의 기억도 잃습니다. 기본 규칙으로는 일기장을 다시 머릿속에 옮길 수 없습니다.'], ['04 / MOVEMENT · PDF 23쪽', '열 면체에서 여섯 면체를 빼기', '사건에 답한 뒤 d10−d6만큼 이동합니다. 0이면 같은 사건의 다음 문단을 읽습니다. 모든 문단에 답한 번호에 도착하면 다음 번호로 넘어가며, 소진된 번호를 연속해서 건너뜁니다. 첫 번호 이전에는 1번으로 돌아옵니다.'], ['05 / COSTS · PDF 17–18, 24쪽', '치러야 할 대가는 남는다', '기술은 한 번만 체크합니다. 체크할 기술이 없으면 자원 하나를 잃습니다. 잃을 자원이 없으면 기술 하나를 체크합니다. 둘 다 불가능하거나 잃으라고 한 기술이 하나도 없으면 최후를 서술합니다. 기억·등장인물·표식으로 대신할 수 없습니다. 잃은 특성은 취소선으로 남깁니다.'], ['06 / TIME & ENDINGS · PDF 19, 24, 29쪽', '끝은 사건이 정한다', '시간은 자유롭게 흐릅니다. 수십 년이 지났다면 필멸자의 자연사를 반영하세요. 그 밖의 살해는 사건의 지시가 있을 때 적용합니다. 정착 자원은 사건에서 떠나도록 지시받을 때 잃습니다. 72–80번 기본 사건은 결말이며, 69번 세 번째 문단은 선택 결말입니다. 대체 사건의 결말 조건은 해당 지시를 따릅니다.'], ['07 / ALTERNATIVES · 부록 I', '다른 운명으로 바꾸기', '부록의 대체 사건을 고르면 현재 번호에 연결해 보관합니다. 이후 같은 번호를 만나면 선택한 대체 사건의 다음 문단을 읽습니다. 추가 주사위·시간 역행·특별한 기억 칸 등 개별 사건의 예외는 사건 지시 도구에서 조정합니다.'], ['08 / YOUR PACE · 26쪽 및 부록', '당신에게 맞는 속도로', '빠른 게임은 경험만으로, 저널링 게임은 긴 기록과 경험을 함께 남깁니다. 두 방식 모두 기억이 우선합니다. 다루기 어려운 장면에서는 잠시 멈추거나 내용을 조정하세요. 다인 플레이·안전 도구·무작위 표는 소장 룰북을 함께 참고하세요.']];
function App() {
  const {
    game,
    setGame,
    user,
    status,
    error,
    dismissError,
    conflict,
    chooseSave,
    login,
    logout
  } = useGameSave();
  const [page, setPage] = useState<Page>('play');
  const [memoryExpanded, setMemoryExpanded] = useState(false);
  const [setup, setSetup] = useState<Setup>(() => setupFromGame(game));
  const [toast, setToast] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [memoryEditor, setMemoryEditor] = useState<{
    memoryId: string;
    experienceId: string;
    text: string;
    diaryId?: string;
  } | null>(null);
  const [journalEditor, setJournalEditor] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const [journalText, setJournalText] = useState(() => readDraft('draft'));
  const [experience, setExperience] = useState(() => readDraft('experience'));
  const [memoryId, setMemoryId] = useState('');
  const [instructionsDone, setInstructionsDone] = useState(false);
  const [altModal, setAltModal] = useState(false);
  const [altSelection, setAltSelection] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [dice, setDice] = useState<[number, number] | null>(null);
  const [targetPrompt, setTargetPrompt] = useState(1);
  const [costMode, setCostMode] = useState<'check' | 'lose' | null>(null);
  const [costSelection, setCostSelection] = useState('');
  const [specialTool, setSpecialTool] = useState(false);
  const [specialAction, setSpecialAction] = useState('capacity');
  const [specialMemory, setSpecialMemory] = useState('m1');
  const [specialTarget, setSpecialTarget] = useState('m2');
  const [specialText, setSpecialText] = useState('');
  const [specialNumber, setSpecialNumber] = useState(4);
  const [seasonModal, setSeasonModal] = useState(false);
  const [seasonTraits, setSeasonTraits] = useState({
    mortals: '',
    resources: '',
    skills: ''
  });
  const importRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestGame = useRef(game);
  latestGame.current = game;
  const draftBinding = useRef(draftKey(game));
  const started = !!game.setupComplete;
  const prompt = rules.getCurrentPrompt(game);
  const available = game.memories.filter(memory => memory.experiences.length < (memory.maxExperiences ?? 3));
  const selectedMemory = available.some(memory => memory.id === memoryId) ? memoryId : available[0]?.id ?? '';
  const experienceCount = game.experienceCount ?? (game.experienceRecorded ? 1 : 0);
  const needsExperience = !game.experienceWaived && experienceCount < prompt.requiredExperiences;
  const apply = (action: (state: GameState) => GameState, success?: string, allowEnded = false) => {
    try {
      if (latestGame.current.isGameOver && !allowEnded) throw new Error('끝난 이야기의 기록표는 보존됩니다. 최후의 이야기와 연대기는 수정할 수 있습니다.');
      const next = action(latestGame.current);
      latestGame.current = next;
      setGame(next);
      if (success) setToast(success);
      return true;
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : '변경을 적용하지 못했습니다.');
      return false;
    }
  };
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 5500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    try {
      localStorage.setItem(`${SAVE_KEY}_draft`, journalText);
      localStorage.setItem(`${SAVE_KEY}_experience`, experience);
    } catch {/* Main save reports storage errors. */}
  }, [journalText, experience]);
  useEffect(() => {
    if (!started) {
      try {
        localStorage.setItem(`${SAVE_KEY}_setup`, JSON.stringify(setup));
      } catch {/* optional draft */}
    }
  }, [setup, started]);
  useEffect(() => {
    setInstructionsDone(false);
  }, [game.currentPromptId, game.activeAltIdx, game.currentPromptResolved]);
  useEffect(() => {
    const binding = draftKey(game);
    if (binding !== draftBinding.current) {
      try {
        if (journalText || experience) localStorage.setItem(`${SAVE_KEY}_previous_draft`, JSON.stringify({
          context: draftBinding.current,
          journalText,
          experience
        }));
      } catch {/* optional recovery */}
      draftBinding.current = binding;
      setJournalText('');
      setExperience('');
      clearTimeout(timer.current);
      setRolling(false);
      setDice(null);
    }
  }, [game.characterName, game.currentPromptId, game.promptVisitHistory, game.activeAltIdx, journalText, experience, game]);
  const updateSetup = <K extends keyof Setup,>(key: K, value: Setup[K]) => setSetup(previous => ({
    ...previous,
    [key]: value
  }));
  const start = (event: FormEvent) => {
    event.preventDefault();
    const candidate: GameState = {
      ...rules.createInitialGameState(),
      characterName: setup.name.trim(),
      vampireOrigin: setup.origin.trim(),
      playMode: setup.mode,
      skills: lines(setup.skills).map(name => ({
        id: uid(),
        name,
        isChecked: false
      })),
      resources: lines(setup.resources).map(line => ({
        id: uid(),
        name: line.replace(/^\[정착\]\s*/, ''),
        isStationary: line.startsWith('[정착]')
      })),
      characters: [...lines(setup.mortals).map(name => ({
        id: uid(),
        name,
        type: 'mortal' as const,
        isAlive: true
      })), ...(setup.immortal.trim() ? [{
        id: uid(),
        name: setup.immortal.trim(),
        type: 'immortal' as const,
        isAlive: true
      }] : [])],
      marks: setup.mark.trim() ? [{
        id: uid(),
        description: setup.mark.trim()
      }] : [],
      memories: setup.memories.map((text, index) => ({
        id: `m${index + 1}`,
        experiences: text.trim() ? [{
          id: uid(),
          text: text.trim()
        }] : []
      }))
    };
    try {
      setGame(rules.startGame(candidate));
      setPage('play');
      setJournalText('');
      setExperience('');
      window.scrollTo({
        top: 0
      });
    } catch (cause) {
      setToast((cause as Error).message);
    }
  };
  const recordExperience = () => {
    if (apply(state => rules.addExperience(state, selectedMemory, experience), '한 문장의 경험을 기억에 새겼습니다.')) setExperience('');
  };
  const complete = (endOptional = false) => {
    if (!instructionsDone) return setToast('사건의 지시를 기록표에 반영한 뒤 확인해 주세요.');
    if (apply(state => {
      let next = state;
      if (needsExperience && experience.trim()) next = rules.addExperience(next, selectedMemory, experience);
      return rules.completePrompt(next, journalText.trim(), endOptional);
    }, '이번 밤의 기록을 남겼습니다.')) {
      setJournalText('');
      setExperience('');
    }
  };
  const roll = () => {
    if (rolling || !game.currentPromptResolved || game.isGameOver) return;
    setRolling(true);
    setDice([Math.floor(Math.random() * 10) + 1, Math.floor(Math.random() * 6) + 1]);
    timer.current = setTimeout(() => {
      const d10 = Math.floor(Math.random() * 10) + 1,
        d6 = Math.floor(Math.random() * 6) + 1;
      setDice([d10, d6]);
      setRolling(false);
      apply(state => rules.rollMovement(state, d10, d6));
    }, 420);
  };
  const exportSave = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({
      ...game,
      draft: journalText,
      experienceDraft: experience,
      exportedAt: new Date().toISOString()
    }, null, 2)], {
      type: 'application/json'
    }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vampire-${game.characterName || 'chronicle'}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast('기록을 파일로 내보냈습니다.');
  };
  const stopRoll = () => { clearTimeout(timer.current); setRolling(false); setDice(null); };
  const backup = () => {
    try {
      localStorage.setItem(`${SAVE_KEY}_backup`, JSON.stringify(game));
    } catch {/* export remains available */}
  };
  const importSave = async (file: File) => {
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('8MB 이하의 기록 파일을 선택해 주세요.');
      const input = JSON.parse(await file.text());
      if (!input || !Array.isArray(input.memories) || typeof input.currentPromptId !== 'number' || typeof input.characterName !== 'string') throw new Error('흡혈귀 기록 파일 형식이 아닙니다.');
      const imported = rules.normalizeGameState(input);
      setConfirmation({
        title: '파일의 기록을 불러올까요?',
        text: `현재 기록을 ‘${imported.characterName || '이름 없는 흡혈귀'}’의 기록으로 바꿉니다. 현재 기록은 기기 복구본에 보관합니다.`,
        action: () => {
          backup();
          stopRoll();
          draftBinding.current = draftKey(imported);
          setGame(imported);
          setSetup(setupFromGame(imported));
          setJournalText(typeof input.draft === 'string' ? input.draft : '');
          setExperience(typeof input.experienceDraft === 'string' ? input.experienceDraft : '');
          setPage('play');
        }
      });
    } catch (cause) {
      setToast((cause as Error).message);
    }
  };
  const saveEntity = (event: FormEvent) => {
    event.preventDefault();
    if (!editor?.text.trim()) return;
    const {
      kind,
      id,
      text,
      stationary,
      immortal
    } = editor;
    apply(state => {
      const itemId = id ?? uid();
      if (kind === 'skills') return {
        ...state,
        skills: id ? state.skills.map(item => item.id === id ? {
          ...item,
          name: text.trim()
        } : item) : [...state.skills, {
          id: itemId,
          name: text.trim(),
          isChecked: false
        }]
      };
      if (kind === 'resources') return {
        ...state,
        resources: id ? state.resources.map(item => item.id === id ? {
          ...item,
          name: text.trim(),
          isStationary: stationary
        } : item) : [...state.resources, {
          id: itemId,
          name: text.trim(),
          isStationary: stationary
        }]
      };
      if (kind === 'characters') return {
        ...state,
        characters: id ? state.characters.map(item => item.id === id ? {
          ...item,
          name: text.trim(),
          type: immortal ? 'immortal' : 'mortal'
        } : item) : [...state.characters, {
          id: itemId,
          name: text.trim(),
          type: immortal ? 'immortal' : 'mortal',
          isAlive: true
        }]
      };
      return {
        ...state,
        marks: id ? state.marks.map(item => item.id === id ? {
          ...item,
          description: text.trim()
        } : item) : [...state.marks, {
          id: itemId,
          description: text.trim()
        }]
      };
    }, '기록표를 갱신했습니다.');
    setEditor(null);
  };
  const confirm = (title: string, text: string, action: () => void) => setConfirmation({
    title,
    text,
    action
  });
  const memoryCard = (memory: Memory, index: number, compact = false) => <article className={`memory-card ${!memory.experiences.length ? 'empty' : ''}`} key={memory.id}>
    <div className="memory-card-header"><span className="memory-index">{String(index + 1).padStart(2, '0')} <span>{memory.label || '기억'}</span></span><span className="memory-capacity" aria-label={`경험 ${memory.experiences.length}개, 최대 ${memory.maxExperiences ?? 3}개`}>{Array.from({
          length: memory.maxExperiences ?? 3
        }, (_, dot) => <i key={dot} className={dot < memory.experiences.length ? 'filled' : ''} />)}</span></div>
    {memory.experiences.length ? <ol className="experience-list">{memory.experiences.map(item => <li className="experience-item" key={item.id}><p className="experience-text">{item.text}</p>{!compact && game.promptEditEnabled && <button className="icon-button" aria-label="사건 지시에 따라 경험 수정" onClick={() => setMemoryEditor({
          memoryId: memory.id,
          experienceId: item.id,
          text: item.text
        })}><Feather size={14} /></button>}</li>)}</ol> : <p className="field-hint">새로운 경험을 담을 빈자리.</p>}
    {!!memory.experiences.length && !memory.isPermanent && <div className="item-actions"><button className="button-ghost" onClick={() => apply(state => rules.archiveMemory(state, memory.id), '기억을 일기장으로 옮겼습니다.')}><BookOpen size={13} />일기장에 옮기기</button><button className="button-ghost" onClick={() => confirm('이 기억을 잊을까요?', '이 칸의 모든 경험을 함께 잊습니다. 잊은 기록은 보관되며 사건의 지시가 있을 때만 되찾을 수 있습니다.', () => apply(state => rules.forgetMemory(state, memory.id)))}>잊기 <X size={12} /></button></div>}
  </article>;
  const counts = {
    memories: game.memories.filter(memory => memory.experiences.length).length,
    skills: game.skills.filter(item => !item.isLost).length,
    resources: game.resources.filter(item => !item.isLost).length,
    characters: game.characters.filter(item => item.isAlive).length,
    marks: game.marks.filter(item => !item.isLost).length,
    diary: game.diary.filter(item => !item.isLost).length,
    journal: game.journal.length
  };
  const primaryDiaryCount = game.diary.filter(item => !item.isLost && item.resourceId === game.diaryResourceId).length;
  const uncheckedSkills = game.skills.filter(item => !item.isLost && !item.isChecked);
  const liveResources = game.resources.filter(item => !item.isLost);
  const costUsesSkill = costMode === 'check' ? !!uncheckedSkills.length : !liveResources.length;
  const costChoices = costUsesSkill ? uncheckedSkills : liveResources;
  const selectedCost = costChoices.some(item => item.id === costSelection) ? costSelection : costChoices[0]?.id;
  const payCost = () => {
    if (apply(state => costMode === 'check' ? rules.checkSkill(state, costUsesSkill ? selectedCost : undefined, costUsesSkill ? undefined : selectedCost) : rules.loseResource(state, costUsesSkill ? undefined : selectedCost, costUsesSkill ? selectedCost : undefined), '사건의 비용을 반영했습니다.')) setCostMode(null);
  };
  const applySpecial = () => {
    if (apply(state => {
      switch (specialAction) {
        case 'capacity':
          return rules.setMemoryCapacity(state, specialMemory, specialNumber);
        case 'label':
          return rules.setMemoryLabel(state, specialMemory, specialText);
        case 'diary':
          return rules.setDiaryCapacity(state, specialNumber);
        case 'extra':
          return rules.createExtraDiaryMemory(state, specialText);
        case 'directDiary':
          return rules.addDiaryMemory(state, specialText);
        case 'merge':
          return rules.mergeMemories(state, specialMemory, specialTarget);
        default:
          throw new Error('적용할 사건 지시를 선택해 주세요.');
      }
    }, '사건의 특별한 지시를 반영했습니다.')) setSpecialTool(false);
  };
  const heading = started || page === 'rules' ? titles[page] : ['BEFORE THE FIRST NIGHT', '새로운 이야기', '인간이었던 삶부터, 다섯 개의 기억을 채워 보세요.'];
  const newEntity = (kind: Entity) => setEditor({
    kind,
    text: '',
    stationary: false,
    immortal: false
  });
  const editEntity = (kind: Entity, id: string, text: string, stationary = false, immortal = false) => setEditor({
    kind,
    id,
    text,
    stationary,
    immortal
  });
  const editButton = (kind: Entity, id: string, text: string, stationary = false, immortal = false) => <button className="icon-button" aria-label={`${text} 수정`} onClick={() => editEntity(kind, id, text, stationary, immortal)}><Feather size={15} /></button>;
  const shownMode = game.lastRoll?.mode ?? 'normal';
  const diceOrder = shownMode === 'reverse' ? [1, 0] : shownMode === 'backward' ? [1] : [0, 1];
  const equation = shownMode === 'reverse' ? 'D6 − D10' : shownMode === 'backward' ? '−D6' : shownMode === 'sum' ? 'D10 + D6' : 'D10 − D6';
  const diceDisplay = <>{shownMode === 'backward' && <span className="dice-equation">−</span>}{diceOrder.map((index, position) => <span className="dice-pair" key={index}>{position > 0 && <span className="dice-equation">{shownMode === 'sum' ? '+' : '−'}</span>}<span className={`die ${rolling ? 'rolling' : ''}`}><span className="die-label">{index ? 'D6' : 'D10'}</span><strong className="die-value">{dice?.[index] ?? (index ? game.lastRoll?.d6 : game.lastRoll?.d10) ?? '—'}</strong></span></span>)}</>;
  const renderRules = () => <div className="panel prose"><div className="panel-header"><span className="panel-kicker">THE RULES, AT A GLANCE</span><BookOpen size={20} /></div><div className="panel-body"><h2>기억은 한정되어 있고, 밤은 길다.</h2><p>Tim Hutchings의 <em>Thousand Year Old Vampire</em>를 위한 개인 기록 도구입니다. 사건의 이야기와 선택은 플레이어가 해석하고, 지시받은 특성 변화는 기록표에 직접 반영합니다. 기본 규칙보다 개별 사건의 지시가 우선합니다.</p><div className="rules-list">{ruleNotes.map(([meta, title, text]) => <article key={meta}><span className="eyebrow">{meta}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></div>;
  const renderPlay = () => <div className="two-column"><div className="reading-panel"><section className="panel prompt-panel"><div className="panel-header"><span className="panel-kicker">사건 {String(prompt.id).padStart(2, '0')}{prompt.isAlternate && ` · 대체 ${alternatePrompts.find(item => item.id === prompt.alternateId)?.sourceLabel ?? prompt.alternateId}`}</span><span className="badge">{prompt.visit}번째 방문</span></div><div className="panel-body"><p className="prompt-text">{prompt.text}</p><div className="prompt-actions"><span className="field-hint">PDF {prompt.page}쪽 · {prompt.entry}번째 문단</span><button className="button-ghost" onClick={() => setAltModal(true)} disabled={game.currentPromptResolved || game.experienceRecorded || game.isGameOver}>다른 사건으로 대체 <ArrowRight size={13} /></button></div>{prompt.ending && <div className="notice warning">{prompt.ending === 'optional' ? '본문의 종료 조건이 충족되었거나 선택 결말을 택했다면 이야기 끝내기를 선택하세요.' : '이 사건을 해결하면 당신의 이야기가 끝납니다.'}</div>}</div></section>
        <section className="panel journal-editor"><div className="panel-header"><h2 className="panel-title">이번 밤을 기록하다</h2><Feather size={18} /></div><div className="panel-body">{game.currentPromptResolved ? <div className="resolved-state"><Check size={24} /><h3>{game.isGameOver ? '마지막 기록을 남겼습니다.' : '한 장의 이야기를 남겼습니다.'}</h3><p className="field-hint">{game.isGameOver ? '기억과 연대기에서 지나온 밤들을 돌아보세요.' : '주사위를 굴려 다음 사건을 만나세요.'}</p></div> : <>{game.playMode === 'journal' && <Field label="어떤 일이 있었나요?" hint="모든 질문에 답할 필요는 없습니다."><textarea className="textarea journal-textarea" rows={5} value={journalText} onChange={event => setJournalText(event.target.value)} placeholder="오늘 밤, 나는…" disabled={game.isGameOver} /></Field>}<Field label={`기억에 남길 한 문장 · ${experienceCount}/${game.experienceWaived ? 0 : prompt.requiredExperiences}`} hint="무슨 일이 있었고 어떤 의미였는지. 1인칭으로."><textarea className="textarea" rows={3} value={experience} onChange={event => setExperience(event.target.value)} placeholder="나는 …했다; 그래서 …을 느꼈다." disabled={!needsExperience || game.isGameOver} /></Field>{needsExperience && <><Field label="어느 기억에 담을까요?"><select className="select" value={selectedMemory} onChange={event => setMemoryId(event.target.value)} disabled={game.isGameOver}>{!available.length && <option value="">빈자리가 없습니다. 기억을 잊거나 일기장으로 옮겨 주세요.</option>}{available.map(memory => <option key={memory.id} value={memory.id}>기억 {game.memories.indexOf(memory) + 1} · {memory.experiences.length}/{memory.maxExperiences ?? 3} · {memory.experiences[0]?.text.slice(0, 28) || '아직 쓰이지 않은 기억'}</option>)}</select></Field><button className="button-secondary" onClick={recordExperience} disabled={!experience.trim() || !selectedMemory || game.isGameOver}>경험 먼저 새기기 <Feather size={14} /></button></>}{!needsExperience && <p className="notice success"><Check size={15} />{game.experienceWaived ? '이 사건은 새 경험을 요구하지 않습니다.' : '이번 사건의 경험이 기억에 담겼습니다.'}</p>}<label className="checkbox-row"><input type="checkbox" checked={!!game.experienceWaived} onChange={event => apply(state => rules.setExperienceWaived(state, event.target.checked))} disabled={game.isGameOver} /><span>사건에 새 경험을 만들지 말라는 별도 지시가 있습니다.</span></label><label className="checkbox-row"><input type="checkbox" checked={instructionsDone} onChange={event => setInstructionsDone(event.target.checked)} disabled={game.isGameOver} /><span>사건이 지시한 모든 변화(기억·기술·자원·등장인물·표식)를 반영했습니다.</span></label><div className="form-row"><button className="button-primary" onClick={() => complete()} disabled={game.isGameOver || !instructionsDone}>이번 사건 마치기 <Check size={16} /></button>{prompt.ending === 'optional' && <button className="button-secondary" onClick={() => complete(true)} disabled={!instructionsDone || game.isGameOver}>이야기 끝내기</button>}</div></>}</div></section>
        <section className="panel dice-panel"><div className="panel-header"><h2 className="panel-title">운명의 다음 장</h2><span className="panel-kicker">{equation}</span></div><div className="panel-body"><div className="dice-row">{diceDisplay}<span className="dice-equation">=</span><div className="roll-result">{rolling ? '…' : game.lastRoll ? `${game.lastRoll.offset > 0 ? '+' : ''}${game.lastRoll.offset}` : '?'}</div><button className="button-primary" onClick={roll} disabled={!game.currentPromptResolved || rolling || game.isGameOver}>{rolling ? '밤이 흐릅니다…' : '주사위 굴리기'}<ArrowRight size={16} /></button></div><p className="field-hint">{!game.currentPromptResolved ? '경험을 기록하고 사건을 마친 뒤 이동할 수 있습니다.' : game.lastRoll?.skipped.length ? `이미 끝낸 번호 ${game.lastRoll.skipped.join(', ')}을 건너뛰었습니다.` : '양수는 앞으로, 음수는 뒤로. 0이면 같은 사건을 다시 만납니다.'}</p></div></section>
        <details className="panel instruction-tools"><summary><Settings2 size={16} />사건의 특별한 지시 적용</summary><div className="panel-body"><p className="field-hint">현재 사건이 지시한 예외만 적용하세요. 기본 규칙보다 사건의 지시가 우선합니다.</p><label className="checkbox-row"><input type="checkbox" checked={!!game.promptEditEnabled} onChange={event => apply(state => ({
              ...state,
              promptEditEnabled: event.target.checked
            }))} /><span>이 사건이 기억 수정·복구 또는 특성 복원을 지시합니다.</span></label><div className="form-row"><input aria-label="지시받은 사건 번호" className="input" type="number" min="1" max="80" value={targetPrompt} onChange={event => setTargetPrompt(Number(event.target.value))} /><button className="button-secondary" onClick={() => confirm(`${targetPrompt}번으로 이동할까요?`, '사건에서 직접 이동을 지시한 경우에 사용하세요. 작성 중인 내용을 먼저 기록해 두세요.', () => apply(state => rules.resolvePrompt(state, targetPrompt)))}>지시 번호로 이동</button></div><label className="checkbox-row"><input type="checkbox" checked={game.persistentRollMode === 'reverse'} onChange={event => apply(state => ({
              ...state,
              persistentRollMode: event.target.checked ? 'reverse' : 'normal'
            }))} /><span>표식을 지울 때까지 계속 d6 − d10으로 이동합니다.</span></label><button className="button-secondary" onClick={() => setSpecialTool(true)}>기억 용량·병합·별도 일기 지시</button><Field label="다음 이동의 특별한 주사위 지시"><select className="select" value={game.nextRollMode ?? 'normal'} onChange={event => apply(state => ({
              ...state,
              nextRollMode: event.target.value as GameState['nextRollMode']
            }))}><option value="normal">기본 · d10 − d6</option><option value="reverse">역행 · d6 − d10</option><option value="backward">d6만큼 뒤로</option><option value="sum">d10 + d6</option></select></Field><div className="form-row"><button className="button-secondary" onClick={() => confirm('모든 필멸자의 세대를 보낼까요?', '시간이 흐르라는 사건 지시를 적용해 모든 필멸자를 죽음으로 표시합니다.', () => apply(state => rules.ageMortals(state)))}>필멸자의 세대 보내기</button><button className="button-secondary" onClick={() => confirm('정착 자원을 모두 잃을까요?', '떠나거나 도망치라는 사건의 지시를 적용합니다.', () => apply(state => rules.travel(state)))}>떠나며 정착 자원 잃기</button><button className="button-secondary" onClick={() => apply(state => rules.addMemorySlot(state))}>기억 칸 추가</button></div><button className="button-ghost" onClick={() => confirm('이 사건의 조건으로 끝낼까요?', '특별한 주사위 판정이나 선택의 결과로 게임이 끝나는 경우에 사용하세요.', () => apply(state => rules.endGame(state, journalText.trim() || '사건의 특별한 조건에 따라 이야기를 마쳤습니다.')))}>조건부 결말 적용</button></div></details>
      </div><aside className={`sheet-panel${memoryExpanded ? ' expanded' : ''}`}><button className="memory-toggle" onClick={() => setMemoryExpanded(value => !value)} aria-expanded={memoryExpanded} aria-controls="current-memories"><span>{memoryExpanded ? '기억 접기' : '기억 보기'}<strong>{counts.memories} / {game.memories.length}</strong></span><Plus size={15} style={{ transform: memoryExpanded ? 'rotate(45deg)' : undefined }} /></button><div className="sheet-content" id="current-memories"><div className="sheet-heading"><div><p className="eyebrow">IN YOUR MIND</p><h2>지금의 기억</h2></div><button className="icon-button" onClick={() => setPage('memories')} aria-label="모든 기억 관리"><ArrowRight size={18} /></button></div><p className="field-hint sheet-description">경험의 주제가 이어진다면 같은 기억에.<br />다른 이야기라면 새로운 자리에.</p>{game.memories.map((memory, index) => memoryCard(memory, index, true))}<div className="quiet-note"><BookOpen size={18} /><p>잊고 싶지 않은 기억은 일기장에.<br /><span>{primaryDiaryCount} / {game.diaryCapacity ?? 4} 기억 보관 중</span></p><button className="icon-button" onClick={() => setPage('diary')} aria-label="일기장 열기"><ArrowRight size={16} /></button></div></div></aside></div>;
  const renderEntities = () => <section className="panel"><div className="panel-header"><h2 className="panel-title">{titles[page][1]}</h2><button className="button-primary" onClick={() => newEntity(page as Entity)}><Plus size={16} />추가하기</button></div><div className="panel-body">{page === 'skills' && <div className="notice"><Sword size={17} /><span>체크할 기술이 없으면 자원을 잃고, 둘 다 없으면 끝납니다.</span><button className="button-secondary" onClick={() => {
          setCostSelection('');
          setCostMode('check');
        }}>기술 체크 비용 지불</button></div>}{page === 'resources' && <div className="notice"><Gem size={17} /><span>잃을 자원이 없으면 기술을 체크합니다.</span><button className="button-secondary" onClick={() => {
          setCostSelection('');
          setCostMode('lose');
        }}>자원 손실 비용 지불</button></div>}<div className="entity-list">
      {page === 'skills' && game.skills.map(item => <article className={`entity-card ${item.isLost ? 'lost' : item.isChecked ? 'checked' : ''}`} key={item.id}><div><p className="entity-title">{item.name}</p><span className="badge">{item.isLost ? '잃은 기술' : item.isChecked ? '체크함 · 사용한 기술' : '체크 가능'}</span></div><div className="item-actions">{!item.isLost && !item.isChecked && <button className="button-secondary" onClick={() => apply(state => rules.checkSkill(state, item.id))}><Check size={14} />체크</button>}{!item.isLost && <button className="button-ghost" onClick={() => apply(state => rules.loseSkill(state, item.id))}>잃기</button>}{game.promptEditEnabled && (item.isLost ? <button className="button-ghost" onClick={() => apply(state => rules.restoreSkill(state, item.id))}>복구</button> : item.isChecked && <button className="button-ghost" onClick={() => apply(state => rules.uncheckSkill(state, item.id))}>체크 해제</button>)}{editButton('skills', item.id, item.name)}</div></article>)}
      {page === 'resources' && game.resources.map(item => <article className={`entity-card ${item.isLost ? 'lost' : ''}`} key={item.id}><div><p className="entity-title">{item.name}</p><div className="entity-badges"><span className="badge">{item.isStationary ? '정착 자원' : '이동 자원'}</span>{item.isDiary && <span className="badge">일기장</span>}{item.isLost && <span className="badge">잃어버림</span>}</div></div><div className="item-actions">{item.isLost ? <button className="button-ghost" onClick={() => apply(state => rules.restoreResource(state, item.id))}>지시에 따라 되찾기</button> : <button className="button-secondary" onClick={() => confirm('이 자원을 잃을까요?', item.isDiary ? '일기장에 보관한 모든 기억도 함께 잃습니다.' : item.name, () => apply(state => rules.loseResource(state, item.id)))}>잃기</button>}{editButton('resources', item.id, item.name, item.isStationary)}</div></article>)}
      {page === 'characters' && game.characters.map(item => <article className={`entity-card ${!item.isAlive ? 'lost' : ''}`} key={item.id}><div><p className="entity-title">{item.name}</p><div className="entity-badges"><span className="badge">{item.type === 'mortal' ? '필멸자' : '불멸자'}</span>{!item.isAlive && <span className="badge">죽음</span>}{item.isAgeless && <span className="badge">노화 면역</span>}</div></div><div className="item-actions"><button className="button-secondary" onClick={() => apply(state => ({
              ...state,
              characters: state.characters.map(character => character.id === item.id ? {
                ...character,
                isAlive: !character.isAlive
              } : character)
            }))}>{item.isAlive ? '죽음 표시' : '지시에 따라 되돌리기'}</button>{game.promptEditEnabled && item.type === 'mortal' && <button className="button-ghost" onClick={() => apply(state => rules.setCharacterAgeless(state, item.id, !item.isAgeless))}>{item.isAgeless ? '노화 면역 해제' : '지시에 따라 노화 면역'}</button>}{editButton('characters', item.id, item.name, false, item.type === 'immortal')}</div></article>)}
      {page === 'marks' && game.marks.map(item => <article className={`entity-card ${item.isLost ? 'lost' : ''}`} key={item.id}><div><p className="entity-title">{item.description}</p><span className="badge">{item.isLost ? '지워진 표식' : '불멸의 표식'}</span></div><div className="item-actions"><button className="button-secondary" onClick={() => apply(state => item.isLost ? rules.restoreMark(state, item.id) : rules.loseMark(state, item.id))}>{item.isLost ? '지시에 따라 복구' : '지시에 따라 잃기'}</button>{editButton('marks', item.id, item.description)}</div></article>)}
      {!(game[page as Entity] as unknown[]).length && <div className="empty-state"><Sparkles size={26} /><h3>아직 기록된 것이 없습니다.</h3><p>사건에서 지시할 때 새로운 항목을 더해 주세요.</p></div>}</div></div></section>;
  const renderDiary = () => <section className="panel"><div className="panel-header"><h2 className="panel-title">기억을 맡긴 물건</h2><span className="badge">{primaryDiaryCount} / {game.diaryCapacity ?? 4} 기억 · 별도 책 {counts.diary - primaryDiaryCount}개</span></div><div className="panel-body"><div className="notice"><BookOpen size={18} /><span>기억을 옮길 때 일기장 자원이 만들어집니다. 옮긴 기억에는 새 경험을 더할 수 없습니다.</span></div>{!game.diary.length && <div className="empty-state"><BookOpen size={32} /><h3>아직 쓰이지 않은 책</h3><p>기억 화면에서 기억 전체를 이곳으로 옮겨 보세요.</p><button className="button-secondary" onClick={() => setPage('memories')}>기억 살펴보기 <ArrowRight size={15} /></button></div>}<div className="memory-grid">{game.diary.map((entry, index) => <article className={`memory-card ${entry.isLost ? 'lost' : ''}`} key={entry.id}><div className="memory-card-header"><span className="memory-index">{String(index + 1).padStart(2, '0')} <span>{entry.isLost ? '잃은 일기' : '기록된 기억'}</span></span><BookOpen size={16} /></div><ol className="experience-list">{entry.experiences.map(item => <li className="experience-item" key={item.id}><p className="experience-text">{item.text}</p>{!entry.isLost && game.promptEditEnabled && <button className="icon-button" aria-label="사건 지시에 따라 일기 경험 수정" onClick={() => setMemoryEditor({
                diaryId: entry.id,
                memoryId: '',
                experienceId: item.id,
                text: item.text
              })}><Feather size={14} /></button>}</li>)}</ol>{entry.isLost && !entry.isForgotten && !entry.recoveredToId && game.promptEditEnabled && <button className="button-secondary" onClick={() => apply(state => rules.recoverLostDiaryMemory(state, entry.id))}>지시에 따라 이 페이지를 현재 일기장에 복구</button>}{!entry.isLost && <div className="item-actions"><button className="button-ghost" onClick={() => confirm('일기의 이 기억을 잊을까요?', '이 기억의 모든 경험이 함께 지워집니다.', () => apply(state => rules.forgetDiaryMemory(state, entry.id)))}>기록 전체 잃기</button>{game.promptEditEnabled && <button className="button-ghost" onClick={() => apply(state => rules.preserveDiaryMemory(state, entry.id))}>영구 기억으로 출판</button>}{game.promptEditEnabled && <button className="button-ghost" onClick={() => {
              const slot = game.memories.find(item => !item.experiences.length);
              if (!slot) return setToast('먼저 빈 기억 칸을 마련해 주세요.');
              apply(state => rules.restoreDiaryMemory(state, entry.id, slot.id));
            }}>지시에 따라 복구</button>}</div>}</article>)}</div>{primaryDiaryCount > 0 && <button className="button-danger" onClick={() => confirm('일기장 전체를 잃을까요?', '일기장 자원과 그 안의 모든 기억을 함께 잃습니다.', () => apply(state => rules.loseDiary(state)))}><Trash2 size={15} />일기장 잃기</button>}</div></section>;
  const renderJournal = () => <section className="panel"><div className="panel-header"><h2 className="panel-title">지나온 밤의 순서</h2><button className="button-secondary" onClick={exportSave}><ArrowDownToLine size={15} />기록 보관</button></div><div className="panel-body">{!game.journal.length && <div className="empty-state"><ScrollText size={30} /><h3>첫 문장은 아직 쓰이지 않았습니다.</h3><p>사건을 마칠 때마다 이곳에 기록이 쌓입니다.</p></div>}<div className="timeline">{[...game.journal].reverse().map(entry => <article className="timeline-entry" key={entry.id}><div className="timeline-meta"><span>사건 {String(entry.promptId).padStart(2, '0')} · {entry.visitCount}번째 방문</span><span>{entry.dateString}</span><button className="icon-button" aria-label="연대기 기록 수정" onClick={() => setJournalEditor({
              id: entry.id,
              text: entry.textContent
            })}><Feather size={14} /></button></div><p className="timeline-content">{entry.textContent}</p>{entry.rollText && <p className="field-hint">{entry.rollText}</p>}</article>)}</div></div></section>;
  const renderSetup = () => <form className="setup-layout" onSubmit={start}><section className="setup-intro"><span className="eyebrow">흡혈귀 창조</span><h2>처음의 기록</h2><p>살아 있던 시절의 사람과 물건, 당신을 바꾼 순간을 적습니다. 각 기억에는 경험 한 문장을 남겨 주세요.</p><div className="checklist">{[[!!setup.name.trim(), '한때 인간이었던 이름'], [lines(setup.skills).length === 3 && lines(setup.resources).length === 3, '기술 셋과 자원 셋'], [lines(setup.mortals).length >= 3 && !!setup.immortal.trim() && !!setup.mark.trim(), '사람들, 창조자, 그리고 표식'], [setup.memories.filter(text => text.trim()).length === 5, '다섯 기억에 경험 하나씩']].map(([done, label], index) => <div className={`checklist-item ${done ? 'complete' : ''}`} key={index}>{done ? <Check size={14} /> : <span className="checklist-circle" />}<span>{label}</span></div>)}</div><button className="button-ghost" type="button" onClick={() => {
        if (setup.name || setup.origin || setup.skills || setup.resources || setup.memories.some(Boolean)) confirm('예시 인물을 불러올까요?', '작성 중인 시작 정보를 예시 인물 ‘서윤’으로 바꿉니다.', () => setSetup(sample));else setSetup(sample);
      }}>예시 인물로 채워 보기 <ArrowRight size={15} /></button></section>
        <section className="setup-form"><div className="setup-step"><span className="step-number">01</span><div><h3>당신은 누구였나요?</h3><p className="field-hint">시대와 장소, 인간 시절의 삶을 떠올려 보세요.</p></div></div><Field label="이름"><input className="input" value={setup.name} onChange={event => updateSetup('name', event.target.value)} placeholder="영원한 밤에 남길 이름" required /></Field><Field label="시대와 기원"><textarea className="textarea" rows={2} value={setup.origin} onChange={event => updateSetup('origin', event.target.value)} placeholder="언제, 어디서, 어떤 삶을 살았나요?" required /></Field>
        <div className="setup-step"><span className="step-number">02</span><div><h3>당신의 세계를 이루던 것들</h3><p className="field-hint">한 줄에 하나씩. 이름 뒤에 짧은 설명을 붙여도 좋습니다.</p></div></div><div className="form-grid"><Field label={`기술 · ${lines(setup.skills).length}/3`} hint="인간 시절에 어울리는 기술 세 가지"><textarea className="textarea" rows={3} value={setup.skills} onChange={event => updateSetup('skills', event.target.value)} placeholder={'고문서 해독\n약초 다루기\n상인의 흥정'} required /></Field><Field label={`자원 · ${lines(setup.resources).length}/3`} hint="움직일 수 없다면 [정착]으로 시작하세요."><textarea className="textarea" rows={3} value={setup.resources} onChange={event => updateSetup('resources', event.target.value)} placeholder={'은반지\n[정착] 강가의 집\n편지를 전하는 말'} required /></Field></div><Field label={`필멸자 · ${lines(setup.mortals).length}명`} hint="최소 세 명. 각자 당신과 어떤 관계인가요?"><textarea className="textarea" rows={3} value={setup.mortals} onChange={event => updateSetup('mortals', event.target.value)} placeholder={'연화: 나를 믿는 누이\n도겸: 나의 스승\n우진: 오래된 친구'} required /></Field><div className="form-grid"><Field label="당신을 바꾼 불멸자"><input className="input" value={setup.immortal} onChange={event => updateSetup('immortal', event.target.value)} placeholder="누가 불멸을 주었나요?" required /></Field><Field label="표식 하나"><input className="input" value={setup.mark} onChange={event => updateSetup('mark', event.target.value)} placeholder="무엇을 어떻게 감추나요?" required /></Field></div>
        <div className="setup-step"><span className="step-number">03</span><div><h3>다섯 개의 처음</h3><p className="field-hint">각각 별개의 기억이 됩니다. 경험마다 한 문장을 쓰세요.</p></div></div>{setup.memories.map((text, index) => <Field key={index} label={`${String(index + 1).padStart(2, '0')} · ${index === 0 ? '인간 시절의 삶' : index === 4 ? '흡혈귀가 된 순간' : '특성 두 가지를 잇는 사건'}`}><textarea className="textarea" rows={2} value={text} onChange={event => updateSetup('memories', setup.memories.map((value, position) => position === index ? event.target.value : value))} placeholder={index === 0 ? '나는 …이었다; 나에게는 …이 중요했다.' : index === 4 ? '그날 …이 나를 바꾸었다; 이후 나는 ….' : '사람과 물건, 기술과 사건을 하나의 경험으로 엮어 보세요.'} required /></Field>)}<Field label="기록 방식"><select className="select" value={setup.mode} onChange={event => updateSetup('mode', event.target.value as Setup['mode'])}><option value="journal">저널링 · 긴 이야기와 한 문장의 경험</option><option value="quick">빠른 게임 · 한 문장의 경험으로</option></select></Field><button className="button-primary setup-submit" type="submit">첫 번째 밤으로 <ArrowRight size={18} /></button><p className="field-hint">작성 내용은 이 기기에 자동 저장됩니다.</p></section></form>;
  const renderConfirmation = (confirmation: Confirmation) => <Modal title={confirmation.title} close={() => setConfirmation(null)} footer={<><button className="button-secondary" onClick={() => setConfirmation(null)}>취소</button><button className="button-primary" onClick={() => {
      confirmation.action();
      setConfirmation(null);
    }}>적용하기 <ArrowRight size={15} /></button></>}><p>{confirmation.text}</p></Modal>;
  const renderCost = () => <Modal title="사건의 비용 지불" close={() => setCostMode(null)}>
      <p>{!costChoices.length ? '체크할 기술도 잃을 자원도 없습니다. 이 사건을 바탕으로 최후를 기록해야 합니다.' : costUsesSkill ? '직접 체크할 기술을 선택하세요.' : '직접 잃을 자원을 선택하세요. 일기장을 고르면 그 안의 기억도 함께 잃습니다.'}</p>
      {costChoices.length > 0 && <Field label={costUsesSkill ? '체크할 기술' : '잃을 자원'}><select className="select" value={selectedCost} onChange={event => setCostSelection(event.target.value)}>{costChoices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
      {(costMode === 'check' ? !uncheckedSkills.length : !liveResources.length) && !!costChoices.length && <div className="notice warning">원래 비용을 지불할 수 없어 대체 비용을 냅니다. 가장 좋지 않은 결과로 서술하세요.</div>}
      <div className="modal-footer"><button className="button-secondary" onClick={() => setCostMode(null)}>취소</button><button className="button-primary" onClick={payCost}>{costChoices.length ? '선택한 비용 적용' : '최후를 맞이하기'}</button></div>
    </Modal>;
  const renderSeason = () => <Modal title="다음 천 년의 첫 장" close={() => setSeasonModal(false)}>
      <p>평화의 결말이 주는 필멸자 둘, 자원 둘, 기술 둘을 적으세요. 기억 칸 셋을 더하고, 이전 방문 기록을 간직한 채 사건 0에서 다음 주사위를 굴립니다.</p>
      {(['mortals', 'resources', 'skills'] as const).map(kind => <Field key={kind} label={`${{
      mortals: '필멸자',
      resources: '자원',
      skills: '기술'
    }[kind]} · 두 줄로 작성`}><textarea className="textarea" rows={3} value={seasonTraits[kind]} onChange={event => setSeasonTraits(previous => ({
        ...previous,
        [kind]: event.target.value
      }))} /></Field>)}
      <div className="modal-footer"><button className="button-secondary" onClick={() => setSeasonModal(false)}>아직 이 평화에 머무르기</button><button className="button-primary" onClick={() => {
        if (apply(state => rules.startNextSeason(state, {
          mortals: lines(seasonTraits.mortals),
          resources: lines(seasonTraits.resources),
          skills: lines(seasonTraits.skills)
        }), '다음 시즌의 첫 장을 열었습니다.', true)) {
          setSeasonModal(false);
          setPage('play');
          setJournalText('');
          setExperience('');
        }
      }}>다음 시즌 시작 <ArrowRight size={15} /></button></div>
    </Modal>;
  const renderSpecial = () => <Modal title="사건의 예외를 기록표에 적용" close={() => setSpecialTool(false)}>
      <p className="field-hint">사건 지시에 따른 수정 모드를 켜고, 현재 사건이 허용한 변화만 적용하세요.</p>
      <Field label="적용할 지시"><select className="select" value={specialAction} onChange={event => setSpecialAction(event.target.value)}><option value="capacity">한 기억에 담을 수 있는 경험 수 변경</option><option value="label">기억 칸의 주제·제한 설정</option><option value="diary">기본 일기장의 기억 용량 변경</option><option value="merge">두 기억을 하나로 합치기</option><option value="extra">한 기억을 담는 별도 책 획득</option><option value="directDiary">이번 사건의 경험을 일기장에 직접 쓰기</option></select></Field>
      {['capacity', 'label', 'merge'].includes(specialAction) && <Field label="대상 기억"><select className="select" value={specialMemory} onChange={event => setSpecialMemory(event.target.value)}>{game.memories.map((memory, index) => <option key={memory.id} value={memory.id}>기억 {index + 1}</option>)}</select></Field>}
      {specialAction === 'merge' && <Field label="이 기억으로 합치기"><select className="select" value={specialTarget} onChange={event => setSpecialTarget(event.target.value)}>{game.memories.map((memory, index) => <option key={memory.id} value={memory.id}>기억 {index + 1}</option>)}</select></Field>}
      {['capacity', 'diary'].includes(specialAction) && <Field label="지시받은 새 용량"><input className="input" type="number" min="1" max="100" value={specialNumber} onChange={event => setSpecialNumber(Number(event.target.value))} /></Field>}
      {['label', 'extra', 'directDiary'].includes(specialAction) && <Field label={specialAction === 'label' ? '주제 또는 제한' : '기록할 한 문장의 경험'}><textarea className="textarea" rows={4} value={specialText} onChange={event => setSpecialText(event.target.value)} /></Field>}
      <div className="modal-footer"><button className="button-secondary" onClick={() => setSpecialTool(false)}>취소</button><button className="button-primary" onClick={applySpecial}>지시 적용</button></div>
    </Modal>;
  const renderEntityEditor = (editor: Editor) => <Modal title={`${{
    skills: '기술',
    resources: '자원',
    characters: '등장인물',
    marks: '표식'
  }[editor.kind]} ${editor.id ? '수정' : '추가'}`} close={() => setEditor(null)}><form onSubmit={saveEntity}><Field label="이름과 설명"><textarea className="textarea" rows={3} value={editor.text} onChange={event => setEditor({
          ...editor,
          text: event.target.value
        })} placeholder="이름: 짧은 설명" required /></Field>{editor.kind === 'resources' && <label className="checkbox-row"><input type="checkbox" checked={editor.stationary} onChange={event => setEditor({
          ...editor,
          stationary: event.target.checked
        })} />떠날 때 가져갈 수 없는 정착 자원</label>}{editor.kind === 'characters' && <Field label="존재의 종류"><select className="select" value={editor.immortal ? 'immortal' : 'mortal'} onChange={event => setEditor({
          ...editor,
          immortal: event.target.value === 'immortal'
        })}><option value="mortal">필멸자</option><option value="immortal">불멸자</option></select></Field>}<p className="field-hint">현재 사건에서 지시한 변화를 기록하세요.</p><div className="modal-footer"><button className="button-secondary" type="button" onClick={() => setEditor(null)}>취소</button><button className="button-primary" type="submit">기록하기 <Check size={15} /></button></div></form></Modal>;
  const renderMemoryEditor = (memoryEditor: {
    memoryId: string;
    experienceId: string;
    text: string;
    diaryId?: string;
  }) => <Modal title="사건의 지시에 따라 경험 수정" close={() => setMemoryEditor(null)}><Field label="바뀐 경험"><textarea className="textarea" rows={5} value={memoryEditor.text} onChange={event => setMemoryEditor({
        ...memoryEditor,
        text: event.target.value
      })} /></Field><button className="button-primary" onClick={() => {
      if (apply(state => memoryEditor.diaryId ? rules.editDiaryExperience(state, memoryEditor.diaryId, memoryEditor.experienceId, memoryEditor.text) : rules.editExperience(state, memoryEditor.memoryId, memoryEditor.experienceId, memoryEditor.text))) setMemoryEditor(null);
    }}>수정 기록하기</button><button className="button-danger" onClick={() => confirm('이 경험만 지우라는 지시인가요?', '기본 망각은 기억 전체에 적용합니다. 사건이 이 경험의 삭제를 명시한 경우에만 적용하세요.', () => {
      if (apply(state => memoryEditor.diaryId ? rules.deleteDiaryExperience(state, memoryEditor.diaryId, memoryEditor.experienceId) : rules.deleteExperience(state, memoryEditor.memoryId, memoryEditor.experienceId))) setMemoryEditor(null);
    })}>지시에 따라 이 경험만 삭제</button></Modal>;
  const renderJournalEditor = (journalEditor: {
    id: string;
    text: string;
  }) => <Modal title={journalEditor.id === 'finale' ? '최후의 이야기 기록' : '연대기 수정'} close={() => setJournalEditor(null)}><Field label="이야기"><textarea className="textarea" rows={6} value={journalEditor.text} onChange={event => setJournalEditor({
        ...journalEditor,
        text: event.target.value
      })} /></Field><button className="button-primary" onClick={() => {
      apply(state => journalEditor.id === 'finale' ? {
        ...state,
        gameOverText: journalEditor.text
      } : {
        ...state,
        journal: state.journal.map(entry => entry.id === journalEditor.id ? {
          ...entry,
          textContent: journalEditor.text
        } : entry)
      }, '기록을 갱신했습니다.', true);
      setJournalEditor(null);
    }}>기록 갱신</button></Modal>;
  const renderAlternate = () => <Modal title="다른 운명의 갈래" close={() => setAltModal(false)}><p className="field-hint">현재 번호에 대체 사건을 연결합니다. 다음 방문에도 같은 사건의 다음 문단을 읽습니다.</p><Field label="부록의 대체 사건"><select className="select" value={altSelection} onChange={event => setAltSelection(Number(event.target.value))}>{alternatePrompts.map(item => <option key={item.id} value={item.id}>{item.sourceLabel} · {item.category}</option>)}</select></Field><div className="alt-preview">{alternatePrompts.find(item => item.id === altSelection)?.entries?.[0] ?? alternatePrompts.find(item => item.id === altSelection)?.text}</div><div className="modal-footer"><button className="button-secondary" onClick={() => {
        if (apply(state => rules.chooseAlternatePrompt(state, null))) setAltModal(false);
      }}>기본 사건 사용</button><button className="button-primary" onClick={() => {
        if (apply(state => rules.chooseAlternatePrompt(state, altSelection))) setAltModal(false);
      }}>이 사건으로 대체 <ArrowRight size={15} /></button></div></Modal>;
  const renderConflict = (conflict: GameState) => <Modal title="두 곳의 기록이 다릅니다" close={() => {}}><p>기기의 ‘{game.characterName || '새 기록'}’과 클라우드의 ‘{conflict.characterName || '새 기록'}’ 중 이어갈 기록을 선택하세요. 선택 전에는 클라우드에 덮어쓰지 않습니다.</p><div className="form-row"><button className="button-secondary" onClick={exportSave}>기기 기록 먼저 내보내기</button><button className="button-secondary" onClick={() => { stopRoll(); chooseSave('local'); }}>이 기기 기록 사용</button><button className="button-primary" onClick={() => { stopRoll(); chooseSave('cloud'); }}>클라우드 기록 사용</button></div></Modal>;
  return <div className="app-shell"><a className="skip-link" href="#main-content">본문으로 이동</a>
    <header className="app-topbar"><button className="brand" onClick={() => setPage('play')} aria-label="이야기 처음 화면"><span><strong className="brand-name">Thousand Year Old Vampire</strong><span className="brand-kicker">천년 동안 살아온 흡혈귀</span></span></button><div className="topbar-actions"><span className="save-status"><span className="status-dot" />{status}</span><button className="button-ghost" onClick={exportSave} title="기록 파일 내보내기"><ArrowDownToLine size={16} /><span>내보내기</span></button><button className="button-secondary" onClick={user ? logout : login}>{user ? <LogOut size={15} /> : <LogIn size={15} />}<span>{user ? '로그아웃' : '로그인'}</span></button></div></header>
    <div className="workspace"><aside className="sidebar"><div className="sidebar-intro"><span className="eyebrow">내 기록</span><h2>{started ? game.characterName : '새로운 기록'}</h2><p>{started ? game.vampireOrigin || '지나온 삶의 흔적을 기록합니다.' : '다섯 기억으로 시작하는 흡혈귀의 연대기.'}</p></div><nav className="nav-list" aria-label="기록표 탐색">{navigation.map(([id, label, Icon]) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} disabled={!started} onClick={() => setPage(id)} aria-current={page === id ? 'page' : undefined}><Icon size={18} className="nav-icon" /><span className="nav-label">{label}</span>{id === 'play' ? <ChevronRight size={15} /> : <span className="nav-count">{counts[id]}</span>}</button>)}</nav><div className="sidebar-footer"><button className={`nav-item ${page === 'rules' ? 'active' : ''}`} onClick={() => setPage('rules')}><CircleHelp size={18} />규칙 안내</button><button className="nav-item" onClick={() => importRef.current?.click()}><ArrowUpFromLine size={18} />기록 불러오기</button>{started && <button className="nav-item" onClick={() => confirm('새로운 이야기를 시작할까요?', '현재 기록을 먼저 파일로 내보내 주세요. 기기에는 복구본 하나가 남고, 새 이야기가 현재 기록을 대체합니다.', () => {
            backup();
            setGame(rules.createInitialGameState());
            setSetup(emptySetup);
            setJournalText('');
            setExperience('');
            setPage('play');
          })}><RotateCcw size={17} />새로운 이야기</button>}<div className="sidebar-colophon">A SOLO ROLEPLAYING COMPANION<br /><span>Based on the game by Tim Hutchings</span></div></div></aside>
    <main className="workspace-main" id="main-content" tabIndex={-1}><div className="page-heading"><div><h1 className="page-title">{heading[1]}</h1><p className="page-description">{heading[2]}</p></div></div>
      {error && <div className="notice warning" role="alert"><Cloud size={18} /><span>{error}</span><button className="icon-button" onClick={dismissError} aria-label="알림 닫기"><X size={16} /></button></div>}
      {!!game.migrationNotes?.length && <details className="notice"><summary>이전 기록에서 확인할 항목 {game.migrationNotes.length}개</summary><ul>{game.migrationNotes.map((note, index) => <li key={index}>{note}</li>)}</ul></details>}
      {page === 'rules' ? renderRules() : !started ? renderSetup() : <><div className="stats-strip">{[['기억', `${counts.memories} / ${game.memories.length}`, Library], ['체크 가능한 기술', game.skills.filter(item => !item.isChecked && !item.isLost).length, Sword], ['남은 자원', counts.resources, Gem], ['지나온 사건', game.turnCount ?? game.journal.length, History]].map(([label, value, Icon]) => {
              const StatIcon = Icon as typeof Library;
              return <div className="stat-item" key={label as string}><StatIcon size={17} /><span className="stat-label">{label as string}</span><span className="stat-value">{value as string}</span></div>;
            })}</div>
      {game.isGameOver && <section className="ending-banner"><div><p className="eyebrow">THE LAST PAGE</p><h2>당신의 밤이 저물었습니다.</h2><p>{game.gameOverText}</p>{prompt.seasonBreak && <button className="button-primary" onClick={() => setSeasonModal(true)}>같은 인물의 다음 시즌 <ArrowRight size={15} /></button>}<button className="button-ghost" onClick={() => setJournalEditor({
                id: 'finale',
                text: journalText.trim() || game.gameOverText
              })}>최후의 이야기 기록 <Feather size={14} /></button></div><button className="button-secondary" onClick={exportSave}><ArrowDownToLine size={16} />이야기 보관하기</button></section>}
      {page === 'play' && renderPlay()}
      {page === 'memories' && <><div className="notice"><Library size={18} /><span>사건의 지시로 수정·복구할 때는 이야기 화면의 ‘특별한 지시 적용’을 켜세요.</span></div><div className="memory-grid">{game.memories.map((memory, index) => <div key={memory.id}>{memoryCard(memory, index)}{game.promptEditEnabled && <div className="item-actions"><button className="button-ghost" onClick={() => confirm('이 기억 칸을 영구히 잃을까요?', '사건이 명시적으로 칸 자체를 잃으라고 지시했을 때 적용합니다.', () => apply(state => rules.reduceMemoryCapacity(state, memory.id)))}>이 기억 칸을 잃기</button><button className="button-ghost" onClick={() => apply(state => rules.preserveMemory(state, memory.id))}>영구 기억으로 보존</button><button className="button-ghost" onClick={() => confirm('이 기억을 영원히 잊을까요?', '사건이 영구 삭제를 명시한 경우에만 적용합니다. 이후 복구 지시로도 되살릴 수 없습니다.', () => apply(state => rules.forgetMemory(state, memory.id, '사건 지시에 따라 영원히 잊었습니다.', false)))}>영원히 잊기</button></div>}</div>)}</div>{!!game.permanentMemories?.length && <section className="panel"><div className="panel-header"><h2 className="panel-title">별도로 보존하는 영구 기억</h2></div><div className="panel-body">{game.permanentMemories.map((memory, index) => memoryCard(memory, index, true))}</div></section>}{!!game.forgottenMemories?.length && <details className="panel"><summary>잊은 기억의 흔적 · {game.forgottenMemories.length}</summary><div className="panel-body">{game.forgottenMemories.map(memory => <article className="entity-card lost" key={memory.id}><div>{memory.experiences.map(item => <p key={item.id}>{item.text}</p>)}</div>{game.promptEditEnabled && <button className="button-secondary" onClick={() => {
                    const slot = game.memories.find(item => !item.experiences.length);
                    if (!slot) return setToast('복구할 빈 기억 칸을 먼저 마련해 주세요.');
                    apply(state => rules.restoreForgottenMemory(state, memory.id, slot.id));
                  }}>빈 칸에 복구</button>}</article>)}</div></details>}</>}
      {(['skills', 'resources', 'characters', 'marks'] as Page[]).includes(page) && renderEntities()}
      {page === 'diary' && renderDiary()}
      {page === 'journal' && renderJournal()}
      </>}
      <footer className="footer"><span>THOUSAND YEAR OLD VAMPIRE</span><span>기억은 사라져도, 이야기는 남습니다.</span><button className="button-ghost" onClick={() => setPage('rules')}>룰북과 함께 <ArrowRight size={12} /></button></footer>
    </main></div>
    <input className="sr-only" ref={importRef} type="file" accept=".json,application/json" aria-label="기록 파일 선택" onChange={event => {
      const file = event.target.files?.[0];
      if (file) void importSave(file);
      event.target.value = '';
    }} />
    {toast && <div className="toast" role="status"><span>{toast}</span><button className="icon-button" onClick={() => setToast('')} aria-label="알림 닫기"><X size={16} /></button></div>}
    {confirmation && renderConfirmation(confirmation)}
    {costMode && renderCost()}
    {seasonModal && renderSeason()}
    {specialTool && renderSpecial()}
    {editor && renderEntityEditor(editor)}
    {memoryEditor && renderMemoryEditor(memoryEditor)}
    {journalEditor && renderJournalEditor(journalEditor)}
    {altModal && renderAlternate()}
    {conflict && renderConflict(conflict)}
  </div>;
}
export default App;
