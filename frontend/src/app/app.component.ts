import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { TuiAlertModule, TuiDialogModule, TuiRootModule } from '@taiga-ui/core';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { AppLoadingComponent } from './shared/components/app-loading/app-loading.component';
import { AuthService } from './auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, TuiRootModule, RouterOutlet, TuiDialogModule, TuiAlertModule,
    HeaderComponent, SidebarComponent, AppLoadingComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'my-app';
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  get showAuthenticatedLayout(): boolean {
    return this.auth.isAuthenticated && !this.router.url.startsWith('/login');
  }
}
