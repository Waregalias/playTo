import { describe, it, expect } from 'vitest';
import { chatHistorySchema } from './chat.js';

describe('chatHistorySchema', () => {
  it('accepts a page with a nullable cursor', () => {
    expect(chatHistorySchema.safeParse({ items: [], nextCursor: null }).success).toBe(true);
  });
});
