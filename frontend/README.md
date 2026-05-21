# ExcelPro Frontend — Angular 19.2

Frontend của hệ thống ExcelPro EVNNPC. Single Page Application (SPA) Angular với grid Excel-like (AG Grid + công thức), dashboard ECharts đa cấp, BPMN editor (bpmn-js), workflow inbox real-time qua SSE.

> Tài liệu này tập trung vào **cài đặt & vận hành**. Convention code dành cho developer xem [CLAUDE.md](CLAUDE.md). Tổng quan project xem [../README.md](../README.md).

---

## 1. Stack công nghệ

| Thành phần         | Phiên bản       | Ghi chú                                                       |
| ------------------ | --------------- | ------------------------------------------------------------- |
| Angular            | **19.2**        | Standalone components only — KHÔNG dùng NgModule              |
| TypeScript         | 5.7             | Strict mode + strict templates                                |
| Taiga UI           | 3.117           | CDK + core + kit + icons + styles + event-plugins             |
| AG Grid Community  | 35.0.1          | Virtualization, range selection, custom cell renderer         |
| ECharts            | 6.0             | Dashboard (`ngx-echarts` v19) — 8 chart components            |
| bpmn-js            | 18.14           | Visual BPMN editor (workflow definition)                      |
| camunda-bpmn-moddle| 7.0             | Camunda extension cho BPMN                                    |
| ExcelJS            | 4.4             | Import / export Excel client-side                             |
| Tailwind CSS       | 3.4             | `preflight: false` để không đè reset Taiga                    |
| RxJS               | 7.8             |                                                               |
| Zone.js            | 0.15            |                                                               |
| DOMPurify          | 3.3             | Sanitize HTML rich text                                       |
| Karma + Jasmine    | 6.4 / 5.6       | Unit test                                                     |

Bundle production: ~2.28 MB.

---

## 2. Yêu cầu môi trường

| Phần mềm        | Phiên bản                                       | Kiểm tra              |
| --------------- | ----------------------------------------------- | --------------------- |
| **Node.js**     | `^18.19.1` hoặc `^20.11.1` hoặc `>=22.0.0`      | `node -v`             |
| **npm**         | đi kèm Node (>= 9.x khuyến nghị)                | `npm -v`              |
| **Chrome**      | bản mới nhất                                    | cho Karma headless    |
| **Backend**     | đang chạy ở `http://localhost:8081`             | proxy `/excelpro-service` đi vào BE |

> Khuyến nghị dùng **Node 20 LTS**. Cài qua [nvm-windows](https://github.com/coreybutler/nvm-windows) (Windows) hoặc [nvm](https://github.com/nvm-sh/nvm) (Linux/macOS) để switch nhanh giữa các phiên bản Node.

---

## 3. Cài đặt & chạy lần đầu

### B1. Vào thư mục frontend

```bash
cd frontend
```

### B2. Cài dependencies

```bash
npm install
```

- Lần đầu mất ~3-5 phút, dung lượng `node_modules` ~700 MB.
- Nếu mạng công ty chặn registry, cấu hình proxy npm:
  ```bash
  npm config set proxy http://<proxy-host>:<port>
  npm config set https-proxy http://<proxy-host>:<port>
  ```

### B3. Đảm bảo backend đang chạy

Frontend proxy `/excelpro-service` → `http://localhost:8081` (xem [proxy.conf.js](proxy.conf.js)). Phải khởi động Backend trước — chi tiết [../backend/README.md](../backend/README.md).

### B4. Khởi động dev server

```bash
npm start
```

- Compile xong, mở: <http://localhost:4200>
- Hot reload tự động khi sửa file `src/`.
- Tài khoản mặc định: **`admin / 123456`**.

---

## 4. Build production

```bash
npm run build
```

- Output: `dist/my-app/`
- Bundle đã được Angular CLI tối ưu (AOT + tree-shaking + minify).
- Deploy lên Nginx / IIS / Apache (static file server).

### Mẫu Nginx config

```nginx
server {
    listen 80;
    server_name excelpro.evnnpc.vn;
    root /var/www/excelpro/dist/my-app;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API về backend
    location /excelpro-service/ {
        proxy_pass http://backend-host:8081/excelpro-service/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # SSE (notification)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
    }
}
```

### Deploy under sub-path

Nếu deploy ở `/app/` thay vì root:

```bash
npm run build -- --base-href=/app/
```

---

## 5. Cấu hình proxy & nhiều BE node

File [proxy.conf.js](proxy.conf.js) hỗ trợ load balance round-robin:

```js
const nodes = [
  'http://localhost:8081',
  // 'http://localhost:8082',  // bỏ comment để thêm node
  // 'http://localhost:8083',
];
```

Mỗi request `/excelpro-service/*` được phân phối tuần tự qua các node.

> Production thường KHÔNG dùng proxy.conf.js — reverse proxy (Nginx) đảm nhận load balancing.

---

## 6. Debug

### VS Code / Cursor

Thư mục `.vscode/` đã cấu hình sẵn:

- **ng serve**: Run and Debug → chọn **"ng serve"** — chạy `npm: start` rồi mở Chrome `http://localhost:4200/` với debugger attach.
- **ng test**: chọn **"ng test"** — Karma tại `http://localhost:9876/debug.html`.

Mở workspace từ thư mục `frontend` để áp dụng `.vscode/launch.json` + `tasks.json`.

### Trình duyệt

`npm start` → mở Chrome `http://localhost:4200` → DevTools → Sources. Source map ở config `development` đã bật trong `angular.json`.

---

## 7. Cấu trúc thư mục

```
frontend/
├── package.json
├── angular.json
├── proxy.conf.js              ← Cấu hình proxy /excelpro-service
├── tailwind.config.js
├── tsconfig.json / tsconfig.app.json / tsconfig.spec.json
├── src/
│   ├── index.html
│   ├── main.ts
│   ├── styles.css             ← Tailwind + Taiga global
│   └── app/
│       ├── app.routes.ts      ← 22 routes
│       ├── auth/              ← JWT, authGuard, adminGuard, LoginComponent
│       ├── header/            ← Gradient bar EVNNPC + notification + avatar
│       ├── sidebar/           ← Dark nav 220px, cây menu động
│       ├── notification-list/ ← SSE EventSource real-time
│       ├── excel-builder/     ← Builder template (~2894 dòng)
│       ├── excel-render/      ← Entry data UI (~3300 dòng)
│       ├── catalog-manager/   ← Master catalog CRUD
│       ├── grid-template-manager/
│       ├── organization-management/, user-management/, position-management/
│       ├── sidebar-menu-manager/, template-access-manager/
│       ├── workflow-manager/  ← BPMN editor + Camunda deploy
│       ├── workflow/          ← Inbox + approval dialog + history
│       ├── dashboard-scl/     ← 8 ECharts components
│       ├── scl-category/, scl-assessment/, suggested-category/
│       ├── kh-evn-nam/        ← Module KH năm EVN giao (nguồn LOOKUP HQ)
│       ├── report-type/, grid-dump-debug/
│       └── shared/            ← Services + components dùng chung
│           ├── components/    ← multi-select, date-picker, ag-grid-wrapper, ...
│           ├── grid-core/     ← Helpers share Builder/Render
│           ├── service/       ← AppDialogService, LoadingService, OrganizationService, ...
│           └── utils/         ← cell-styles.const, format helpers
└── assets/                    ← Icon, logo EVNNPC, ...
```

---

## 8. Routes chính

| Path                                | Component                              | Quyền                  |
| ----------------------------------- | -------------------------------------- | ---------------------- |
| `/login`                            | `LoginComponent`                       | —                      |
| `/` → `/grid-templates`             | redirect                               | authGuard              |
| `/dashboard-scl`                    | `DashboardSclComponent`                | authGuard              |
| `/grid-templates`                   | `GridTemplateManagerComponent`         | authGuard              |
| `/excel-builder?templateId=`        | `ExcelBuilderComponent`                | authGuard + unsavedChangesGuard |
| `/excel-render?templateId=&entryId=`| `ExcelRenderComponent`                 | authGuard              |
| `/report/:type`                     | `ExcelRenderComponent` (report mode)   | authGuard              |
| `/catalog-manager`                  | `CatalogManagerComponent`              | authGuard              |
| `/organization-management`          | `OrganizationManagementComponent`      | authGuard + adminGuard |
| `/user-management`                  | `UserManagementComponent`              | authGuard + adminGuard |
| `/position-management`              | `PositionManagementComponent`          | authGuard + adminGuard |
| `/sidebar-menu-manager`             | `SidebarMenuManagerComponent`          | authGuard + adminGuard |
| `/template-access-manager`          | `TemplateAccessManagerComponent`       | authGuard + adminGuard |
| `/workflow-manager`                 | `WorkflowManagerComponent`             | authGuard + adminGuard |
| `/workflow-manager/editor/:id`      | `BpmnEditorComponent`                  | authGuard + adminGuard |
| `/workflow/tasks`                   | `TaskListComponent`                    | authGuard              |
| `/report-type`                      | `ReportTypeComponent`                  | authGuard              |
| `/scl-category` + `/scl-category-detail` | `SclCategory*Component`           | authGuard              |
| `/scl-assessment`                   | `SclAssessmentListComponent`           | authGuard              |
| `/suggested-category`               | `SuggestedCategoryListComponent`       | authGuard              |
| `/debug/grid-dump`                  | `GridDumpDebugComponent`               | authGuard + adminGuard |

---

## 9. Test & lệnh dev hữu ích

```bash
# Test toàn bộ (watch mode, Chrome)
npm test

# Test 1 lần, không watch, Chrome headless, scope folder
npx ng test --no-watch --browsers=ChromeHeadless --include='src/app/excel-render/**/*.spec.ts'

# Type check không emit (verify TS strict)
npx tsc --noEmit -p tsconfig.app.json

# Build production
npm run build

# Watch build (rebuild khi sửa, không serve)
npm run watch

# Scaffold component
npx ng generate component <name>
```

Slash command `/test-fe` đã cấu hình sẵn cho Claude Code (xem `.claude/commands/`).

---

## 10. Đặc tả kiến trúc quan trọng

### Formula engine (Excel-like)

- **Dependency Graph + Topological Sort + Shadow Store + API Decoupling**.
- Source: [src/app/excel-builder/service/formula-graph.service.ts](src/app/excel-builder/service/formula-graph.service.ts).
- 4 hàm cross-entry đọc DB qua `/v1/data-lookup`:
  - `GETDATA(templateCode, column, yearOffset[, monthOffset])` — same row
  - `LOOKUP(templateCode, rowCode, column, yearOffset[, monthOffset])` — explicit row
  - `MYORG(...)` — auto rowCode = `currentUser.companyCode`
  - `LOOKUPENTRY(...)` — auto rowCode = `entry.orgCode`
- 173 unit tests trong `src/app/excel-builder/service/**/*.spec.ts`.

### Edit-table mode (chỉnh sửa cấu trúc bảng)

- Toggle ở excel-render — chỉ bật khi entry status = `DRAFT` hoặc `RETURNED`.
- Add / Delete / Drag row bất kỳ (template-cloned + custom). Chỉ row có `_isTypeHeader=true` cố định.
- Edit formula per-cell: click icon gear → `CellConfigDialogComponent` → rebuild formula graph + push undo.

### Snapshot model (V10 — 2026-05)

- Entry `rowData` JSON là **source of truth duy nhất**.
- Custom rows (RX prefix) sống chung với template rows, mark `_isCustomRow=true`. KHÔNG còn `afterRowCode` anchor.
- Order = visual index trong array.

---

## 11. Khắc phục sự cố

| Triệu chứng                                          | Cách xử lý                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `npm install` chậm / timeout                         | Cấu hình `npm config set registry` về mirror nội bộ, hoặc bật proxy.      |
| `EACCES: permission denied`                          | Linux/macOS: `sudo chown -R $USER ~/.npm`. Hoặc dùng nvm.                 |
| `Cannot find module 'xxx'` sau `git pull`            | `rm -rf node_modules package-lock.json && npm install`                    |
| Login 401 / Network error                            | Verify BE đang chạy: `curl http://localhost:8081/excelpro-service/v1/auth/login`. Kiểm tra `proxy.conf.js`. |
| CORS error trên môi trường deploy                    | Backend phải set `APP_CORS_ALLOWED_ORIGINS` chứa domain FE.               |
| AG Grid hiển thị blank sau load                      | Mở DevTools console — thường do formula `#NOROW!`/`#CIRCULAR!`. Mở debug `/debug/grid-dump`. |
| Browser treo khi mở grid lớn                         | Có thể do bind method call cho `[options]`/`[items]` Inputs → CD vô hạn. Xem CLAUDE.md mục Convention. |
| SSE notification không nhận event                    | Nginx proxy phải `proxy_buffering off; proxy_read_timeout 24h;`           |
| `ng serve` lỗi `EADDRINUSE: port 4200`               | `npx kill-port 4200` hoặc dùng port khác: `ng serve --port 4201`          |
| Build báo `JavaScript heap out of memory`            | Tăng RAM: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`          |
