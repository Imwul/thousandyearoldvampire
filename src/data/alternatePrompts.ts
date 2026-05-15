import { altPart1 } from './alt_p1';
import { altPart2 } from './alt_p2';
import { altPart3 } from './alt_p3';

export interface AltPrompt {
  id: number;
  category: string;
  text: string;
}

// Combine all 135 translated alternative prompts from modular parts to ensure 100% complete content delivery!
export const alternatePrompts: AltPrompt[] = [
  ...altPart1,
  ...altPart2,
  ...altPart3
];
