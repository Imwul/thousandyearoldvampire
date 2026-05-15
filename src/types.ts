export interface Experience {
  id: string;
  text: string;
}

export interface Memory {
  id: string;
  experiences: Experience[]; // Max 3
}

export interface Skill {
  id: string;
  name: string;
  isChecked: boolean;
  isAncient?: boolean;
}

export interface Resource {
  id: string;
  name: string;
  isStationary: boolean;
  isLost?: boolean;
}

export interface Character {
  id: string;
  name: string;
  type: 'mortal' | 'immortal';
  isAlive: boolean;
  relationship?: string;
}

export interface Mark {
  id: string;
  description: string;
}

export interface DiaryEntry {
  id: string;
  originalMemoryId: string;
  experiences: Experience[];
  timestamp: number;
}

export interface JournalEntry {
  id: string;
  promptId: number;
  visitCount: number; // Which variant was active
  rollText: string; // "1d10(X) - 1d6(Y) = Z"
  dateString: string; // e.g. "14세기 초기" or relative time
  textContent: string;
  timestamp: number;
}

export interface GameState {
  currentPromptId: number;
  promptVisitHistory: Record<number, number>; // count of visits per prompt
  memories: Memory[]; // Always exactly 5 active memory containers (some can be empty though standard starts with 5)
  diary: DiaryEntry[];
  skills: Skill[];
  resources: Resource[];
  characters: Character[];
  marks: Mark[];
  journal: JournalEntry[];
  isGameOver: boolean;
  gameOverText: string;
  characterName: string;
  vampireOrigin: string; // summary of start
  isAltActive?: boolean;
  activeAltIdx?: number | null;
}

