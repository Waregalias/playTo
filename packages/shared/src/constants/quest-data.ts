import {
  questGraphSchema,
  questRewardsSchema,
  questRequiresSchema,
  type QuestGraph,
  type QuestRewards,
} from '../schemas/quest.js';

export interface QuestDefinition {
  id: string;
  regionId: number;
  kind: 'main' | 'side' | 'daily';
  steps: QuestGraph;
  rewards: QuestRewards;
  requires?: { quest?: string; level?: number };
}

/** Region 1 main chain, Q1→Q4 (GDD §10.2). Q5/Q6 are community — M3/M4. */
const RAW_QUESTS: QuestDefinition[] = [
  {
    id: 'r1.main.q1',
    regionId: 1,
    kind: 'main',
    steps: {
      start: 's1',
      steps: [{ id: 's1', kind: 'reach', poiType: 'old-ford-shrine', next: null }],
    },
    rewards: { xp: 30, ashCrowns: 10 },
  },
  {
    id: 'r1.main.q2',
    regionId: 1,
    kind: 'main',
    requires: { quest: 'r1.main.q1' },
    steps: {
      start: 's1',
      steps: [
        { id: 's1', kind: 'search', poiType: 'vellebrune-low-ruins', next: 's2' },
        { id: 's2', kind: 'kill', foeSlug: 'soot-wolf', count: 1, next: null },
      ],
    },
    rewards: {
      xp: 60,
      ashCrowns: 20,
      items: [{ itemId: 'consumable.ash-potion', qty: 1 }],
    },
  },
  {
    id: 'r1.main.q3',
    regionId: 1,
    kind: 'main',
    requires: { quest: 'r1.main.q2' },
    steps: {
      start: 's1',
      steps: [
        { id: 's1', kind: 'reach', poiType: 'shepherd-cairns', next: 's2' },
        {
          id: 's2',
          kind: 'choice',
          next: null,
          options: [
            { id: 'protect', next: 's3a' },
            { id: 'truth', next: 's3b' },
          ],
        },
        // Voie de la compassion : trois vagues de Bergers spectraux.
        {
          id: 's3a',
          kind: 'kill',
          foeSlug: 'spectral-shepherd',
          count: 3,
          next: null,
          extraRewards: { ashCrowns: 30 },
        },
        // Voie de la vérité : le choix cruel (GDD Q3-B).
        {
          id: 's3b',
          kind: 'choice',
          next: null,
          options: [
            { id: 'disperse', next: null, extraRewards: { skillPoints: 1 } },
            { id: 'silence', next: null, extraRewards: { ashCrowns: 40 } },
          ],
        },
      ],
    },
    rewards: { xp: 100 },
  },
  {
    id: 'r1.main.q4',
    regionId: 1,
    kind: 'main',
    requires: { quest: 'r1.main.q3' },
    steps: {
      start: 's1',
      steps: [
        { id: 's1', kind: 'reach', poiType: 'sighing-marsh', next: 's2' },
        {
          id: 's2',
          kind: 'combat',
          foeSlug: 'hollow-knight',
          atPoiType: 'sighing-marsh',
          next: null,
        },
      ],
    },
    // `$class` resolves to the character's class server-side.
    rewards: { xp: 200, ashCrowns: 50, items: [{ itemId: 'weapon.$class.t2', qty: 1 }] },
  },
];

export const QUEST_DEFINITIONS: QuestDefinition[] = RAW_QUESTS.map((quest) => ({
  ...quest,
  steps: questGraphSchema.parse(quest.steps),
  rewards: questRewardsSchema.parse(quest.rewards),
  requires: quest.requires ? questRequiresSchema.parse(quest.requires) : undefined,
}));
