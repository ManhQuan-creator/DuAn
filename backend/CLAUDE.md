# Backend — Spring Boot 3.3.5 + Oracle + Camunda

> Auto-loaded khi Claude Code thao tác trong `backend/`. Root [CLAUDE.md](../CLAUDE.md) cho monorepo overview.

## Stack

- **Java**: 21 (toolchain release 21)
- **Framework**: Spring Boot 3.3.5, Spring Security + JWT (JJWT 0.12.6), BCrypt
- **DB**: Oracle (ojdbc11) + HikariCP (min 5, max 20)
- **Cache**: Redis (Lettuce, host `10.10.0.235:6379`)
- **Workflow**: Camunda BPM 7.24 (Spring Boot starter + Cockpit/Tasklist/Admin) — Oracle, history full
- **Excel I/O**: Apache POI 5.3
- **Libs**: Lombok, MapStruct 1.6, ModelMapper 3.2, SpringDoc OpenAPI 2.6, Jackson JSR310

## Quick commands

```bash
./mvnw spring-boot:run                  # Dev (port 8081, context-path /excelpro-service)
./mvnw clean compile -DskipTests        # Compile only (~30s)
./mvnw clean package -DskipTests        # Package jar
./mvnw test -Dtest=GridDataEntryServiceTest  # Single test class
```

## Package structure (`org.example.oracleconnectionpool`)

```
├── annotation/      ← @ExcelColumn (mark export columns)
├── buttonaction/    ← Template button action handler framework
│                      (ButtonActionHandler + Registry + handlers — vd
│                       SCLTaoBieuMauPhanBoCPSCLChoDV, SCLGiaoChiPhiChoDonVi,
│                       SCLDuyetDangKyDanhMucPc)
├── config/          ← Redis, auditing, GlobalExceptionHandler, DataInitializer, MultipartConfig
├── constant/        ← Api.V1 paths + EntryRowKeys + status constants
│                      (EntryStatus, TemplateStatus, WorkflowDefinitionStatus,
│                       SclPhanLoai — 4 phân loại SCL extract entry 344)
├── controller/      ← 24 REST controllers (xem bảng dưới)
├── enums/           ← ActiveEnum, BaseEnum, DeptEnum, StatusSclAssessmentEnum, StatusSclCategoryEnum
├── entity/          ← 28 JPA entities
├── exceptions/      ← Custom exceptions (NotFoundException, BadRequestException, ForbiddenException)
├── formula/         ← IndicatorCalculationService (BE formula evaluation)
├── mapper/          ← MapStruct mappers
├── model/           ← DTOs (request, response, base)
├── repository/      ← JPA + JDBC repositories
├── security/        ← AppUserDetails, JwtTokenProvider, JwtAuthenticationFilter, SecurityConfig
├── service/         ← 29 services
│   └── migration/   ← One-shot migration runners (CustomRowsMergeMigrationRunner V10)
├── storage/         ← LOCAL/SFTP file storage abstraction
├── utils/           ← Utility classes
└── workflow/        ← Workflow action handler framework (WorkflowAction interface + Dispatcher
                       + Registry, *ApproveHandler, TaskNotificationDelegate, UpdateEntryStatusDelegate)
```

## Controllers

| Controller | Base Path | Mục đích |
|---|---|---|
| `AuthController` | `/v1/auth` | login (permitAll) + me |
| `UserController` | `/v1/users` | User CRUD (ADMIN) |
| `OrganizationController` | `/v1/organizations` | Org CRUD (GET=auth, mutate=ADMIN) |
| `PositionController` | `/v1/positions` | Position CRUD (ADMIN) |
| `DeptTypeController` | `/v1/dept-types` | Department types |
| `MasterCatalogController` | `/v1/master-data` | Catalog items |
| `SidebarMenuController` | `/v1/sidebar-menus` | Sidebar menu tree |
| `GridTemplateController` | `/v1/grid-templates` | Template CRUD |
| `GridDataEntryController` | `/v1/grid-templates/{id}/entries` | Entry CRUD |
| `GridPermissionController` | `/v1/grid-templates/{id}/permissions` | Grid-level permission |
| `EntryFileController` | `/v1/grid-templates/{templateId}/entries/{entryId}/files` | Attachments upload/download |
| `TemplateAccessController` | `/v1/template-access` | Template access (ai dùng template) |
| `TemplateButtonController` | `/v1/template-buttons` | Custom button actions |
| `DataLookupController` | `/v1/data-lookup` | Cross-entry formula lookup API (FE: GETDATA/LOOKUP/MYORG/LOOKUPENTRY) |
| `WorkflowDefinitionController` | `/v1/workflow-definitions` | Definition CRUD + deploy BPMN |
| `WorkflowController` | `/v1/workflow` | User tasks: pending, approve, reject, history |
| `NotificationController` | `/api/v1/notifications` | SSE endpoint |
| `CommentsController` | `/v1/comments` | Comments |
| `SclCategoryController` | `/v1/scl-category` | SCL category CRUD + import/export + `GET /extract-preview/{entryId}` (debug — extract rowData entry 344 → list SclCategoryEntity preview JSON, KHÔNG persist) |
| `SclAssessmentController` | `/v1/scl-assessment` | SCL assessment |
| `SuggestedCategoryController` | `/v1/suggested-category` | Suggested category |
| `PcCompanyController` | `/v1/pc-companies` | PC company catalog |
| `PcOrganizationUnitController` | `/v1/pc-organization-units` | PC org unit catalog |
| `GridDumpController` | `/v1/grid-debug` | Debug-only dump grid state |

## Auth & Authz

- **JWT**: `Authorization: Bearer <token>` header HOẶC `?token=<token>` query param (cho SSE).
- **permitAll**: `/v1/auth/login`, `/swagger-ui/**`, `/v3/api-docs/**`.
- **ADMIN only**: `/v1/users/**`, `/v1/positions/**`, `/v1/sidebar-menus` (mutate), `/v1/template-access/**`, `/v1/workflow-definitions/**`, `/v1/organizations/all` + POST/PUT/DELETE `/v1/organizations/**`.
- **Authenticated**: tất cả endpoints còn lại.
- **Data scope**: `Organization` entity (HEADQUARTERS/SUBSIDIARY). HQ + ADMIN see all; SUBSIDIARY auto-filtered to own org. `AppUserDetails` carries `orgCode`.
- **Seed data** (`DataInitializer`): roles ADMIN/EDITOR/VIEWER + admin (`admin`/`123456`) + 8 organizations (1 HQ + 7 subsidiaries).
- **Auditing**: `CustomAuditingEntityListener` lấy username từ `SecurityContextHolder`, fallback `"SYSTEM"`.

## Response envelope

```json
{ "code": "...", "message": "...", "data": <T>, "errors": [], "traceId": "", "responseTime": "" }
```

## File storage

- Mode: `LOCAL` (default) hoặc `SFTP` (env `APP_FILE_STORAGE_MODE`).
- LOCAL share path: `/app/projects/share-file/excelpro` (env `APP_FILE_SHARE_PATH`).
- SFTP: `APP_FILE_SFTP_HOST/PORT/USERNAME/PASSWORD`.
- Max upload: 10MB (configurable via `spring.servlet.multipart.max-file-size`).

## Conventions

- **Snapshot model entry**: `GRID_DATA_ENTRY.rowData` JSON là source of truth duy nhất sau khi BE clone từ template ở `createEntry`. Admin sửa template KHÔNG leak xuống entry cũ. Cột `CUSTOM_ROWS` đã drop ở V10 (data merged qua [`CustomRowsMergeMigrationRunner`](src/main/java/org/example/oracleconnectionpool/service/migration/CustomRowsMergeMigrationRunner.java)).
- **`GridDataEntryService.snapshotTemplateRows(templateId)` là PUBLIC** — **MỌI flow tạo `GridDataEntry`** PHẢI gọi method này (hoặc reuse `ButtonActionEntryUtil.createTargetEntry`) để clone template rows. Áp dụng cho:
  - Button action handlers (`buttonaction/handler/*`).
  - Workflow approve/reject handlers (`workflow/action/handler/*` — vd `SclTamGiaoChiPhiApproveHandler`, `DonViLapKeHoachApproveHandler`).
  - Migration runners (`service/migration/*`).
  - Scheduled task / Camunda delegate / Spring `ApplicationRunner` tạo entry.
  - Bất kỳ service khác gọi `entryRepository.save(...)` với `rowData`.

  **TUYỆT ĐỐI KHÔNG dùng `rowData("[]")` rỗng** — FE đã bỏ legacy fallback merge với template từ V10. Entry rỗng → cell formula không có context để eval → LOOKUP cross-entry trả null. Khi review code mới, **grep `rowData("[]")` hoặc `rowData("")` = bug signal**.
- **Status string**: BẮT BUỘC reference qua constant class trong `constant/`, KHÔNG hardcode raw string `"DRAFT"`/`"DISTRIBUTED"`/... ở handler/service/entity. 3 domain riêng:
  - `EntryStatus` — `GRID_DATA_ENTRY.status` (`DRAFT`, `SUBMITTED`, `RETURNED`, `APPROVED`, `REJECTED`, `DISTRIBUTED`).
  - `TemplateStatus` — `GRID_TEMPLATE.status` (`DRAFT`, `PUBLISHED`).
  - `WorkflowDefinitionStatus` — `WORKFLOW_DEFINITION.status` (`DRAFT`, `DEPLOYED`).
  Workflow-step intermediate status (vd `BKH_REVIEWED`, `TGD_APPROVED`) là dữ liệu config trong `WorkflowStep.statusAfterApprove`, KHÔNG khai báo hằng số. Chuyển status entry → dùng `ButtonActionEntryUtil.markDistributed(...)` thay vì `setStatus + save` thủ công.
- **Migration**: SQL files trong `src/main/resources/db/V*__*.sql` documentation-only (JPA `ddl-auto=update` tự create column nhưng KHÔNG drop). V10+ cần chạy thủ công sau khi BE startup chạy `*MigrationRunner` (Spring `ApplicationRunner`).
- **Reusable building blocks (BẮT BUỘC dùng, KHÔNG copy-paste)**:
  - **Parse rowData JSON**: [`EntryRowDataParser`](src/main/java/org/example/oracleconnectionpool/utils/EntryRowDataParser.java) — `parseRows(json, logTag)` + helper format cell (`trimCell`, `cellOrNull`, `numberToString`, `allFieldsBlank`). Graceful fallback nếu JSON malformed.
  - **Classify STT cell**: [`EntryRowKind.classify(stt)`](src/main/java/org/example/oracleconnectionpool/utils/EntryRowKind.java) → enum `META | ROMAN_SECTION | LATIN_SUB_SECTION | DATA_ITEM | UNKNOWN` cho state machine của extractor.
  - **Lookup catalog ID → name**: [`MasterCatalogService.getCatalogNameMap(type)`](src/main/java/org/example/oracleconnectionpool/service/MasterCatalogService.java) → `LinkedHashMap<id, name>` (active items, theo sortOrder). KHÔNG inject `MasterCatalogRepository` thẳng vào service nghiệp vụ.
  - **Notification broadcast**: [`PcCompanyNotificationUtil.notifyAllPcUsers(...)`](src/main/java/org/example/oracleconnectionpool/buttonaction/util/PcCompanyNotificationUtil.java) (orgGroupCode=PC_COMPANY) + [`BanKhNotificationUtil.notifyAllBanKhUsers(...)`](src/main/java/org/example/oracleconnectionpool/buttonaction/util/BanKhNotificationUtil.java) (EVNNPC+BAN_KH). Target group mới → tạo sibling util cùng package, KHÔNG inline trong handler.
- **Mapping entry rowData → domain entity**: precedent [`SclCategoryExtractor`](src/main/java/org/example/oracleconnectionpool/service/impl/SclCategoryExtractor.java) (entry 344 PL159 → `List<SclCategoryEntity>` theo Roman I/II/III/IV). Production caller [`SCLDuyetDangKyDanhMucPc`](src/main/java/org/example/oracleconnectionpool/buttonaction/handler/scl/SCLDuyetDangKyDanhMucPc.java) (button `SCL_DUYET_DANG_KY_DANH_MUC_PC`). Debug preview: `GET /v1/scl-category/extract-preview/{entryId}`. Idempotent qua status check. Extractor mới chỉ cần override: bộ section ID + `DATA_FIELDS` set + `buildEntity(entry, row, sectionContext, lookups)` — ~80-100 dòng.
- **JWT secret hardcoded** trong `application.yml` (cần chuyển env variable cho production).
- **Lombok**: dùng `@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor` cho entity. `@RequiredArgsConstructor` + `@Slf4j` cho service.
- **Validation**: `@Validated` + `@NotBlank`/`@NotNull`/`@Min`/`@Max` ở DTO, throw `BadRequestException` nếu fail.
