  import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// --- THÊM 2 DÒNG NÀY ---
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

// Đăng ký toàn bộ tính năng Community (Sort, Filter, Edit, ...)
ModuleRegistry.registerModules([AllCommunityModule]);

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
