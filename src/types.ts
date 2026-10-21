export interface Experience {
  id: string;
  text: string;
}

export interface Memory {
  id: string;
  experiences: Experience[];
  /** Prompts may explicitly expand a slot beyond the usual three Experiences. */
  maxExperiences?: number;
  label?: string;
  isPermanent?: boolean;
  /** The peaceful alternate ending grants three slots that cannot be lost. */
  isPermanentSlot?: boolean;
}

export interface ForgottenMemory extends Memory {
  forgottenAt: number;
  reason: string;
  canRestore?: boolean;
}

export interface Skill {
  id: string;
  name: string;
  isChecked: boolean;
  isLost?: boolean;
  /** Legacy save metadata only; the supplied rulebook has no Ancient Skill rule. */
  isAncient?: boolean;
}

export interface Resource {
  id: string;
  name: string;
  isStationary: boolean;
  isLost?: boolean;
  isDiary?: boolean;
  /** An explicit Prompt may grant an additional book beyond the ordinary Diary. */
  isExtraDiary?: boolean;
  diaryCapacity?: number;
}

export interface Character {
  id: string;
  name: string;
  type: 'mortal' | 'immortal';
  isAlive: boolean;
  relationship?: string;
  /** Granted only by an explicit Prompt; protects against death by old age. */
  isAgeless?: boolean;
}

export interface Mark {
  id: string;
  description: string;
  isLost?: boolean;
}

export interface DiaryEntry {
  id: string;
  originalMemoryId: string;
  experiences: Experience[];
  timestamp: number;
  resourceId?: string;
  isLost?: boolean;
  maxExperiences?: number;
  /** Removed from the written Diary by a specific instruction, rather than lost with its book. */
  isForgotten?: boolean;
  /** Pages already recovered into a new Diary cannot be counted a second time. */
  recoveredToId?: string;
}

export interface JournalEntry {
  id: string;
  promptId: number;
  visitCount: number;
  rollText: string;
  dateString: string;
  textContent: string;
  timestamp: number;
  isAlternate?: boolean;
  alternateId?: number;
}

export interface MovementRoll {
  d10: number;
  d6: number;
  offset: number;
  from: number;
  to: number;
  skipped: number[];
  mode?: 'normal' | 'reverse' | 'backward' | 'sum';
}

export interface GameState {
  /** Stable identity keeps separate characters' unfinished writing apart. */
  storyId?: string;
  currentPromptId: number;
  promptVisitHistory: Record<number, number>;
  memories: Memory[];
  diary: DiaryEntry[];
  skills: Skill[];
  resources: Resource[];
  characters: Character[];
  marks: Mark[];
  journal: JournalEntry[];
  isGameOver: boolean;
  gameOverText: string;
  characterName: string;
  vampireOrigin: string;
  isAltActive?: boolean;
  activeAltIdx?: number | null;
  setupComplete?: boolean;
  playMode?: 'quick' | 'journal';
  currentPromptResolved?: boolean;
  experienceRecorded?: boolean;
  experienceCount?: number;
  experienceWaived?: boolean;
  promptEditEnabled?: boolean;
  lastRoll?: MovementRoll;
  forgottenMemories?: ForgottenMemory[];
  permanentMemories?: Memory[];
  diaryResourceId?: string;
  /** A Prompt can explicitly grant more space than the ordinary four. */
  diaryCapacity?: number;
  migrationNotes?: string[];
  sequence?: number;
  schemaVersion?: number;
  turnCount?: number;
  season?: number;
  persistentRollMode?: 'normal' | 'reverse';
  /** A replacement page persists for subsequent visits, as Appendix I instructs. */
  promptAlternates?: Record<number, number>;
  nextRollMode?: 'normal' | 'reverse' | 'backward' | 'sum';
}
