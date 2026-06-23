import { Component, output, signal } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login-modal',
  templateUrl: './login-modal.html',
})
export class LoginModalComponent {
  closed = output<void>();
  token = signal('');

  constructor(private router: Router) {}

  close(): void {
    this.token.set('');
    this.closed.emit();
  }

  submit(): void {
    if (this.token()) {
      this.router.navigate(['/game']);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}
