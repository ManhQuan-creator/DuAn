import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from './auth.service';
import { AppDialogService } from '../shared/dialog.service';
import { DEFAULT_AUTHENTICATED_ROUTE } from './auth.guard';

const REMEMBER_USERNAME_KEY = 'excelpro_login_username';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(AppDialogService);

  username = '';
  password = '';
  rememberMe = false;
  loading = false;

  constructor() {
    const saved = localStorage.getItem(REMEMBER_USERNAME_KEY);
    if (saved) {
      this.username = saved;
      this.rememberMe = true;
    }
  }

  onForgotPassword(): void {
    this.dialog.info(
      'Liên hệ quản trị hệ thống hoặc bộ phận IT để được cấp lại mật khẩu.',
      'Quên mật khẩu'
    );
  }

  onLogin() {
    if (!this.username || !this.password) {
      this.dialog.warning('Vui lòng nhập tên đăng nhập và mật khẩu');
      return;
    }

    this.loading = true;
    this.authService.login(this.username, this.password).subscribe({
      next: () => {
        this.loading = false;
        if (this.rememberMe) {
          localStorage.setItem(REMEMBER_USERNAME_KEY, this.username.trim());
        } else {
          localStorage.removeItem(REMEMBER_USERNAME_KEY);
        }
        const q = this.route.snapshot.queryParams;
        const returnUrl =
          q['returnUrl'] || q['redirectURL'] || q['redirectUrl'] || DEFAULT_AUTHENTICATED_ROUTE;
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.loading = false;
        const msg = err.error?.message || 'Sai tên đăng nhập hoặc mật khẩu';
        this.dialog.error(msg, 'Đăng nhập thất bại');
      }
    });
  }
}
