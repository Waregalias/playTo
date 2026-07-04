import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AUTH_FR } from '@aldenfer/shared/content/fr';
import { LoginModalComponent } from './login-modal';
import { AuthService } from '../../core/auth';

describe('LoginModalComponent', () => {
  const authMock = {
    signIn: vi.fn(),
    signUp: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    await TestBed.configureTestingModule({
      imports: [LoginModalComponent],
      providers: [
        provideRouter([{ path: 'game', redirectTo: '' }]),
        { provide: AuthService, useValue: authMock },
      ],
    }).compileComponents();
  });

  it('rend les champs e-mail / mot de passe et le bouton de soumission', async () => {
    const fixture = TestBed.createComponent(LoginModalComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid="email-input"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="password-input"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="submit-btn"]')).toBeTruthy();
  });

  it('désactive le bouton tant que le formulaire est invalide', async () => {
    const fixture = TestBed.createComponent(LoginModalComponent);
    await fixture.whenStable();
    const btn = fixture.nativeElement.querySelector(
      '[data-testid="submit-btn"]',
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);

    fixture.componentInstance.email.set('ravive@aldenfer.test');
    fixture.componentInstance.password.set('court');
    await fixture.whenStable();
    expect(btn.disabled).toBe(true);

    fixture.componentInstance.password.set('motdepasse-solide');
    await fixture.whenStable();
    expect(btn.disabled).toBe(false);
  });

  it('navigue vers /game quand la connexion réussit', async () => {
    authMock.signIn.mockResolvedValue({ ok: true });
    const fixture = TestBed.createComponent(LoginModalComponent);
    fixture.componentInstance.email.set('ravive@aldenfer.test');
    fixture.componentInstance.password.set('motdepasse-solide');
    await fixture.whenStable();

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await fixture.componentInstance.submit();

    expect(authMock.signIn).toHaveBeenCalledWith('ravive@aldenfer.test', 'motdepasse-solide');
    expect(navigateSpy).toHaveBeenCalledWith(['/game']);
  });

  it('affiche le message d’erreur quand la connexion échoue', async () => {
    authMock.signIn.mockResolvedValue({
      ok: false,
      message: AUTH_FR.errorInvalidCredentials,
    });
    const fixture = TestBed.createComponent(LoginModalComponent);
    fixture.componentInstance.email.set('ravive@aldenfer.test');
    fixture.componentInstance.password.set('motdepasse-solide');
    await fixture.whenStable();

    await fixture.componentInstance.submit();
    await fixture.whenStable();

    const error = fixture.nativeElement.querySelector('[data-testid="auth-error"]');
    expect(error?.textContent).toContain(AUTH_FR.errorInvalidCredentials);
  });

  it('bascule vers l’inscription et appelle signUp', async () => {
    authMock.signUp.mockResolvedValue({ ok: true });
    const fixture = TestBed.createComponent(LoginModalComponent);
    await fixture.whenStable();

    fixture.nativeElement.querySelector('[data-testid="toggle-mode-btn"]').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.mode()).toBe('sign-up');

    fixture.componentInstance.email.set('nouveau@aldenfer.test');
    fixture.componentInstance.password.set('motdepasse-solide');
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await fixture.componentInstance.submit();
    expect(authMock.signUp).toHaveBeenCalledWith('nouveau@aldenfer.test', 'motdepasse-solide');
  });

  it('ne soumet pas quand le formulaire est invalide', async () => {
    const fixture = TestBed.createComponent(LoginModalComponent);
    await fixture.whenStable();

    await fixture.componentInstance.submit();

    expect(authMock.signIn).not.toHaveBeenCalled();
    expect(authMock.signUp).not.toHaveBeenCalled();
  });

  it('émet closed et vide les champs au clic sur ×', async () => {
    const fixture = TestBed.createComponent(LoginModalComponent);
    fixture.componentInstance.email.set('x@y.z');
    fixture.componentInstance.password.set('quelque-chose');
    await fixture.whenStable();

    const emitted: void[] = [];
    fixture.componentInstance.closed.subscribe(() => emitted.push(undefined));
    fixture.nativeElement.querySelector('[data-testid="close-btn"]').click();

    expect(emitted.length).toBe(1);
    expect(fixture.componentInstance.email()).toBe('');
    expect(fixture.componentInstance.password()).toBe('');
  });
});
