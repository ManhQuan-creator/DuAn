# ExcelPro Backend — Spring Boot + Oracle + Camunda

Backend của hệ thống ExcelPro EVNNPC. Cung cấp REST API cho quản lý template grid, entry dữ liệu, workflow phê duyệt (Camunda BPMN), file đính kèm, dashboard SCL và notification real-time qua SSE.

> Tài liệu này tập trung vào **cài đặt & vận hành**. Convention code dành cho developer xem [CLAUDE.md](CLAUDE.md). Tổng quan project xem [../README.md](../README.md).

---

## 1. Stack công nghệ

| Thành phần       | Phiên bản | Ghi chú                                            |
| ---------------- | --------- | -------------------------------------------------- |
| Java             | **21**    | Toolchain release 21                               |
| Spring Boot      | 3.3.5     |                                                    |
| Spring Security  | (BOM)     | JWT (JJWT 0.12.6) + BCrypt                         |
| Spring Data JPA  | (BOM)     | Hibernate, dialect `OracleDialect`                 |
| Oracle JDBC      | ojdbc11   | HikariCP min 5 / max 20                            |
| Redis            | (Lettuce) | Cache (notification, session counter, lookup)      |
| Camunda BPM      | 7.24      | Spring Boot starter + Cockpit/Tasklist/Admin       |
| Apache POI       | 5.3       | Import/export Excel                                |
| MapStruct        | 1.6       |                                                    |
| ModelMapper      | 3.2       |                                                    |
| SpringDoc OpenAPI| 2.6       | Swagger UI                                         |
| Lombok           | (BOM)     |                                                    |
| jsch             | 0.2.21    | SFTP client                                        |

---

## 2. Yêu cầu môi trường

| Phần mềm    | Phiên bản                          | Kiểm tra              |
| ----------- | ---------------------------------- | --------------------- |
| **JDK 21**  | Adoptium Temurin / Oracle JDK 21   | `java -version`       |
| **Maven**   | KHÔNG cần — dùng `mvnw` đi kèm     | `./mvnw -v`           |
| **Oracle**  | 19c / 21c (driver `ojdbc11`)       | `sqlplus EVNNPC/...`  |
| **Redis**   | 6.x+                               | `redis-cli ping`      |

### Đặt biến môi trường JAVA_HOME (Windows)

```powershell
# Bật bằng quyền Admin (cài đặt 1 lần)
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-21.0.x-hotspot" /M
setx PATH "$env:PATH;$env:JAVA_HOME\bin" /M
# Mở terminal mới và xác nhận:
java -version
```

---

## 3. Cài đặt & chạy lần đầu

### B1. Vào thư mục backend

```bash
cd backend
```

### B2. Cấu hình kết nối DB & Redis

Mặc định backend kết nối thẳng tới Oracle + Redis nội bộ EVNNPC (xem [src/main/resources/application.yml](src/main/resources/application.yml)):

```yaml
spring:
  datasource:
    url: jdbc:oracle:thin:@//10.10.0.202:1521/orcl
    username: EVNNPC
    password: EVNNPC
  data:
    redis:
      host: 10.10.0.235
      port: 6379
```

**Cho môi trường khác (UAT/PROD/local)**, override qua biến môi trường — KHÔNG sửa `application.yml` trực tiếp:

```bash
# Linux/macOS
export SPRING_DATASOURCE_URL="jdbc:oracle:thin:@//db-uat:1521/orcl"
export SPRING_DATASOURCE_USERNAME="evnnpc_uat"
export SPRING_DATASOURCE_PASSWORD="<secret>"
export SPRING_DATA_REDIS_HOST="redis-uat"
export APP_JWT_SECRET="<base64 32+ byte mới>"

# Windows PowerShell
$env:SPRING_DATASOURCE_URL="jdbc:oracle:thin:@//db-uat:1521/orcl"
$env:SPRING_DATASOURCE_USERNAME="evnnpc_uat"
$env:SPRING_DATASOURCE_PASSWORD="<secret>"
```

### B3. Chạy ở chế độ development

```bash
# Windows
.\mvnw.cmd spring-boot:run

# Linux/macOS
./mvnw spring-boot:run
```

- Lần đầu: tải dependencies (~5-10 phút) — chỉ chạy lần đầu, lần sau dùng cache `~/.m2/repository`.
- Hibernate `ddl-auto: update` tự tạo bảng/cột mới trong schema `EVNNPC`.
- `DataInitializer` seed: 3 role (ADMIN/EDITOR/VIEWER), tài khoản `admin/123456`, 8 organization (1 HQ + 7 PC).
- Migration runner V10 (`CustomRowsMergeMigrationRunner`) tự gộp `CUSTOM_ROWS` legacy vào `rowData` 1 lần khi startup.

**Kiểm tra thành công**: log có dòng

```
Tomcat started on port 8081 (http) with context path '/excelpro-service'
Started OracleConnectionPoolApplication in X.XX seconds
```

### B4. Kiểm thử nhanh

| Endpoint                                                                 | Mục đích                  |
| ------------------------------------------------------------------------ | ------------------------- |
| <http://localhost:8081/excelpro-service/swagger-ui/index.html>           | Swagger UI                |
| <http://localhost:8081/excelpro-service/v1/auth/login>                   | POST login (admin/123456) |
| <http://localhost:8081/excelpro-service/camunda/app/cockpit/>            | Camunda Cockpit (admin)   |

```bash
curl -X POST http://localhost:8081/excelpro-service/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'
```

---

## 4. Build production

```bash
./mvnw clean package -DskipTests
# → target/oracle-connection-pool-0.0.1-SNAPSHOT.jar
```

Chạy:

```bash
java -jar target/oracle-connection-pool-0.0.1-SNAPSHOT.jar \
  --spring.profiles.active=prod
```

Hoặc dùng env file `.env` + systemd / Docker.

### Mẫu Dockerfile (gợi ý)

```dockerfile
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/oracle-connection-pool-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java","-jar","/app/app.jar"]
```

---

## 5. Cấu hình môi trường (biến env)

### Server & DB

| Biến                              | Mặc định                                    | Mô tả                                  |
| --------------------------------- | ------------------------------------------- | -------------------------------------- |
| `SERVER_PORT`                     | `8081`                                      |                                        |
| `SERVER_SERVLET_CONTEXT_PATH`     | `/excelpro-service`                         |                                        |
| `SPRING_DATASOURCE_URL`           | `jdbc:oracle:thin:@//10.10.0.202:1521/orcl` |                                        |
| `SPRING_DATASOURCE_USERNAME`      | `EVNNPC`                                    |                                        |
| `SPRING_DATASOURCE_PASSWORD`      | `EVNNPC`                                    | **Đổi cho prod**                       |
| `SPRING_DATA_REDIS_HOST`          | `10.10.0.235`                               |                                        |
| `SPRING_DATA_REDIS_PORT`          | `6379`                                      |                                        |
| `SPRING_DATA_REDIS_PASSWORD`      | (rỗng)                                      |                                        |

### Bảo mật

| Biến                          | Mặc định                                    | Mô tả                                          |
| ----------------------------- | ------------------------------------------- | ---------------------------------------------- |
| `APP_JWT_SECRET`              | (Base64 hardcoded)                          | **Bắt buộc đổi cho prod** — sinh `openssl rand -base64 48` |
| `APP_JWT_EXPIRATION_MS`       | `86400000` (24h)                            |                                                |
| `APP_CORS_ALLOWED_ORIGINS`    | `http://localhost:4200,https://form.llq.vn` | Comma-separated, KHÔNG dùng `*`                |

### File storage

| Biến                              | Mặc định                              | Mô tả                                       |
| --------------------------------- | ------------------------------------- | ------------------------------------------- |
| `APP_FILE_STORAGE_MODE`           | `SFTP`                                | `LOCAL` (FS cùng máy) hoặc `SFTP`            |
| `APP_FILE_SHARE_PATH`             | `/app/projects/share-file/excelpro`   | Path trên FS hoặc trên remote (SFTP)        |
| `APP_FILE_MAX_FILE_SIZE`          | `10485760` (10 MB)                    | ≤ `spring.servlet.multipart.max-file-size`  |
| `APP_SFTP_HOST`                   | `10.10.0.235`                         |                                             |
| `APP_SFTP_PORT`                   | `22`                                  |                                             |
| `APP_SFTP_USERNAME`               | `llqform`                             |                                             |
| `APP_SFTP_PASSWORD`               | `Abcd12#$`                            | Ưu tiên `APP_SFTP_KEY` (SSH key) hơn        |
| `APP_SFTP_STRICT_HOST_CHECK`      | `false`                               | **Đặt `true` cho prod**                     |

### Camunda

| Biến                                  | Mặc định        | Mô tả                          |
| ------------------------------------- | --------------- | ------------------------------ |
| `CAMUNDA_BPM_ADMIN_USER_ID`           | `camunda-admin` | User truy cập Cockpit          |
| `CAMUNDA_BPM_ADMIN_USER_PASSWORD`     | `camunda-admin` | **Đổi cho prod**               |

---

## 6. Cấu trúc thư mục

```
backend/
├── pom.xml
├── mvnw / mvnw.cmd            ← Maven wrapper
├── src/main/java/org/example/oracleconnectionpool/
│   ├── annotation/            ← @ExcelColumn
│   ├── buttonaction/          ← Template button action framework
│   ├── config/                ← Redis, Auditing, GlobalExceptionHandler, DataInitializer
│   ├── constant/              ← API paths, EntryStatus, TemplateStatus
│   ├── controller/            ← 24 REST controllers
│   ├── entity/                ← 28 JPA entities
│   ├── enums/                 ← ActiveEnum, BaseEnum, DeptEnum, ...
│   ├── exceptions/            ← Custom exceptions
│   ├── formula/               ← IndicatorCalculationService
│   ├── mapper/                ← MapStruct mappers
│   ├── model/                 ← DTO (request, response, base)
│   ├── repository/            ← JPA + JDBC repositories
│   ├── security/              ← AppUserDetails, JwtTokenProvider, SecurityConfig
│   ├── service/               ← 29 services (+ migration/ runner V10)
│   ├── storage/               ← LOCAL/SFTP abstraction
│   ├── utils/                 ← EntryRowDataParser, EntryRowKind, ...
│   └── workflow/              ← BPMN handlers, delegates
├── src/main/resources/
│   ├── application.yml        ← Cấu hình chính
│   └── db/                    ← V1..V11 SQL files (documentation-only — JPA ddl-auto tự sync)
└── src/test/                  ← Test (Spring Boot Test)
```

---

## 7. REST API — endpoint chính

Toàn bộ endpoint dưới context-path `/excelpro-service`:

| Controller                     | Base path                                                       | Mục đích                                    |
| ------------------------------ | --------------------------------------------------------------- | ------------------------------------------- |
| `AuthController`               | `/v1/auth`                                                      | Login (permitAll) + `/me`                   |
| `UserController`               | `/v1/users`                                                     | User CRUD (ADMIN)                           |
| `OrganizationController`       | `/v1/organizations`                                             | Tổ chức (GET=auth, mutate=ADMIN)            |
| `PositionController`           | `/v1/positions`                                                 | Chức vụ (ADMIN)                             |
| `DeptTypeController`           | `/v1/dept-types`                                                | Loại phòng ban                              |
| `MasterCatalogController`      | `/v1/master-data`                                               | Danh mục master                             |
| `SidebarMenuController`        | `/v1/sidebar-menus`                                             | Cây menu sidebar                            |
| `GridTemplateController`       | `/v1/grid-templates`                                            | Template CRUD                               |
| `GridDataEntryController`      | `/v1/grid-templates/{id}/entries`                               | Entry CRUD                                  |
| `GridPermissionController`     | `/v1/grid-templates/{id}/permissions`                           | Phân quyền cấp grid                         |
| `EntryFileController`          | `/v1/grid-templates/{tid}/entries/{eid}/files`                  | File đính kèm                               |
| `TemplateAccessController`     | `/v1/template-access`                                           | Phân quyền template (ADMIN)                 |
| `TemplateButtonController`     | `/v1/template-buttons`                                          | Custom button actions                       |
| `DataLookupController`         | `/v1/data-lookup`                                               | Cross-entry formula (LOOKUP/GETDATA/...)    |
| `WorkflowDefinitionController` | `/v1/workflow-definitions`                                      | Workflow CRUD + deploy BPMN (ADMIN)         |
| `WorkflowController`           | `/v1/workflow`                                                  | Task: pending / approve / reject / history  |
| `NotificationController`       | `/api/v1/notifications`                                         | SSE real-time                               |
| `CommentsController`           | `/v1/comments`                                                  | Comments                                    |
| `SclCategoryController`        | `/v1/scl-category`                                              | SCL category + extract preview              |
| `SclAssessmentController`      | `/v1/scl-assessment`                                            | Đánh giá SCL                                |
| `SuggestedCategoryController`  | `/v1/suggested-category`                                        | Danh mục đề xuất                            |
| `PcCompanyController`          | `/v1/pc-companies`                                              | Catalog PC                                  |
| `PcOrganizationUnitController` | `/v1/pc-organization-units`                                     | Catalog đơn vị PC                           |
| `GridDumpController`           | `/v1/grid-debug`                                                | Debug grid (ADMIN)                          |

### Response envelope chuẩn

```json
{
  "code": "...",
  "message": "...",
  "data": <T>,
  "errors": [],
  "traceId": "...",
  "responseTime": "..."
}
```

### Authentication

- Header: `Authorization: Bearer <jwt-token>`
- Hoặc query param: `?token=<jwt-token>` (dành cho SSE EventSource không gửi được header).

---

## 8. Database migration

- File SQL nằm trong `src/main/resources/db/V1..V11__*.sql` — **documentation-only**. JPA `ddl-auto=update` tự thêm column mới khi entity thay đổi.
- Khi cần drop column / migrate data (vd V10 drop `CUSTOM_ROWS`), chạy thủ công SQL HOẶC dựa vào `*MigrationRunner` (Spring `ApplicationRunner`) auto-chạy 1 lần lúc startup.
- V11 (`V11__seed_kh_evn_nam_template.sql`) seed 2 template `KH_SXKD_NAM` + `KH_MUC_TIEU_NAM` — nguồn LOOKUP cấp HQ.

---

## 9. Test & build

```bash
# Chạy toàn bộ test
./mvnw test

# Chỉ 1 class
./mvnw test -Dtest=GridDataEntryServiceTest

# Compile only (~30s — verify code compile)
./mvnw clean compile -DskipTests

# Đóng gói JAR
./mvnw clean package -DskipTests
```

Slash command `/test-be` và `/build` đã được cấu hình sẵn cho Claude Code (xem `.claude/commands/`).

---

## 10. Khắc phục sự cố

| Triệu chứng                                            | Cách xử lý                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `ORA-12541: TNS:no listener`                           | Sai host/port hoặc DB chưa start. Kiểm tra `SPRING_DATASOURCE_URL`.              |
| `ORA-01017: invalid username/password`                 | Sai credential. Verify trực tiếp bằng `sqlplus`.                                 |
| `Unable to connect to Redis`                           | Verify `redis-cli -h <host> ping`. Hoặc tạm comment Redis trong `application.yml`. |
| `Port 8081 already in use`                             | `netstat -ano \| findstr :8081` → `taskkill /PID <id> /F`.                       |
| `java.lang.UnsupportedClassVersionError`               | Java < 21. Kiểm tra `java -version`, đổi `JAVA_HOME`.                            |
| Camunda Cockpit không login được                       | Mặc định `camunda-admin/camunda-admin`. Đổi qua env `CAMUNDA_BPM_ADMIN_USER_*`.  |
| LOOKUP cross-entry trả blank                           | Entry target chưa được mở+save sau khi có formula. Mở entry đó → auto-sync chạy. |
| File upload `SizeLimitExceededException`               | Tăng `spring.servlet.multipart.max-file-size` + `APP_FILE_MAX_FILE_SIZE`.        |