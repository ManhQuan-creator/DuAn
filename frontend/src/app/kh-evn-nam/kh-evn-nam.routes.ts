import { Routes } from '@angular/router';
import { authGuard } from '../auth/auth.guard';

/**
 * Sub-routes module KH năm EVN giao.
 * Mount tại `/kh-evn-nam/*` trong `app.routes.ts`.
 */
export const KH_EVN_NAM_ROUTES: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./dashboard/kh-evn-dashboard.component')
        .then(m => m.KhEvnDashboardComponent),
  },
  {
    path: 'form',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./form/kh-evn-form.component')
        .then(m => m.KhEvnFormComponent),
  },
];
