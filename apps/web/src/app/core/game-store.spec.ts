import { TestBed } from '@angular/core/testing';
import { GameStore } from './game-store';
import { ApiClient } from './api-client';

describe('GameStore — M3 additions', () => {
  it('loads project detail into currentProject', async () => {
    const apiMock = {
      getProjectDetail: vi.fn().mockResolvedValue({
        id: 'r1.belfry',
        name: 'Beffroi',
        goals: {},
        progress: {},
        completedAt: null,
        myContribution: {},
        contributorCount: 3,
      }),
    };
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: apiMock }] });
    const store = TestBed.inject(GameStore);
    await store.refreshProject('r1.belfry');
    expect(store.currentProject()?.contributorCount).toBe(3);
    expect(apiMock.getProjectDetail).toHaveBeenCalledWith('r1.belfry');
  });

  it('appends a chat message only for the active channel', () => {
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: {} }] });
    const store = TestBed.inject(GameStore);
    store.chatChannel.set('global');
    store.appendChatMessage({
      id: '1',
      channel: 'region:1',
      characterId: 'c',
      characterName: 'X',
      body: 'hi',
      at: new Date().toISOString(),
    });
    expect(store.chatMessages()).toEqual([]);
    store.appendChatMessage({
      id: '2',
      channel: 'global',
      characterId: 'c',
      characterName: 'X',
      body: 'hi',
      at: new Date().toISOString(),
    });
    expect(store.chatMessages()).toHaveLength(1);
  });

  it('reverses chat history to oldest-first for display', async () => {
    const apiMock = {
      getChatHistory: vi.fn().mockResolvedValue({
        items: [
          {
            id: '2',
            channel: 'global',
            characterId: 'c',
            characterName: 'X',
            body: 'second',
            at: '2026-01-01T00:00:01Z',
          },
          {
            id: '1',
            channel: 'global',
            characterId: 'c',
            characterName: 'X',
            body: 'first',
            at: '2026-01-01T00:00:00Z',
          },
        ],
        nextCursor: null,
      }),
    };
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: apiMock }] });
    const store = TestBed.inject(GameStore);
    await store.loadChatHistory('global');
    expect(store.chatMessages().map((m) => m.id)).toEqual(['1', '2']);
    expect(store.chatChannel()).toBe('global');
  });

  it('loads listings into the store', async () => {
    const apiMock = {
      getListings: vi.fn().mockResolvedValue({ items: [{ id: 'l1' }], nextCursor: null }),
    };
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: apiMock }] });
    const store = TestBed.inject(GameStore);
    await store.refreshListings();
    expect(store.listings().items).toHaveLength(1);
  });
});
