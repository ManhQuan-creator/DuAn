import { Routes } from '@angular/router';
import { authGuard } from '../auth/auth.guard';

/**
 * Sub-routes module Báo cáo ĐTXD THA & Khác.
 * Mount tại `/bc-dtxd-tha` trong `app.routes.ts`. Path-based tab:
 * `/bc-dtxd-tha/pl179..pl183`. Empty path redirect về `pl179`.
 */
export const BC_DTXD_THA_ROUTES: Routes = [
  { path: '', redirectTo: 'pl179', pathMatch: 'full' },
  {
    path: ':tab',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./bc-dtxd-tha-page.component')
        .then(m => m.BcDtxdThaPageComponent),
  },
];
