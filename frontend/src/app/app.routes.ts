import { Routes } from '@angular/router';
import { authGuard, adminGuard, loginRedirectGuard } from './auth/auth.guard';
import { unsavedChangesGuard } from './shared/unsaved-changes.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginRedirectGuard],
    loadComponent: () => import('./auth/login.component').then(m => m.LoginComponent)
  },
  { path: '', redirectTo: 'grid-templates', pathMatch: 'full' },
  {
    path: 'dashboard-scl',
    canActivate: [authGuard],
    loadComponent: () => import('./dashboard-scl/dashboard-scl.component')
      .then(m => m.DashboardSclComponent)
  },
  {
    path: 'kh-evn-nam',
    canActivate: [authGuard],
    loadChildren: () => import('./kh-evn-nam/kh-evn-nam.routes')
      .then(m => m.KH_EVN_NAM_ROUTES)
  },
  {
    path: 'dtxd-110kv',
    canActivate: [authGuard],
    loadChildren: () => import('./dtxd-110kv/dtxd-110kv.routes')
      .then(m => m.DTXD_110KV_ROUTES)
  },
  {
    path: 'bc-dtxd-tha',
    canActivate: [authGuard],
    loadChildren: () => import('./bc-dtxd-tha/bc-dtxd-tha.routes')
      .then(m => m.BC_DTXD_THA_ROUTES)
  },
  {
    path: 'grid-templates',
    canActivate: [authGuard],
    loadComponent: () => import('./grid-template-manager/grid-template-manager.component')
      .then(m => m.GridTemplateManagerComponent)
  },
  {
    path: 'excel-builder',
    canActivate: [authGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./excel-builder/excel-builder.component')
      .then(m => m.ExcelBuilderComponent)
  },
  {
    path: 'excel-render',
    canActivate: [authGuard],
    loadComponent: () => import('./excel-render/excel-render.component')
      .then(m => m.ExcelRenderComponent)
  },
  {
    path: 'report/:type',
    canActivate: [authGuard],
    loadComponent: () => import('./excel-render/excel-render.component')
      .then(m => m.ExcelRenderComponent)
  },
  {
    path: 'catalog-manager',
    canActivate: [authGuard],
    loadComponent: () => import('./catalog-manager/catalog-manager.component')
      .then(m => m.CatalogManagerComponent)
  },
  {
    path: 'organization-management',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./organization-management/organization-management.component')
      .then(m => m.OrganizationManagementComponent)
  },
  {
    path: 'user-management',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./user-management/user-management.component')
      .then(m => m.UserManagementComponent)
  },
  {
    path: 'workflow-manager',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./workflow-manager/workflow-manager.component')
      .then(m => m.WorkflowManagerComponent)
  },
  {
    path: 'sidebar-menu-manager',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./sidebar-menu-manager/sidebar-menu-manager.component')
      .then(m => m.SidebarMenuManagerComponent)
  },
  {
    path: 'position-management',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./position-management/position-management.component')
      .then(m => m.PositionManagementComponent)
  },
  {
    path: 'template-access-manager',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./template-access-manager/template-access-manager.component')
      .then(m => m.TemplateAccessManagerComponent)
  },
  {
    path: 'workflow/tasks',
    canActivate: [authGuard],
    loadComponent: () => import('./workflow/task-list/task-list.component')
      .then(m => m.TaskListComponent)
  },
  {
    path: 'report-type',
    loadComponent: () =>
      import('./report-type/report-type.component').then(m => m.ReportTypeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'scl-category',
    loadComponent: () =>
      import('./scl-category/component/scl-category-list/scl-category.component').then(m => m.SclCategoryComponent),
    canActivate: [authGuard]
  },
  {
    path: 'scl-assessment',
    loadComponent: () =>
      import('./scl-category/component/scl-assessment-list/scl-assessment-list.component')
      .then(m => m.SclAssessmentListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'scl-category/scl-detail',
    loadComponent: () =>
      import('./scl-category/component/scl-category-detail/scl-category-detail.component').then(m => m.SclCategoryDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'suggested-category',
    loadComponent: () =>
      import('./scl-category/component/suggested-category-list/suggested-category-list.component').then(m => m.SuggestedCategoryListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'workflow-manager/editor/:id',
    loadComponent: () =>
      import('./workflow-manager/bpmn-editor/bpmn-editor.component').then(m => m.BpmnEditorComponent),
    canActivate: [authGuard, adminGuard],
  },
  {
    path: 'debug/grid-dump',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./grid-dump-debug/grid-dump-debug.component')
      .then(m => m.GridDumpDebugComponent)
  },
];
