import { Injectable } from '@angular/core';
import type {
  ActionDto,
  AllocateAttributesInput,
  CharacterDto,
  CharacterQuestDto,
  CombatActionInput,
  CombatStateDto,
  CreateActionInput,
  CreateCharacterInput,
  ErrorCode,
  HexDto,
  InventoryEntryDto,
  RegionDto,
} from '@aldenfer/shared';

/** Business error carrying the API-SPEC §2 envelope. */
export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode | 'INTERNAL',
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  async getMe(): Promise<CharacterDto | null> {
    try {
      return await this.request<CharacterDto>('GET', '/api/v1/characters/me');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }

  createCharacter(input: CreateCharacterInput): Promise<CharacterDto> {
    return this.request('POST', '/api/v1/characters', input);
  }

  async getRegions(): Promise<RegionDto[]> {
    const data = await this.request<{ items: RegionDto[] }>('GET', '/api/v1/map/regions');
    return data.items;
  }

  async getRegionHexes(regionId: number): Promise<HexDto[]> {
    const data = await this.request<{ items: HexDto[] }>(
      'GET',
      `/api/v1/map/regions/${regionId}/hexes`,
    );
    return data.items;
  }

  async getActions(): Promise<ActionDto[]> {
    const data = await this.request<{ items: ActionDto[] }>('GET', '/api/v1/actions');
    return data.items;
  }

  postAction(input: CreateActionInput): Promise<ActionDto> {
    return this.request('POST', '/api/v1/actions', input);
  }

  async cancelAction(id: string): Promise<void> {
    await this.request('DELETE', `/api/v1/actions/${id}`);
  }

  // ── Combat (M2)
  async getCurrentCombat(): Promise<CombatStateDto | null> {
    const data = await this.request<{ combat: CombatStateDto | null }>(
      'GET',
      '/api/v1/combat/current',
    );
    return data.combat;
  }

  playCombatTurn(combatId: string, input: CombatActionInput): Promise<CombatStateDto> {
    return this.request('POST', `/api/v1/combat/${combatId}/turn`, input);
  }

  startQuestCombat(questId: string): Promise<CombatStateDto> {
    return this.request('POST', '/api/v1/combat', { source: 'quest', questId });
  }

  // ── Quests (M2)
  async getQuests(): Promise<CharacterQuestDto[]> {
    const data = await this.request<{ items: CharacterQuestDto[] }>('GET', '/api/v1/quests');
    return data.items;
  }

  acceptQuest(questId: string): Promise<CharacterQuestDto> {
    return this.request('POST', `/api/v1/quests/${questId}/accept`);
  }

  advanceQuest(questId: string, stepId: string, choice: string): Promise<CharacterQuestDto> {
    return this.request('POST', `/api/v1/quests/${questId}/advance`, { stepId, choice });
  }

  // ── Inventory (M2)
  async getInventory(): Promise<{ items: InventoryEntryDto[]; capacity: number; used: number }> {
    return this.request('GET', '/api/v1/inventory');
  }

  async equipItem(entryId: string): Promise<void> {
    await this.request('POST', `/api/v1/inventory/${entryId}/equip`);
  }

  async unequipItem(entryId: string): Promise<void> {
    await this.request('POST', `/api/v1/inventory/${entryId}/unequip`);
  }

  async useItem(entryId: string): Promise<void> {
    await this.request('POST', `/api/v1/inventory/${entryId}/use`);
  }

  allocateAttributes(input: AllocateAttributesInput): Promise<CharacterDto> {
    return this.request('POST', '/api/v1/characters/me/attributes', input);
  }

  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204) return undefined as T;

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { code?: string; message?: string; details?: Record<string, unknown> };
      } | null;
      throw new ApiError(
        (payload?.error?.code ?? 'INTERNAL') as ErrorCode,
        payload?.error?.message ?? '',
        response.status,
        payload?.error?.details,
      );
    }
    return (await response.json()) as T;
  }
}
