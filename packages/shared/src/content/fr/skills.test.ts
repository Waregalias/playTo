import { describe, it, expect } from 'vitest';
import { SKILLS } from '../../constants/skills.js';
import { SKILL_CONTENT_FR } from './skills.js';

describe('French skill content', () => {
  it('has a name & description for every skill', () => {
    for (const s of SKILLS) {
      const c = SKILL_CONTENT_FR[s.id];
      expect(c, s.id).toBeDefined();
      expect(c!.name.length).toBeGreaterThan(0);
      expect(c!.description.length).toBeGreaterThan(0);
    }
  });
  it('has no orphan content keys', () => {
    const ids = new Set(SKILLS.map((s) => s.id));
    for (const key of Object.keys(SKILL_CONTENT_FR)) expect(ids.has(key), key).toBe(true);
  });
});
