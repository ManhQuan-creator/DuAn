import { Routes } from '@angular/router';
import { authGuard } from '../auth/auth.guard';

/**
 * Sub-routes module Báo cáo tổng hợp dự án ĐTXD 110kV.
 * Mount tại `/dtxd-110kv/*` trong `app.routes.ts`.
 */
export const DTXD_110KV_ROUTES: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./dashboard/dtxd-dashboard.component')
        .then(m => m.DtxdDashboardComponent),
  },
];
