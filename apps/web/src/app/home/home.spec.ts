import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home';

describe('HomeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([{ path: 'game', redirectTo: '' }])],
    }).compileComponents();
  });

  it('affiche le titre du jeu', async () => {
    const fixture = TestBed.createComponent(HomeComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Les Braises d’Aldenfer');
  });

  it('présente les quatre voies', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    expect(fixture.componentInstance.classes.length).toBe(4);
  });

  it('affiche le bouton Sign up', async () => {
    const fixture = TestBed.createComponent(HomeComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid="signup-btn"]')).toBeTruthy();
  });

  it('expose 3 features', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    expect(fixture.componentInstance.features.length).toBe(3);
  });

  it('la modale est fermée par défaut', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    expect(fixture.componentInstance.isModalOpen()).toBe(false);
  });

  it('ouvre la modale au clic sur Sign up', async () => {
    const fixture = TestBed.createComponent(HomeComponent);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('[data-testid="signup-btn"]').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.isModalOpen()).toBe(true);
  });

  it('ferme la modale via closeModal()', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.componentInstance.isModalOpen.set(true);
    fixture.componentInstance.closeModal();
    fixture.detectChanges();
    expect(fixture.componentInstance.isModalOpen()).toBe(false);
  });
});
