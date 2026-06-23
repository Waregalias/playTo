import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GameComponent } from './game';

describe('GameComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('affiche le titre de bienvenue', async () => {
    const fixture = TestBed.createComponent(GameComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Bienvenue dans le royaume');
  });

  it('contient un lien vers la home', async () => {
    const fixture = TestBed.createComponent(GameComponent);
    await fixture.whenStable();
    const link = fixture.nativeElement.querySelector('a[href="/"]');
    expect(link).toBeTruthy();
  });
});
