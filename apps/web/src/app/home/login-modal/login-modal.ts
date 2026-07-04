import { Component, inject, output, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AUTH_FR } from '@aldenfer/shared/content/fr';
import { AuthService } from '../../core/auth';

@Component({
  selector: 'app-login-modal',
  templateUrl: './login-modal.html',
})
export class LoginModalComponent {
  closed = output<void>();

  readonly t = AUTH_FR;

  email = signal('');
  password = signal('');
  mode = signal<'sign-in' | 'sign-up'>('sign-in');
  error = signal<string | null>(null);
  pending = signal(false);

  readonly canSubmit = computed(
    () => this.email().includes('@') && this.password().length >= 8 && !this.pending(),
  );

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  close(): void {
    this.email.set('');
    this.password.set('');
    this.error.set(null);
    this.closed.emit();
  }

  toggleMode(): void {
    this.mode.set(this.mode() === 'sign-in' ? 'sign-up' : 'sign-in');
    this.error.set(null);
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.pending.set(true);
    this.error.set(null);

    const result =
      this.mode() === 'sign-in'
        ? await this.auth.signIn(this.email(), this.password())
        : await this.auth.signUp(this.email(), this.password());

    this.pending.set(false);
    if (result.ok) {
      await this.router.navigate(['/game']);
    } else {
      this.error.set(result.message);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}
