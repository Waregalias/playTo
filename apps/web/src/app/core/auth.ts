import { Injectable } from '@angular/core';
import { AUTH_FR } from '@aldenfer/shared/content/fr';

export type AuthResult = { ok: true } | { ok: false; message: string };

/**
 * Thin client over the better-auth REST endpoints, reached through the
 * dev-server proxy (same-origin → httpOnly session cookie just works).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  async signIn(email: string, password: string): Promise<AuthResult> {
    return this.post('/api/auth/sign-in/email', { email, password });
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    return this.post('/api/auth/sign-up/email', {
      email,
      password,
      name: email.split('@')[0],
    });
  }

  private async post(url: string, body: unknown): Promise<AuthResult> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
    } catch {
      return { ok: false, message: AUTH_FR.errorNetwork };
    }

    if (response.ok) {
      return { ok: true };
    }

    const payload = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;

    switch (payload?.code) {
      case 'INVALID_EMAIL_OR_PASSWORD':
        return { ok: false, message: AUTH_FR.errorInvalidCredentials };
      case 'USER_ALREADY_EXISTS':
      case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
        return { ok: false, message: AUTH_FR.errorEmailTaken };
      case 'PASSWORD_TOO_SHORT':
        return { ok: false, message: AUTH_FR.errorPasswordTooShort };
      default:
        return { ok: false, message: AUTH_FR.errorNetwork };
    }
  }
}
