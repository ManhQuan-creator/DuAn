import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideEventPlugins } from '@taiga-ui/event-plugins';
import { routes } from './app.routes';
import { TUI_SANITIZER, TuiRootModule, tuiSvgOptionsProvider } from '@taiga-ui/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth/auth.interceptor';
import { NgDompurifySanitizer } from '@tinkoff/ng-dompurify';
import { provideEchartsCore } from 'ngx-echarts';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    importProvidersFrom(TuiRootModule),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideEventPlugins(),
    provideHttpClient(withInterceptors([authInterceptor])),
    // ECharts: dynamic import → tree-shake, không kéo full echarts vào main bundle
    // (chỉ load khi /dashboard-scl mount).
    provideEchartsCore({ echarts: () => import('echarts') }),
    { provide: TUI_SANITIZER, useClass: NgDompurifySanitizer },
    tuiSvgOptionsProvider({
      path: 'assets/taiga-ui/icons',
    }),
  ]
};
