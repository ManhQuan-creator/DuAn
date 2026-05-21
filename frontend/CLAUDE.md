# Frontend — Angular 19.2

> Auto-loaded khi Claude Code thao tác trong `frontend/`. Root [CLAUDE.md](../CLAUDE.md) cho monorepo overview.

## Stack

- **Angular**: 19.2 (standalone components only — KHÔNG dùng NgModule)
- **Port**: 4200 (proxy `/excelpro-service` → `localhost:8081` qua [proxy.conf.js](proxy.conf.js))
- **UI**: Taiga UI v3.117 + AG Grid Community v35.0.1 + Tailwind CSS v3.4 (`preflight: false` để không đè reset của Taiga) + ECharts v6 (`ngx-echarts` v19) cho Dashboard + bpmn-js v18 + camunda-bpmn-moddle v7 cho BPMN visual editor + ExcelJS v4.4 cho export/import
- **Node**: `^18.19.1 || ^20.11.1 || >=22.0.0`
- **Language**: TypeScript strict mode + Angular strict templates
- **Test**: Karma + Jasmine

## Quick commands

```bash
npm start                       # Dev server tại http://localhost:4200
npm run build                   # Production build → dist/my-app/
npm test                        # Karma + Jasmine watch mode
npx ng test --no-watch --browsers=ChromeHeadless --include='src/app/excel-render/**/*.spec.ts'
npx tsc --noEmit -p tsconfig.app.json    # Type check only
```

## Routes (`src/app/app.routes.ts`)

| Path | Component | Guards | Ghi chú |
|---|---|---|---|
| `/login` | `LoginComponent` | — | EVNNPC branded |
| `/` | redirect → `/grid-templates` | — | |
| `/dashboard-scl` | `DashboardSclComponent` | authGuard | Dashboard ECharts (8 charts) |
| `/kh-evn-nam/dashboard` | `KhEvnDashboardComponent` (lazy) | authGuard | KH năm EVN giao — dashboard 4 tầng ECharts |
| `/kh-evn-nam/form` | `KhEvnFormComponent` (lazy) | authGuard | KH năm EVN giao — form 2 tab section-based (deptCode=BAN_KH) |
| `/dtxd-110kv/dashboard` | `DtxdDashboardComponent` (lazy) | authGuard | Báo cáo tổng hợp dự án ĐTXD 110kV — dashboard read-only |
| `/bc-dtxd-tha/:tab` | `BcDtxdThaPageComponent` (lazy) | authGuard | Báo cáo ĐTXD THA & Khác — page cha 5 tab (PL179/180/181/182/183), path `:tab` = pl179..pl183 deep-link, `/bc-dtxd-tha` redirect → `/bc-dtxd-tha/pl179` |
| `/grid-templates` | `GridTemplateManagerComponent` | authGuard | |
| `/excel-builder` | `ExcelBuilderComponent` | authGuard + **canDeactivate: unsavedChangesGuard** | `?templateId=` |
| `/excel-render` | `ExcelRenderComponent` | authGuard | `?templateId=` + `?entryId=` |
| `/report/:type` | `ExcelRenderComponent` | authGuard | Report mode (multi-template search) |
| `/catalog-manager` | `CatalogManagerComponent` | authGuard | |
| `/organization-management` | `OrganizationManagementComponent` | authGuard + adminGuard | |
| `/user-management` | `UserManagementComponent` | authGuard + adminGuard | |
| `/position-management` | `PositionManagementComponent` | authGuard + adminGuard | Chức vụ |
| `/sidebar-menu-manager` | `SidebarMenuManagerComponent` | authGuard + adminGuard | Cây menu sidebar |
| `/template-access-manager` | `TemplateAccessManagerComponent` | authGuard + adminGuard | Phân quyền template |
| `/workflow-manager` | `WorkflowManagerComponent` | authGuard + adminGuard | |
| `/workflow-manager/editor/:id` | `BpmnEditorComponent` | authGuard + adminGuard | Visual BPMN editor |
| `/workflow/tasks` | `TaskListComponent` | authGuard | Task chờ duyệt của user |
| `/report-type` | `ReportTypeComponent` | authGuard | |
| `/scl-category` | `SclCategoryListComponent` | authGuard | |
| `/scl-category-detail`, `/scl-category/scl-detail` | `SclCategoryDetailComponent` | authGuard | |
| `/scl-assessment` | `SclAssessmentListComponent` | authGuard | |
| `/suggested-category` | `SuggestedCategoryListComponent` | authGuard | |
| `/debug/grid-dump` | `GridDumpDebugComponent` | authGuard + adminGuard | Debug grid template |

## Modules (top-level `src/app/`)

- **auth/** — JWT: `AuthService` (login/logout/token/role/orgCode/isHeadquarters), `authInterceptor` (Bearer + 401 auto-logout), `authGuard`/`adminGuard`, `LoginComponent`
- **header/** — Gradient bar (EVNNPC), notification bell + avatar + fullName + orgCode badge + logout
- **sidebar/** — Dark nav (220px), `tui-svg` icons, sections "MENU" + "HỆ THỐNG" (ADMIN). Loads sidebar menu tree từ `SidebarMenuService`
- **notification-list/** — SSE real-time qua `EventSource` với JWT token query param (`?token=`), auto-reconnect, `lastEventId` resume
- **excel-builder/** — Dynamic columns/rows, formula evaluation (ROW_COL/COL/ROW/EXCEL coords), per-cell formula/dropdown/datepicker/validation, aggregate (SUM/SUMIF/AVERAGE...), undo/redo, import/export Excel, permissions, column groups, template buttons. Component ~2894 dòng. Sub-folders: `components/builder-formula-help/`, `dialogs/` (incl. `cell-config-dialog/`), `models/`, `renderers/` (incl. `formula-cell-renderer.component.ts` Angular cell renderer), `service/` (incl. `formula-coordinator.service.ts`), `utils/`
- **excel-render/** — Data entry UI cho template. Dual view (list/entry) + report mode (multi-template). **Edit-table mode** (xem section riêng). Custom rows (RX prefix) sống chung với template rows trong `rowData` array (flag `_isCustomRow=true`); KHÔNG còn anchor (`afterRowCode` đã bỏ từ V10). Component ~3300 dòng. Sub-folders: `components/render-context-menu/`, `service/` (incl. `entry-rows.service.ts`), `create-entry-dialog/`, `entry-attachments-panel/`, `utils/` (incl. `find-incoming-formula-refs.util.ts`)
- **catalog-manager/** — Master-detail catalog types + items (AG Grid). CRUD + soft delete
- **grid-template-manager/** — AG Grid card layout với search/filter, CRUD, publish workflow
- **organization-management/** / **user-management/** / **position-management/** — ADMIN-only CRUD
- **sidebar-menu-manager/** — Cây menu sidebar CRUD (ADMIN only)
- **template-access-manager/** — Phân quyền template (ADMIN only)
- **workflow-manager/** — Workflow definition CRUD (ADMIN). BPMN editor + Camunda deploy. Sub-folders: `bpmn-editor/`, `step-form-dialog/`, `step-candidate-dialog/`
- **workflow/** — User-side: `task-list/` (Inbox), `approval-dialog/`, `history-timeline/`
- **dashboard-scl/** — ECharts dashboard (8 chart components: kpi-cards, delay-alerts, kl-monthly-chart, hach-toan-top-chart, status-donut-chart, unit-structure-chart, heatmap-kl-chart, efficiency-bubble-chart)
- **kh-evn-nam/** — KH năm EVN giao (HQ `orgCode='TCT'`, ownerDeptCode=BAN_KH). Template-engine driven (template `KH_SXKD_NAM` + `KH_MUC_TIEU_NAM` seed V11) — là **nguồn LOOKUP cấp HQ** cho mọi báo cáo SCL khác (vd `LOOKUP('KH_SXKD_NAM','DIEN_TP','giaTri',0)`). Sub-folders: `dashboard/` (4 tầng ECharts: KPI + 7 chart + accordion mục tiêu), `form/` (2 tab section-based, **auto-create entry** khi đổi năm), `service/`, `model/`, `utils/`. Chi tiết: [docs/kh-evn-nam.md](../docs/kh-evn-nam.md)
- **dtxd-110kv/** — Báo cáo tổng hợp dự án ĐTXD 110kV (HQ `orgCode='TCT'`, ownerDeptCode=BAN_KH). Template `DTXD_110KV_TONG_HOP` (seed V12) — 16 cột flat, không section, không formula. Dashboard READ-ONLY: 8 KPI + 4 ECharts (donut tình trạng/loại hình + bar đơn vị QLDA), filter năm + đơn vị QLDA. **KHÔNG auto-create entry** — entry chưa có → KPI=0, charts rỗng, không DB write. NSD nhập dữ liệu qua menu khác cùng group (template `REPORT_FC_GROUP=DTXD_110KV`). Sub-folders: `dashboard/`, `service/`, `model/`, `utils/`. Chi tiết: [docs/dtxd-110kv.md](../docs/dtxd-110kv.md)
- **bc-dtxd-tha/** — Báo cáo ĐTXD THA & Khác cấp TCT (HQ `orgCode='TCT'`, ownerDeptCode=BAN_KH). 5 template seed V13: `M20`/`PL180`/`PL181`/`PL182`/`PL183` — **5 dashboard đầy đủ** với tab tên ý nghĩa "Nhóm chương trình" / "Giai đoạn giao KH" / "Kế hoạch vốn" / "Giám sát đầu tư" / "Hiệu quả đầu tư". Page cha `BcDtxdThaPageComponent` 5 tab + filter Năm chung; path `/bc-dtxd-tha/:tab` (pl179..pl183) deep-link, empty path redirect → pl179. periodType: 4 cái QUARTER + PL182 HALF_YEAR. **Auto-pick latest quý/half-year có data** trong năm — không có filter Quý ở UI. Nếu entry rỗng → render layout + banner cam `<app-no-data-hint>` yêu cầu nhập số liệu kèm nút "Mở /excel-render". Filter Đơn vị (giống dtxd-110kv pattern) ở PL179/180/183 — PL181 (nguồn vốn) và PL182 (Biểu 3.1 cấp TCT) không có. KHÔNG auto-create entry, NSD nhập qua /excel-render. Sub-folders: `bc-dtxd-tha-page.*` (cha), `shared/` (`bc-dtxd-tha-base.service` + `no-data-hint.component` + `chart-palette` + `period-options` + `_dashboard-styles.scss` partial dùng `@use` cho 5 component SCSS), `pl179-nhom-chuong-trinh/`, `pl180-giai-doan/`, `pl181-kh-von/` (có thêm chart line "Tiến độ luỹ kế 4 quý" qua `base.loadEntryByMonth`), `pl182-giam-sat/`, `pl183-hieu-qua/` (custom rows — mỗi dự án 1 row).
- **scl-category/** — SCL category + assessment + suggested category. Sub-folders: `component/`, `dialogs/`, `service/`, `model/`
- **report-type/**, **grid-dump-debug/** — Report type config; debug tool ADMIN
- **shared/** — Shared services + components (xem section)

## Excel-render — Edit table mode

Toggle "Chỉnh sửa bảng" (chỉ DRAFT/RETURNED status):
- **Add/Delete/Drag**: thao tác BẤT KỲ row (template-cloned + custom), KHÔNG phân biệt. Restriction duy nhất: `_isTypeHeader` rows cố định section boundary (không drag, không xóa, không thêm dưới).
- **Edit formula per-cell**: mỗi cell hiện 2 icon hover (copy address + gear). Click gear → mở `CellConfigDialogComponent` (reuse từ excel-builder). Save → mutate `row._cellConfig[field]` + rebuild formula graph + push undo.
- **Snapshot architecture**: entry độc lập với template ngay lúc tạo (BE clone snapshot). Original `_cellConfig` snapshot client-side ở `loadEntryData` (qua `EntryRowsService.captureOriginal`) cho mục đích delta badge + reset row.
- **3 UX helpers**:
  - **Delta badge**: cell có formula thay đổi vs original → corner triangle cam (CSS `.cell-formula-delta` áp qua `cellClassRules`).
  - **Warn xóa row reference**: trước xóa, scan formulas via `findIncomingFormulaRefs` → confirm dialog liệt kê cells reference (`row_code.field → formula`). KHÔNG cản, chỉ warn.
  - **Reset cell config row**: context menu "Khôi phục công thức theo mẫu gốc" — restore từ original snapshot, push undo.
- KHÔNG audit log. KHÔNG gate behind permission mới — `canEditRows` (DRAFT/RETURNED) là gate duy nhất.

## Shared services (`src/app/shared/`)

| Service | Mục đích |
|---|---|
| `dialog.service.ts` (`AppDialogService`) | Toast (success/error/warning/info via `TuiAlertService`) + custom confirm/prompt (`PolymorpheusComponent` via `TuiDialogService`). **BẮT BUỘC dùng thay cho native `alert()`/`confirm()`/`prompt()`** |
| `loading.service.ts` (`LoadingService`) | Show/hide global spinner overlay |
| `organization.service.ts` | Cached org list. `getAll()`, `getSubsidiaries()`, `getAllIncludeInactive()`, `create()`, `update()`, `deleteOrg()`, auto-resolve HQ flag |
| `dept-type.service.ts`, `sidebar-menu.service.ts`, `template-access.service.ts`, `template-button.service.ts`, `service/comments.service.ts` | API services (cached khi cần) |
| `unsaved-changes.guard.ts` | `canDeactivate` guard cho excel-builder |
| `grid-core/` | **Helpers + services share Builder/Render** (barrel `index.ts`): `validateCellValue` (Excel-like, empty cell skip min/max), `formatIsoDate`/`formatCellValue`/`cellPresetStyle`, `serializeRangeAsTsv`/`getFormattedCellText` (TSV copy), `createPasteHighlight` (skip cells), `RangeSelectionService` (Excel-style drag select), `PasteHandlerService` (parse + apply TSV), `clearActiveTooltip`, `cleanStaleColumnGroupFields`/`collectAllLeafFields`/`columnGroupContainsField` (group helpers). **Thêm vào đây mọi util/service share Builder + Render.** |

## Shared components (`src/app/shared/components/`)

- `multi-select/` — **BẮT BUỘC dùng cho mọi dropdown trong feature code**: `<app-single-select>`, `<app-multi-select>`, `<app-grouped-multi-select>` (data flat hoặc 2-level group, option shape `SelectOption<V>`); `<app-tree-select>` cho data tree N-cấp (option shape `TreeNode<V>` với `children?: TreeNode<V>[]` — branch click toggle expand, leaf click select; auto-expand all branch khi nhận `nodes` mới; search auto-expand visible branches; folder/briefcase icons). Import từ barrel: `import { SingleSelectComponent, TreeSelectComponent, SelectOption, TreeNode } from 'src/app/shared/components/multi-select';`. Tích hợp `[(ngModel)]`/`[formControl]` qua ControlValueAccessor. **Exception**: `<select>` native chỉ dùng được trong `PromptDialogComponent`. **TUYỆT ĐỐI KHÔNG bind `[options]`/`[items]`/`[nodes]` array Inputs bằng method call từ template** (vd `[options]="getOptions()"`) — sẽ tạo array reference mới mỗi CD cycle, kết hợp `tui-combo-box` → CD vô hạn → **treo browser**. Pattern đúng: lưu vào field, gọi `recomputeXxxOptions()` tại các điểm mutation.
- `date-picker/` — **BẮT BUỘC dùng cho mọi date / datetime input**: `<app-date-picker>` (wrap `tui-input-date` default; hoặc `tui-input-date-time` khi `[withTime]="true"`). CVA value: `string | null` ISO `YYYY-MM-DD` (date-only) hoặc `YYYY-MM-DDTHH:mm:ss` (datetime). Import: `import { DatePickerComponent } from 'src/app/shared/components/date-picker';`. Inputs: `placeholder`, `size` (m/s/l), `readOnly`, `disabled`, `withTime`. Locale tiếng Việt + format `dd/MM/yyyy` (date) hoặc `dd/MM/yyyy HH:mm` (datetime), set qua `viewProviders` (scoped). **TUYỆT ĐỐI KHÔNG dùng `<input type="date">` native cũng KHÔNG `<tui-input-date>` trực tiếp**.
- `format-toolbar/` — Excel cell format (bold/italic/color/alignment) + `color-picker-popup`
- `ag-grid-wrapper/` — AG Grid wrapper. Hỗ trợ `[enableRangeSelection]="true"` (default `false`) → bật Excel-style cell selection (drag chọn range, ESC clear) + Ctrl+C copy ra TSV. Builder + Render KHÔNG dùng flag — họ wire `RangeSelectionService` riêng để tích hợp `PasteHandlerService` + undo/permission.
- `app-loading/`, `accept-dialog/`, `comment-section/`, `custom-pagination/`, `grid-custom-cell/`, `grid-header/`, `import-file-dialog/`, `page-header/`
- `validation-error-panel/` — Collapsible panel hiển thị danh sách validation error (rowCode + columnName + message), click row → jump to cell. Replace tooltip validation (đã bỏ vì không stable). Dùng ở Builder + Render.

## Conventions

- **`inject()`** over constructor injection
- **Standalone only**, KHÔNG NgModule
- **Control flow**: dùng `@if / @for / @switch` thay cho `*ngIf / *ngFor / *ngSwitch`. Imports cũng KHÔNG cần `CommonModule` trừ khi dùng pipe/directive thuần (`async`, `json`, `[ngClass]`, `[ngStyle]`).
- **RxJS cleanup**: `takeUntil(destroy$)` hoặc explicit `Subscription.unsubscribe()`
- Column `field` names: alphanumeric only
- **Row identity & order**: `row_code` là identity duy nhất per entry. Custom rows mark bằng flag `_isCustomRow: true`. KHÔNG có cấu trúc anchor (`afterRowCode` đã bỏ từ V10) — order = visual index trong `rowData` array, persist nguyên trạng qua JSON.parse/stringify. Bất kỳ row nào trong rowData (template-cloned hoặc custom) đều có thể được drag/delete trong "Chỉnh sửa bảng" trừ row có flag `_isTypeHeader` (section boundary cố định).
- **Dialog UX**: dùng `AppDialogService`, không dùng native API
- **Dropdown UX**: dùng shared `multi-select`, không dùng `<select>` native / `<tui-select>` / `<tui-combo-box>` trực tiếp
- **Date input UX**: dùng shared `<app-date-picker>` (wrap Taiga)
- **Search form ↔ URL queryParams**: list page có form tìm kiếm (`/grid-templates`, `/report/:type`, ...) PHẢI sync state filter/page/pageSize lên URL queryParams. Pattern: `route.queryParams` là single source of truth → subscribe set state + `loadData()`; user input → `router.navigate` cập nhật URL → subscribe re-fire. Default value (rỗng / 'ALL' / page 0 / pageSize mặc định) truyền `null` để strip khỏi URL. Lợi ích: history back giữ kết quả cũ, deep link share được, refresh trang giữ filter. Reference: [`grid-template-manager.component.ts`](src/app/grid-template-manager/grid-template-manager.component.ts).
- **Clear filter button**: form tìm kiếm có ≥3 trường nên có nút "Xóa bộ lọc" reset về mặc định + tìm lại. Reference: `clearReportFilters()` trong [`excel-render.component.ts`](src/app/excel-render/excel-render.component.ts).
- **CD performance**: KHÔNG bind method call cho Inputs nhận collection (xem rule `[options]` ở multi-select)
- **TUYỆT ĐỐI KHÔNG dùng `setTimeout(fn, 0)`** để chờ logic khác — code smell. Pattern đúng:
  - **Pending flag**: `private pendingXxx = false;` set bởi caller, flush trong event lifecycle (`onGridReady`, `ngAfterViewInit`). Precedent: `pendingFormulaRebuild`, `pendingValidationRecalc`, `pendingSnapshotSave`.
  - **AG Grid event**: `firstDataRendered`, `modelUpdated`, `cellEditingStopped` — hook đúng event thay vì timer.
  - **RxJS `concat`/`switchMap`**: chain async theo thứ tự xác định.
  - **Promise.resolve().then()** chỉ dùng khi cần micro-task batching đúng spec.
  - Exception: `setTimeout(fn, N>0)` cho debounce/throttle/animation duration là hợp lệ.
- **AG Grid `cellStyle` không tự reset CSS keys** — function trả object chỉ APPLY các keys có; keys cũ KHÔNG bị clear. Hệ quả: state-A → state-B PHẢI explicit set lại keys của state-A để clear. Tất cả style preset trong [shared/utils/cell-styles.const.ts](src/app/shared/utils/cell-styles.const.ts) phải khai báo cùng tập keys (outline, outlineOffset, color, backgroundColor, fontWeight, fontStyle).
- **Cell visual indicators (focus / range / validation invalid) PHẢI dùng `box-shadow inset`, KHÔNG `border` cũng KHÔNG `outline`** — AG Grid v35:
  - `border` inline đè class theme → mất `border-right` (đường dọc cột).
  - `outline` với offset âm gặp `.ag-row { border-bottom: 1px gray }` → 2 visual chồng → outline bottom asymmetric.
  - `box-shadow: inset 0 0 0 2px <color>` đảm bảo 2px ĐỀU 4 cạnh.
  - Pattern chuẩn: focus single = `inset 0 0 0 2px rgba(59,130,246,0.6)`; range = `inset 0 0 0 2px rgba(59,130,246,1)`; validation invalid = `inset 0 0 0 2px #dc2626` (xem [cell-styles.const.ts](src/app/shared/utils/cell-styles.const.ts) `SHADOW_RESET` + `VALIDATION_INVALID_OUTLINE`).
  - Reset bằng `boxShadow: 'none'` (cùng `outline: 'none'`, `outlineOffset: '0'` để clear legacy preset).
- **TUYỆT ĐỐI KHÔNG override width của `.ag-header-container` / `.ag-header-row`** — AG Grid v35 tự tính width 2 element này = SUM tất cả column widths để align với body container + tính `translateX` theo `scrollLeft`. Ép `width: 100% !important` (= viewport width) phá math: grid mà tổng cột > viewport → scroll ngang chạm biên phải sẽ thấy header lệch hàng vĩnh viễn so với body (translate reference 2 width khác nhau). Triệu chứng đặc trưng: scroll thật nhanh đến biên phải, header và cell body lệch ~vài chục px, KHÔNG recover khi scroll ngược. Bug rất khó tái hiện ở grid ít cột (không cần scroll ngang). Background xanh header full-width đã apply ở `.ag-header` / `.ag-header-viewport` (full viewport width sẵn) — KHÔNG cần forced width ở container con. Reference: [shared/components/ag-grid-wrapper](src/app/shared/components/ag-grid-wrapper/ag-grid-wrapper.component.scss) đã được dọn override này 2026-05-08.
- **AG Grid `setData()` vs `setDataValue()`** — Custom cell renderer (datepicker, dropdown popup tự build) PHẢI dùng `node.setDataValue(field, val)` để fire `cellValueChanged` cho field cụ thể. `setData(rowObj)` chỉ fire `rowValueChanged` (whole row) → host listen `cellValueChanged` (recalc validation, refresh tooltip, push undo) sẽ MISS event → state stale.
- **AG Grid tooltip popup mid-hover không tự destroy** — Nếu user GIỮ chuột rồi data thay đổi qua picker / programmatic update (`setDataValue`/`refreshCells`), AG Grid không tự đóng tooltip popup → tooltip stale. Workaround: gọi [`clearActiveTooltip()`](src/app/shared/grid-core/clear-active-tooltip.util.ts) (xoá `.ag-tooltip-custom` khỏi DOM).
- **TUYỆT ĐỐI KHÔNG viết cellRenderer imperative DOM** — Mọi cellRenderer mới PHẢI là Angular component standalone implement `ICellRendererAngularComp`, OnPush, template HTML, `:host` + `:hover` CSS scoped, callbacks qua `cellRendererParams`. Pattern CẤM: `cellRenderer = (params) => { const el = document.createElement(...); el.style.cssText = '...'; ... }` với inline SVG / inline style / mouseenter listener. Reference chuẩn: [`formula-cell-renderer.component.ts`](src/app/excel-builder/renderers/formula-cell-renderer.component.ts), [`row-code-cell-renderer.component.ts`](src/app/excel-builder/renderers/row-code-cell-renderer.component.ts). Style preset hardcode trong renderer → đưa vào [`cell-styles.const.ts`](src/app/shared/utils/cell-styles.const.ts). Branching trên row flags (`_isTypeHeader`/`_catalogField`/...) → dùng [`getRowKind`](src/app/excel-builder/utils/row-kind.util.ts). AG Grid callback ColDef PHẢI typed: `RowDragCallbackParams`, `EditableCallbackParams`, `ValueSetterParams` — KHÔNG `(params: any)`.
- **Angular cell renderer + OnPush — BẮT BUỘC `cdr.markForCheck()` trong `refresh()`** — `ICellRendererAngularComp.refresh(params)` được AG Grid gọi khi value đổi mà cell vẫn cùng instance. Return `true` để AG Grid skip recreate (perf). NHƯNG OnPush không tự detect field mutation → mutate `this.displayValue = ...` không update template. Phải `inject(ChangeDetectorRef)` + `cdr.markForCheck()` cuối refresh. Quên = cell hiển thị value cũ (typically blank sau formula rebuild).
- **Sau `recomputeAll`/`buildGraph` PHẢI `gridApi.refreshCells({force:true})`** — `formula-graph.service.ts.recomputeAll()` chỉ populate shadow store, KHÔNG tự bảo AG Grid re-read. Cells render trước (qua `setGridOption('rowData', ...)`) đọc shadow rỗng → blank. `coordinator.rebuild()` đã handle. Khi extend coordinator, nhớ pattern này.
- **`FormulaService` + `FormulaGraphService` + `FormulaCoordinatorService` đều `providedIn: 'root'`** → Builder + Render mở cùng tab share singleton state. BẮT BUỘC `formulaCoordinator.setupContext(year, month, orgCode?)` lại MỖI LẦN load template/entry để clear stale ctx từ tab khác. Builder/report-mode/HQ-scope truyền `orgCode = null` → LOOKUPENTRY trả `#NOORG!`. Render thêm `formulaService.setEntryContext(null)` ở `ngOnDestroy`.
- **Validation feedback minimal** — Cell vi phạm validation: chỉ cần `outline` đỏ + entry trong `<app-validation-error-panel>` (collapsible list). KHÔNG dùng AG Grid tooltip cho validation message — đã thử và bỏ vì tooltip stale khi cell từ invalid → valid. Tooltip giữ chỉ cho formula metadata (header info, formula error code, dropdown info).

## Formula engine (Builder + Render) — kiến trúc giống Excel

**Dependency Graph + Topological Sort + Shadow Store + API Decoupling**.
Source: [`formula-graph.service.ts`](src/app/excel-builder/service/formula-graph.service.ts) + sub-folder [`formula-graph/`](src/app/excel-builder/service/formula-graph/).

- Parse mọi formula → trích `(rowCode, field)` deps (cellDeps + externalDeps). Aggregate (`SUM`, `SUMIF`...) expand range thành cells cụ thể qua `range-expander.ts`. Self-dep tự filter (vd `SUMIF(qty, tier, "A")` ở cell `rTier.qty` không tự reference chính nó → tránh false `#CIRCULAR!`).
- Build forward (`cell → deps`) + reverse (`cell → dependents`) maps. Topo sort (Kahn's) → eval order deterministic. Cycles detect 1 lần ở build time qua Tarjan SCC, members mark `#CIRCULAR!`.
- **Shadow store** = `Map<rowCode|field, value>` (key giữ ORIGINAL CASE — 2 rows `rdvpt` và `rDvPT` là 2 entries DISTINCT). valueGetter chỉ đọc shadow O(1) — KHÔNG recursion lúc render.
- **API Decoupling**: formula eval đọc rows/columns từ snapshot nội bộ (`rowByCode` + `columnByField` Maps build từ setters), KHÔNG qua AG Grid `gridApi.forEachNode`/`getColumns`. `getApiProxy()` tạo synthetic `GridApi` proxy override 4 methods. Eliminate class race condition `#NOROW!` do AG Grid lifecycle.
- **Lifecycle**:
  - Load template/entry → `rebuildFormulaGraph()` (4 setters + buildGraph + recomputeAll)
  - Cell edit → `formulaGraph.setData(rowCode, field, value)` → BFS reverse-deps → sub-topo eval → `refreshCells({columns: dependentFields})` đúng tập deps (typical 5-30 fields)
  - Cell config save / row add-delete → full rebuild (topology đổi)
- **Render mode entry context** (year/month/orgCode + GETDATA/LOOKUP/MYORG/LOOKUPENTRY lookup): set qua `setupFormulaContext()` → cả `FormulaService` lẫn `FormulaGraphService` cùng nhận. Sau `preloadGetdataAndContinue` xong → `rebuildFormulaGraph` để eval đúng external refs.
- **External lookup functions** (đọc cross-entry qua API `/v1/data-lookup`):
  - `GETDATA(templateCode, column, yearOffset[, monthOffset])` — match `row_code = currentRow`.
  - `LOOKUP(templateCode, rowCode, column, yearOffset[, monthOffset])` — explicit rowCode.
  - `MYORG(templateCode, column, yearOffset[, monthOffset])` — shorthand cho LOOKUP, rowCode tự = `AuthService.currentUser.companyCode`. Use case: 1 template chung cho tất cả PC, mỗi đơn vị login thấy số của mình. User HQ (không có companyCode) → cell trả `#NOORG!`. Cache key share với LOOKUP/GETDATA (orgCode = null trong key).
  - `LOOKUPENTRY(templateCode, column, yearOffset[, monthOffset])` — shorthand cho LOOKUP, rowCode tự = `entry.orgCode` của entry đang mở (KHÔNG phải user companyCode). Use case: HQ user mở entry PCHN → cell auto lookup data PCHN; PC user mở entry chính mình → kết quả giống MYORG. Entry không có orgCode (HQ scope, report mode multi-template, legacy data) → cell trả `#NOORG!`. Cache key share với LOOKUP/GETDATA/MYORG.
  - Tất cả 4 hàm đều phải register ở `formula-keywords.RESERVED_KEYWORDS`, strip ở `dependency-extractor.stripExternalRefs` (record external dep), và liệt kê ở `validate()` + `extractGetdataParams()` của `FormulaService`. Thiếu 1 chỗ → false `#REF!` hoặc cell stale khi đổi kỳ báo cáo. Khi thêm function thứ 5 cùng họ: tạo `XXX_FN_BASE_SPEC` + `buildXxxSpec()` mirror MYORG/LOOKUPENTRY, KHÔNG cần đụng `resolveCrossEntry` engine.
- **Save lifecycle (CRITICAL — không bỏ bước nào)**: `saveEntry` BẮT BUỘC theo thứ tự `ensureLookupCacheReady$` → **`formulaGraph.recomputeAll()`** → `serializeEntryData()` → `updateEntry`. Lý do: `serializeEntryData` đọc cell value qua valueGetter, valueGetter đọc shadow store. Nếu shadow chưa eval đầy đủ → trả `undefined` cho key chưa từng tồn tại trong rowData → `getPersistedCellValue` skip key → DB JSON thiếu giá trị formula → **LOOKUP cross-entry từ báo cáo khác đọc null → cell blank**. TUYỆT ĐỐI KHÔNG remove `recomputeAll()` step.
- **Auto-sync sau load**: `finishLoad` set `pendingAutoSync = true` → `tryAutoSyncFormulas()` chạy sau `rebuildFormulaGraph`. Gates: `viewMode==='entry'` + `canEditRows` + grid ready + `hasUnpersistedFormulaValues()` true. Mục đích: NSD mở entry vừa tạo (chưa save) → silent save → báo cáo aggregate đọc đúng. Toast `'Đã đồng bộ giá trị công thức...'`. Chạy 1 lần per load. **KHÔNG gate `isReportMode`** (bỏ từ 2026-05-07) — entry editable mở qua route `/report/...` (vd dialog tạo entry navigate sang URL hiện tại) cũng cần auto-sync. Lý do: đáp ứng workflow "tạo entry → tắt ngay không bấm Lưu" mà báo cáo phụ thuộc vẫn đọc đúng data.
- **Banner cảnh báo entry chưa đồng bộ**: hiện cho user **KHÔNG** có quyền edit (`!canEditRows`) khi mở entry có shadow ≠ persisted (`hasUnpersistedFormulaValues()` true). User edit được đã có auto-sync xử lý nên không thấy banner. Field `unsyncedFormulasDetected` recompute tại `finishLoad` + reset về `false` sau save success. Mục đích: NSD chỉ-đọc biết tại sao báo cáo phụ thuộc đang sai và tự liên hệ chủ entry. Style cam (`.unsynced-banner` trong scss) phân biệt với `.edit-mode-banner` xanh.
- **Test coverage**: 173 tests trong `excel-builder/service/**/*.spec.ts` — pure modules (types/range-expander/topo-sort/dep-extractor) + integration (`formula-graph.service.spec.ts`) + cross-entry (`formula-lookup-errors.spec.ts` cover LOOKUP/MYORG/LOOKUPENTRY) + regex collision (`formula.service.spec.ts`). Khi thêm function cross-entry mới: BẮT BUỘC mirror test pattern (NOORG / pure-raw-value / error propagation / compound / year-month / builder mode / precedence). Run via `/test-fe excel-builder/service`.

## Performance notes (file lớn — Excel Builder/Render)

- **AG Grid v35 mặc định bật column + row virtualization** → chỉ visible cells render. Đừng tắt `suppressColumnVirtualisation`.
- **Formula evaluation cost**: `formulaService.evaluate` 1-200ms/call tùy độ phức tạp (GETDATA/LOOKUP/MYORG/LOOKUPENTRY/aggregates chậm). Bottleneck chính khi template lớn.
- **Hot path Delete/Backspace**: `setDataValue` → `cellValueChanged` → `formulaGraph.setData()` BFS reverse-deps → sub-topo eval → `refreshCells({columns: dependentFields})`. Eval order deterministic theo topo, KHÔNG có recursion lúc render.
- **Dependency tracking** (DONE): `formula-graph.service.ts` build DAG từ formulas, topo sort, shadow store. Cell edit chỉ recompute cells thực sự ảnh hưởng (typical 5-30 cells, không phải 200). Build < 1s cho 200 formula cells; cell edit < 200ms.
- **API Decoupling** (DONE 2026-04): formula eval đọc snapshot nội bộ, không qua `gridApi.forEachNode`. Loại bỏ class race condition `#NOROW!`. Verify qua 25 integration tests.
- **Snapshot model entry** (DONE 2026-05 V10): entry `rowData` JSON là source of truth duy nhất sau khi BE clone từ template ở `createEntry`. Admin sửa template KHÔNG leak xuống entry cũ.
- **Memoized getters bắt buộc**: `existingFields`, `existingRowCodes`, `targetFieldOptions` trong builder dùng hash-based memo để tránh tạo array mới mỗi CD cycle. Khi extract sang services, **giữ nguyên contract memoized** — không expose getter trả array mới.
- **OnPush change detection**: candidate sau refactor cho các sub-component thuần input/output (toolbar, list-view, attachments-panel host).

## Known issues

- Bundle size ~2.28 MB (Taiga UI + AG Grid + ECharts + bpmn-js)
- No linter / no e2e configured
- 2 file component lớn (excel-builder ~2894, excel-render ~3300 dòng) — refactor Phase 1-3 đợt 1 done; còn ColumnManager/RowManager/CellConfig (Phase 3 đợt 2) nếu cần tiếp
