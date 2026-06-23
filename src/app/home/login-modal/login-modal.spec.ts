import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { LoginModalComponent } from './login-modal';

describe('LoginModalComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginModalComponent],
      providers: [provideRouter([{ path: 'game', redirectTo: '' }])],
    }).compileComponents();
  });

  it('rend le champ token et le bouton de soumission', async () => {
    const fixture = TestBed.createComponent(LoginModalComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid="token-input"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="submit-btn"]')).toBeTruthy();
  });

  it('désactive le bouton quand le token est vide', async () => {
    const fixture = TestBed.createComponent(LoginModalComponent);
    await fixture.whenStable();
    const btn = fixture.nativeElement.querySelector('[data-testid="submit-btn"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('active le bouton quand le token est renseigné', async () => {
    const fixture = TestBed.createComponent(LoginModalComponent);
    fixture.componentInstance.token.set('mon-jeton');
    await fixture.whenStable();
    const btn = fixture.nativeElement.querySelector('[data-testid="submit-btn"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('navigue vers /game à la soumission avec un token valide', async () => {
    const fixture = TestBed.createComponent(LoginModalComponent);
    fixture.componentInstance.token.set('mon-jeton');
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.nativeElement.querySelector('[data-testid="submit-btn"]').click();
    expect(navigateSpy).toHaveBeenCalledWith(['/game']);
  });

  it('émet closed et vide le token au clic sur le bouton ×', async () => {
    const fixture = TestBed.createComponent(LoginModalComponent);
    fixture.componentInstance.token.set('quelque-chose');
    await fixture.whenStable();
    const emitted: void[] = [];
    fixture.componentInstance.closed.subscribe(() => emitted.push(undefined));
    fixture.nativeElement.querySelector('[data-testid="close-btn"]').click();
    expect(emitted.length).toBe(1);
    expect(fixture.componentInstance.token()).toBe('');
  });
});
