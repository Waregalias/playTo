import { TestBed } from '@angular/core/testing';
import type { CharacterDto } from '@aldenfer/shared';
import { SkillTreeComponent } from './skill-tree';
import { ApiClient } from '../../core/api-client';
import { GameStore } from '../../core/game-store';

function makeCharacter(overrides: Partial<CharacterDto> = {}): CharacterDto {
  return {
    id: 'c1',
    name: 'Serelle',
    class: 'blade',
    level: 3,
    xp: 0,
    xpNext: 100,
    attributes: { str: 8, dex: 5, wil: 4, vit: 9, fer: 4 },
    attributePoints: 0,
    skillPoints: 2,
    hp: 102,
    hpMax: 102,
    stamina: 72,
    staminaMax: 100,
    deathPenaltyUntil: null,
    hexId: 'h1',
    regionId: 0,
    currencies: { ashCrowns: 0, emberFragments: 3, gloryMarks: 0 },
    skills: [{ skillId: 'blade.steel.1', equippedSlot: 1 }],
    ...overrides,
  };
}

describe('SkillTreeComponent', () => {
  const apiMock = { learnSkill: vi.fn(), equipSkills: vi.fn() };
  let storeMock: { character: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();
    storeMock = { character: vi.fn(() => makeCharacter()) };
    await TestBed.configureTestingModule({
      imports: [SkillTreeComponent],
      providers: [
        { provide: ApiClient, useValue: apiMock },
        { provide: GameStore, useValue: storeMock },
      ],
    }).compileComponents();
  });

  it('derives the 3 branches of the character class', () => {
    const fixture = TestBed.createComponent(SkillTreeComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.branches()).toEqual(['bulwark', 'steel', 'veteran']);
  });

  it('marks a skill present in character.skills as learned', () => {
    const fixture = TestBed.createComponent(SkillTreeComponent);
    fixture.detectChanges();
    fixture.componentInstance.activeBranch.set('steel');
    const rows = fixture.componentInstance.rows();
    const steel1 = rows.find((r) => r.skill.id === 'blade.steel.1')!;
    expect(steel1.learned).toBe(true);
    expect(steel1.equipped).toBe(1);
    const steel2 = rows.find((r) => r.skill.id === 'blade.steel.2')!;
    expect(steel2.learned).toBe(false);
  });

  it('learns a skill and updates the store character', async () => {
    const updated = makeCharacter({ skillPoints: 1, skills: [{ skillId: 'blade.steel.1', equippedSlot: 1 }, { skillId: 'blade.bulwark.1', equippedSlot: null }] });
    apiMock.learnSkill.mockResolvedValue(updated);
    const fixture = TestBed.createComponent(SkillTreeComponent);
    fixture.detectChanges();
    await fixture.componentInstance.learn('blade.bulwark.1');
    expect(apiMock.learnSkill).toHaveBeenCalledWith('blade.bulwark.1');
  });

  it('equips into the first free slot', async () => {
    const character = makeCharacter({ skills: [{ skillId: 'blade.steel.1', equippedSlot: null }, { skillId: 'blade.steel.2', equippedSlot: null }] });
    storeMock.character = vi.fn(() => character);
    apiMock.equipSkills.mockResolvedValue(character);
    const fixture = TestBed.createComponent(SkillTreeComponent);
    fixture.detectChanges();
    await fixture.componentInstance.equip('blade.steel.2');
    expect(apiMock.equipSkills).toHaveBeenCalledWith({ slot1: 'blade.steel.2', slot2: null });
  });

  it('equips into slot2 when slot1 is taken', async () => {
    const character = makeCharacter(); // slot1 = blade.steel.1
    apiMock.equipSkills.mockResolvedValue(character);
    const fixture = TestBed.createComponent(SkillTreeComponent);
    fixture.detectChanges();
    await fixture.componentInstance.equip('blade.steel.2');
    expect(apiMock.equipSkills).toHaveBeenCalledWith({ slot1: 'blade.steel.1', slot2: 'blade.steel.2' });
  });

  it('unequips only the matching slot', async () => {
    apiMock.equipSkills.mockResolvedValue(makeCharacter());
    const fixture = TestBed.createComponent(SkillTreeComponent);
    fixture.detectChanges();
    await fixture.componentInstance.unequip('blade.steel.1');
    expect(apiMock.equipSkills).toHaveBeenCalledWith({ slot1: null, slot2: null });
  });
});
