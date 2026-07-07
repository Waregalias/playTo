import { TestBed } from '@angular/core/testing';
import type { ProjectDetailDto } from '@aldenfer/shared';
import { ProjectPanelComponent } from './project-panel';
import { ApiClient } from '../../core/api-client';
import { GameStore } from '../../core/game-store';

const PROJECT: ProjectDetailDto = {
  id: 'r1.belfry',
  name: 'Beffroi',
  goals: { shadewood: 5000, sootOre: 3000, ashGlass: 500 },
  progress: { shadewood: 3214, sootOre: 2880, ashGlass: 417 },
  completedAt: null,
  myContribution: { shadewood: 100 },
  contributorCount: 12,
};

describe('ProjectPanelComponent', () => {
  const apiMock = { contribute: vi.fn() };
  let storeMock: {
    currentProject: ReturnType<typeof vi.fn>;
    refreshProject: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    storeMock = {
      currentProject: vi.fn(() => PROJECT),
      refreshProject: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(undefined),
    };
    await TestBed.configureTestingModule({
      imports: [ProjectPanelComponent],
      providers: [
        { provide: ApiClient, useValue: apiMock },
        { provide: GameStore, useValue: storeMock },
      ],
    }).compileComponents();
  });

  it('loads the project on init', async () => {
    const fixture = TestBed.createComponent(ProjectPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(storeMock.refreshProject).toHaveBeenCalled();
  });

  it('computes goal row percentages from progress/goal', async () => {
    const fixture = TestBed.createComponent(ProjectPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const rows = fixture.componentInstance.goalRows();
    const wood = rows.find((r) => r.key === 'shadewood')!;
    expect(wood.pct).toBe(Math.round((3214 / 5000) * 100));
    expect(wood.name).toBe('Bois d’ombre');
  });

  it('contributes with the selected resource and qty, then refreshes', async () => {
    const fixture = TestBed.createComponent(ProjectPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.resource.set('sootOre');
    component.qty.set(25);
    await component.contribute();
    expect(apiMock.contribute).toHaveBeenCalledWith('r1.belfry', { resource: 'sootOre', qty: 25 });
    expect(storeMock.refreshProject).toHaveBeenCalledTimes(2); // init + after contribute
    expect(storeMock.refresh).toHaveBeenCalled();
  });
});
