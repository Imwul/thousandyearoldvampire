import { altPart1 } from './alt_p1';
import { altPart2 } from './alt_p2';
import { altPart3 } from './alt_p3';
import type { PromptEnding } from './prompts';

export interface AltPrompt {
  /** Stable application ID. 136 preserves the book's second, duplicated no. 74. */
  id: number;
  /** One-based PDF page in the supplied second-printing rulebook. */
  page: number;
  sourceNumber?: number;
  sourceLabel: string;
  category: string;
  entries: string[];
  /** First-visit preview used by the alternate picker. */
  text: string;
  endingByVisit?: Record<number, PromptEnding>;
  conditionalEndingVisits?: number[];
  experienceByVisit?: Record<number, number>;
  kind?: 'ending';
  /** The peaceful ending permits returning with the same character for a new season. */
  seasonBreak?: boolean;
}

/** The five unnumbered choices on PDF p133, headed “Alternate Ending Prompt”. */
export const alternateEndingPrompts: AltPrompt[] = [
  {
    id: 137, page: 133, sourceLabel: '엔딩 1', category: '인류를 잊은 은둔', kind: 'ending',
    entries: ['누구도 찾지 못할 만큼 외딴곳으로 스스로 물러납니다. 너무 오래 머물러 인류의 존재도 잊습니다. 무엇으로 시간을 보냅니까? 게임이 끝났습니다.'],
    text: '누구도 찾지 못할 곳에서 인류의 존재마저 잊습니다.', endingByVisit: { 1: 'required' },
  },
  {
    id: 138, page: 133, sourceLabel: '엔딩 2', category: '정신의 마지막', kind: 'ending',
    entries: ['육신은 완벽한 기계처럼 계속되지만 모든 것을 받아들인 정신은 천천히 먼지가 됩니다. 무엇을 남깁니까? 게임이 끝났습니다.'],
    text: '육신은 계속되지만 정신은 천천히 먼지가 됩니다.', endingByVisit: { 1: 'required' },
  },
  {
    id: 139, page: 133, sourceLabel: '엔딩 3', category: '세계의 잔해', kind: 'ending',
    entries: ['필멸자의 세계가 스스로 철저히 무너지고 당신은 잔해 위의 강력한 존재로 남습니다. 무슨 일이 있었습니까? 이제 시간을 무엇에 씁니까? 게임이 끝났습니다.'],
    text: '필멸자의 세계가 무너지고 당신은 잔해 위에 남습니다.', endingByVisit: { 1: 'required' },
  },
  {
    id: 140, page: 133, sourceLabel: '엔딩 4', category: '잊힌 햇빛', kind: 'ending',
    entries: ['너무 많은 것을 잊어 왜 햇빛에 나가지 않는지도 잊습니다. 무엇 때문에 나가 봅니까? 무슨 일이 일어나는지 깨달으며 어떻게 느낍니까? 게임이 끝났습니다.'],
    text: '햇빛을 피하던 이유까지 잊은 채 밖으로 나갑니다.', endingByVisit: { 1: 'required' },
  },
  {
    id: 141, page: 133, sourceLabel: '엔딩 5', category: '다음 천 년의 평화', kind: 'ending', seasonBreak: true,
    entries: ['앞으로도 천 년을 더 삽니다. 지금은 한동안 진정한 평화와 안정을 얻습니다. 영구 기억 칸 3개, 필멸자 등장인물 2명, 자원 2개, 기술 2개를 얻으십시오. 다시 하고 싶어지면 같은 등장인물로 프롬프트 0부터 시작하십시오. 이미 채운 프롬프트는 두 번째 시즌에도 채워 둡니다. 미래의 과학이나 세계 설정은 등장할 때 만들고, 사람의 근본은 같다고 여기십시오.'],
    text: '잠시 평화를 얻고 같은 인물의 다음 시즌으로 돌아올 수 있습니다.', endingByVisit: { 1: 'optional' },
  },
];

/**
 * Choose any alternate to replace one numbered base Prompt, then keep that
 * assignment and progress through its own entries. Appendix I sets no fixed
 * relationship between an alternate's printed number and a base Prompt number.
 *
 * The book has 135 distinct printed numbers, a second no. 74, and five
 * unnumbered ending choices. Preserve all of them rather than silently merging.
 */
export const alternatePrompts: AltPrompt[] = [
  ...altPart1,
  ...altPart2,
  ...altPart3,
  ...alternateEndingPrompts,
];
