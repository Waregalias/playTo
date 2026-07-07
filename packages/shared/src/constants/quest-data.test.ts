import { describe, it, expect } from 'vitest';
import { QUEST_DEFINITIONS } from './quest-data.js';
import { questGraphSchema } from '../schemas/quest.js';

describe('Q5 community project quest', () => {
  it('defines r1.main.q5 requiring q4 with a project step', () => {
    const q5 = QUEST_DEFINITIONS.find((q) => q.id === 'r1.main.q5');
    expect(q5).toBeDefined();
    expect(q5!.requires).toMatchObject({ quest: 'r1.main.q4' });
    const graph = questGraphSchema.parse(q5!.steps);
    const step = graph.steps.find((s) => s.kind === 'project');
    expect(step).toBeDefined();
  });
});
