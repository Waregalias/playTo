import { describe, it, expect } from 'vitest';
import { equipSkillsSchema, learnSkillSchema } from './skill.js';
import { chatSendSchema } from './chat.js';
import { contributeSchema } from './project.js';
import { createListingSchema, buyListingSchema } from './market.js';
import { wsServerEventSchema } from './ws.js';

describe('M3 contracts', () => {
  it('accepts a valid chat.send and rejects a >500 char body', () => {
    expect(chatSendSchema.safeParse({ type: 'chat.send', channel: 'global', body: 'salut' }).success).toBe(true);
    expect(
      chatSendSchema.safeParse({ type: 'chat.send', channel: 'region:1', body: 'x'.repeat(501) }).success,
    ).toBe(false);
    expect(chatSendSchema.safeParse({ type: 'chat.send', channel: 'region:9', body: 'y' }).success).toBe(false);
  });
  it('validates contribution resource & positive qty', () => {
    expect(contributeSchema.safeParse({ resource: 'shadewood', qty: 10 }).success).toBe(true);
    expect(contributeSchema.safeParse({ resource: 'gold', qty: 10 }).success).toBe(false);
    expect(contributeSchema.safeParse({ resource: 'shadewood', qty: 0 }).success).toBe(false);
  });
  it('validates market listing bodies', () => {
    expect(createListingSchema.safeParse({ itemId: 'weapon.blade.t1', qty: 1, unitPrice: 50 }).success).toBe(true);
    expect(createListingSchema.safeParse({ itemId: 'x', qty: 1, unitPrice: 0 }).success).toBe(false);
    expect(buyListingSchema.safeParse({ qty: 2 }).success).toBe(true);
  });
  it('allows null equip slots (unequip)', () => {
    expect(equipSkillsSchema.safeParse({ slot1: null, slot2: 'blade.steel.1' }).success).toBe(true);
    expect(learnSkillSchema.safeParse({ skillId: 'blade.bulwark.2' }).success).toBe(true);
  });
  it('accepts a server event envelope', () => {
    expect(
      wsServerEventSchema.safeParse({ channel: 'region:1', type: 'project.progress', data: {}, at: '2026-07-06T00:00:00Z' }).success,
    ).toBe(true);
  });
});
