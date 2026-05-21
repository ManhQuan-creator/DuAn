package org.example.oracleconnectionpool.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.constant.TemplateStatus;
import org.example.oracleconnectionpool.constant.WorkflowDefinitionStatus;
import org.example.oracleconnectionpool.entity.*;
import org.example.oracleconnectionpool.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final AppRoleRepository            appRoleRepository;
    private final AppUserRepository            appUserRepository;
    private final OrganizationRepository       organizationRepository;
    private final MasterCatalogTypeRepository  masterCatalogTypeRepository;
    private final MasterCatalogRepository      masterCatalogRepository;
    private final PasswordEncoder              passwordEncoder;
    private final WorkflowDefinitionRepository workflowDefinitionRepository;
    private final WorkflowStepRepository       workflowStepRepository;
    private final PositionRepository           positionRepository;
    private final TemplateAccessRepository     templateAccessRepository;
    private final GridTemplateRepository       gridTemplateRepository;
    private final TemplateButtonRepository     templateButtonRepository;
    private final PcCompanyRepository          pcCompanyRepository;
    private final DataSource                   dataSource;

    @Override
    public void run(String... args) {
        migrateSchema();
        migratePcCompanyFromOrg();
        seedRolesAndAdmin();
        seedOrganizations();
        seedPcCompanies();
        seedPositions();
        seedUsers();
        seedSclWorkflow();
        seedCatalogTypes();
        seedCatalogItems();
        seedSclTemplate();
        seedTemplateAccess();
        seedTemplateButtons();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SCHEMA MIGRATION — idempotent, chạy mỗi lần khởi động
    // ddl-auto=update chỉ ADD cột mới, không DROP/RENAME → phải tự xử lý
    // ══════════════════════════════════════════════════════════════════════════

    private void migrateSchema() {
        // Drop cột legacy không còn dùng
        dropColumnIfExists("TEMPLATE_ACCESS", "ACCESS_LEVEL");
        dropColumnIfExists("TEMPLATE_ACCESS", "SUBJECT_TYPE");
        dropColumnIfExists("TEMPLATE_ACCESS", "SUBJECT_CODE");
        dropColumnIfExists("TEMPLATE_ACCESS", "SUBJECT_USER");
        dropColumnIfExists("TEMPLATE_ACCESS", "SUBJECT_ORG_GROUP");
        dropColumnIfExists("APP_USER",        "ORG_CODE");

        // Rename cột (SUBJECT_DEPT_CODE → SUBJECT_ORG_CODE, SUBJECT_POSITION → SUBJECT_POSITION_CODE)
        renameColumnIfExists("TEMPLATE_ACCESS", "SUBJECT_DEPT_CODE", "SUBJECT_ORG_CODE");
        renameColumnIfExists("TEMPLATE_ACCESS", "SUBJECT_POSITION",  "SUBJECT_POSITION_CODE");
    }

    private void dropColumnIfExists(String table, String column) {
        try (Connection con = dataSource.getConnection()) {
            DatabaseMetaData meta = con.getMetaData();
            try (ResultSet rs = meta.getColumns(null, null, table.toUpperCase(), column.toUpperCase())) {
                if (rs.next()) {
                    try (var stmt = con.createStatement()) {
                        stmt.execute("ALTER TABLE " + table + " DROP COLUMN " + column);
                        log.info("Schema migration: dropped {}.{}", table, column);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Schema migration: cannot drop {}.{} — {}", table, column, e.getMessage());
        }
    }

    private void renameColumnIfExists(String table, String oldCol, String newCol) {
        try (Connection con = dataSource.getConnection()) {
            DatabaseMetaData meta = con.getMetaData();
            // Cột cũ tồn tại nhưng cột mới chưa tồn tại → rename
            boolean oldExists, newExists;
            try (ResultSet rs = meta.getColumns(null, null, table.toUpperCase(), oldCol.toUpperCase())) {
                oldExists = rs.next();
            }
            try (ResultSet rs = meta.getColumns(null, null, table.toUpperCase(), newCol.toUpperCase())) {
                newExists = rs.next();
            }
            if (oldExists && !newExists) {
                try (var stmt = con.createStatement()) {
                    stmt.execute("ALTER TABLE " + table + " RENAME COLUMN " + oldCol + " TO " + newCol);
                    log.info("Schema migration: renamed {}.{} → {}", table, oldCol, newCol);
                }
            }
        } catch (Exception e) {
            log.warn("Schema migration: cannot rename {}.{} → {} — {}", table, oldCol, newCol, e.getMessage());
        }
    }

    /**
     * Migration: chuyển các dòng còn sót orgLevel='PC_COMPANY' trong ORGANIZATION
     * sang bảng PC_COMPANY, rồi xóa khỏi ORGANIZATION.
     * Chạy trước seedOrganizations để guard count() hoạt động đúng.
     */
    private void migratePcCompanyFromOrg() {
        var pcOrgs = organizationRepository.findByOrgLevel("PC_COMPANY");
        if (pcOrgs.isEmpty()) return;

        for (var org : pcOrgs) {
            if (!pcCompanyRepository.existsByCompanyCode(org.getOrgCode())) {
                pcCompanyRepository.save(PcCompany.builder()
                        .companyCode(org.getOrgCode())
                        .companyName(org.getOrgName())
                        .active(org.getActive())
                        .build());
            }
            organizationRepository.delete(org);
        }
        log.info("Migration: đã chuyển {} công ty điện lực từ ORGANIZATION → PC_COMPANY", pcOrgs.size());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ROLES + ADMIN
    // ══════════════════════════════════════════════════════════════════════════

    private void seedRolesAndAdmin() {
        AppRole adminRole  = findOrCreateRole("ADMIN",  "Quản trị viên",  "Toàn quyền quản lý hệ thống");
        AppRole editorRole = findOrCreateRole("EDITOR", "Biên tập viên",  "Nhập liệu và chỉnh sửa biểu mẫu");
        findOrCreateRole("VIEWER", "Người xem", "Chỉ xem dữ liệu");

        if (!appUserRepository.existsByUsername("admin")) {
            AppUser admin = AppUser.builder()
                    .username("admin")
                    .password(passwordEncoder.encode("123456"))
                    .fullName("Quản trị viên")
                    .email("admin@evnnpc.vn")
                    .orgGroupCode("EVNNPC")
                    .companyCode(null)
                    .deptCode(null)
                    .positionCode(null)
                    .active(true)
                    .roles(Set.of(adminRole, editorRole))
                    .build();
            appUserRepository.save(admin);
            log.info("Đã tạo tài khoản admin mặc định (admin/123456)");
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ORGANIZATION — cơ cấu tổ chức nội bộ TCT EVNNPC
    //   orgLevel = EVNNPC   : 1 row (Tổng công ty)
    //   orgLevel = HQ_DEPT  : 14 Ban trực thuộc TCT
    //   orgLevel = PC_DEPT  : các loại Phòng chung của mọi Công ty Điện lực
    //
    // PC_COMPANY (24 công ty điện lực) lưu riêng ở bảng PC_COMPANY.
    // ORGANIZATION.orgCode là DUY NHẤT — dùng làm subject_org_code trong TEMPLATE_ACCESS.
    // ══════════════════════════════════════════════════════════════════════════

    private void seedOrganizations() {
        // Dùng upsert per-row để hỗ trợ cả fresh start và upgrade (thêm PC_DEPT rows)
        upsertOrg("EVNNPC",      "Tổng công ty Điện lực miền Bắc",              "EVNNPC",  null);

        // Ban thuộc TCT (HQ_DEPT)
        upsertOrg("BAN_KH",     "Ban Kế hoạch",                                 "HQ_DEPT", "EVNNPC");
        upsertOrg("BAN_TCNS",   "Ban Tổ chức và Nhân sự",                        "HQ_DEPT", "EVNNPC");
        upsertOrg("BAN_TCKKT",  "Ban Tài chính Kế toán",                         "HQ_DEPT", "EVNNPC");
        upsertOrg("BAN_QLDT",   "Ban Quản lý Đầu tư",                            "HQ_DEPT", "EVNNPC");
        upsertOrg("BAN_KD",     "Ban Kinh doanh",                                "HQ_DEPT", "EVNNPC");
        upsertOrg("BAN_AT",     "Ban An toàn",                                   "HQ_DEPT", "EVNNPC");
        upsertOrg("BAN_KT",     "Ban Kỹ thuật",                                  "HQ_DEPT", "EVNNPC");
        upsertOrg("BAN_TTVH",   "Ban Truyền thông và Văn hóa Doanh nghiệp",      "HQ_DEPT", "EVNNPC");
        upsertOrg("BAN_TTra",   "Ban Thanh tra và Kiểm tra",                      "HQ_DEPT", "EVNNPC");
        upsertOrg("BAN_PC",     "Ban Pháp chế",                                  "HQ_DEPT", "EVNNPC");
        upsertOrg("BAN_QLDT2",  "Ban Quản lý Đấu thầu",                          "HQ_DEPT", "EVNNPC");
        upsertOrg("BAN_VP",     "Ban Văn phòng",                                 "HQ_DEPT", "EVNNPC");
        upsertOrg("BAN_VT",     "Ban Vật tư",                                    "HQ_DEPT", "EVNNPC");
        upsertOrg("BAN_CNTT",   "Ban Công nghệ Thông tin và Chuyển đổi số",      "HQ_DEPT", "EVNNPC");

        // Loại Phòng chung của Công ty Điện lực (PC_DEPT) — khai báo 1 lần, dùng cho tất cả PC
        // orgCode phải TRÙNG với AppUser.deptCode của nhân viên PC
        upsertOrg("PHONG_KH",    "Phòng Kế hoạch",         "PC_DEPT", null);
        upsertOrg("PHONG_KT",    "Phòng Kỹ thuật",         "PC_DEPT", null);
        upsertOrg("PHONG_AT",    "Phòng An toàn",          "PC_DEPT", null);
        upsertOrg("PHONG_KTOAN", "Phòng Kế toán",          "PC_DEPT", null);
        upsertOrg("PHONG_KD",    "Phòng Kinh doanh",       "PC_DEPT", null);
        upsertOrg("PHONG_TCNS",  "Phòng Tổ chức Nhân sự",  "PC_DEPT", null);

        // Xóa row placeholder cũ 'PC_COMPANY' nếu còn sót
        organizationRepository.findByOrgCode("PC_COMPANY").ifPresent(organizationRepository::delete);

        log.info("Đã upsert cơ cấu tổ chức: 1 EVNNPC + 14 HQ_DEPT + 6 PC_DEPT");
    }

    private void upsertOrg(String orgCode, String orgName, String orgLevel, String parentOrgCode) {
        organizationRepository.findByOrgCode(orgCode).ifPresentOrElse(
            existing -> {
                existing.setOrgName(orgName);
                existing.setOrgLevel(orgLevel);
                existing.setParentOrgCode(parentOrgCode);
                existing.setActive(true);
                organizationRepository.save(existing);
            },
            () -> organizationRepository.save(Organization.builder()
                    .orgCode(orgCode).orgName(orgName)
                    .orgLevel(orgLevel).parentOrgCode(parentOrgCode)
                    .active(true).build())
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PC_COMPANY — 24 Công ty Điện lực trực thuộc EVNNPC
    // ══════════════════════════════════════════════════════════════════════════

    private void seedPcCompanies() {
        if (pcCompanyRepository.count() > 0) return;

        String[][] companies = {
                {"PCND",  "Công ty Điện lực Nam Định"},
                {"PCPT",  "Công ty Điện lực Phú Thọ"},
                {"PCQN",  "Công ty Điện lực Quảng Ninh"},
                {"PCTN",  "Công ty Điện lực Thái Nguyên"},
                {"PCBG",  "Công ty Điện lực Bắc Giang"},
                {"PCTH",  "Công ty Điện lực Thanh Hóa"},
                {"PCTB",  "Công ty Điện lực Thái Bình"},
                {"PCYB",  "Công ty Điện lực Yên Bái"},
                {"PCLS",  "Công ty Điện lực Lạng Sơn"},
                {"PCTQ",  "Công ty Điện lực Tuyên Quang"},
                {"PCNA",  "Công ty Điện lực Nghệ An"},
                {"PCCB",  "Công ty Điện lực Cao Bằng"},
                {"PCSL",  "Công ty Điện lực Sơn La"},
                {"PCHT",  "Công ty Điện lực Hà Tĩnh"},
                {"PCHB",  "Công ty Điện lực Hòa Bình"},
                {"PCLC",  "Công ty Điện lực Lào Cai"},
                {"PCDB",  "Công ty Điện lực Điện Biên"},
                {"PCHG",  "Công ty Điện lực Hà Giang"},
                {"PCBN",  "Công ty Điện lực Bắc Ninh"},
                {"PCHY",  "Công ty Điện lực Hưng Yên"},
                {"PCHN",  "Công ty Điện lực Hà Nam"},
                {"PCVP",  "Công ty Điện lực Vĩnh Phúc"},
                {"PCBK",  "Công ty Điện lực Bắc Kạn"},
                {"PCLCH", "Công ty Điện lực Lai Châu"},
        };
        for (String[] c : companies) {
            pcCompanyRepository.save(PcCompany.builder()
                    .companyCode(c[0]).companyName(c[1]).active(true).build());
        }
        log.info("Đã tạo {} Công ty Điện lực (PC_COMPANY)", companies.length);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // POSITIONS
    // ══════════════════════════════════════════════════════════════════════════

    private void seedPositions() {
        if (positionRepository.count() > 0) return;

        Object[][] positions = {
                // Cấp EVNNPC
                {"HDTV",              "Hội đồng thành viên",  1, "EVNNPC"},
                {"TGD",               "Tổng Giám đốc",        2, "EVNNPC"},
                {"PTGD",              "Phó Tổng Giám đốc",    3, "EVNNPC"},
                // Cấp Ban (HQ_DEPT)
                {"TRUONG_BAN",        "Trưởng ban",           4, "HQ_DEPT"},
                {"PHO_BAN",           "Phó ban",              5, "HQ_DEPT"},
                {"CHUYEN_VIEN_BAN",   "Chuyên viên Ban",      6, "HQ_DEPT"},
                // Cấp PC_COMPANY
                {"GD",                "Giám đốc",             7, "PC_COMPANY"},
                {"PGD",               "Phó Giám đốc",         8, "PC_COMPANY"},
                // Cấp Phòng (PC_DEPT)
                {"TRUONG_PHONG",      "Trưởng Phòng",         9, "PC_DEPT"},
                {"PHO_PHONG",         "Phó phòng",            10, "PC_DEPT"},
                {"CHUYEN_VIEN_PHONG", "Chuyên viên Phòng",    11, "PC_DEPT"},
        };

        for (Object[] p : positions) {
            positionRepository.save(Position.builder()
                    .positionCode((String) p[0])
                    .positionName((String) p[1])
                    .positionRank((Integer) p[2])
                    .orgLevelScope((String) p[3])
                    .active(true).build());
        }
        log.info("Đã tạo {} chức danh", positions.length);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // USERS
    // ══════════════════════════════════════════════════════════════════════════

    private void seedUsers() {
        AppRole editorRole = findOrCreateRole("EDITOR", "Biên tập viên", "");

        // ══════════════════════════════════════════════════════════════════════
        // EVNNPC — Lãnh đạo cấp cao (deptCode = null)
        // positionCode: HDTV, TGD, PTGD (orgLevelScope = EVNNPC)
        // ══════════════════════════════════════════════════════════════════════
        seedUser("hdtv",  "Lãnh đạo HĐTV",       "hdtv@evnnpc.vn",
                "EVNNPC", null, null, "HDTV",  Set.of(editorRole));
        seedUser("tgd",   "Tổng Giám đốc",       "tgd@evnnpc.vn",
                "EVNNPC", null, null, "TGD",   Set.of(editorRole));
        seedUser("ptgd",  "Phó Tổng Giám đốc",   "ptgd@evnnpc.vn",
                "EVNNPC", null, null, "PTGD",  Set.of(editorRole));

        // ══════════════════════════════════════════════════════════════════════
        // EVNNPC — Ban Kế hoạch (BAN_KH)
        // positionCode: TRUONG_BAN, PHO_BAN, CHUYEN_VIEN_BAN (orgLevelScope = HQ_DEPT)
        // ══════════════════════════════════════════════════════════════════════
        seedUser("tb_kh",  "Trưởng Ban KH",       "tb_kh@evnnpc.vn",
                "EVNNPC", null, "BAN_KH", "TRUONG_BAN",      Set.of(editorRole));
        seedUser("pb_kh",  "Phó Ban KH",          "pb_kh@evnnpc.vn",
                "EVNNPC", null, "BAN_KH", "PHO_BAN",         Set.of(editorRole));
        seedUser("cv_kh",  "Chuyên viên Ban KH",  "cv_kh@evnnpc.vn",
                "EVNNPC", null, "BAN_KH", "CHUYEN_VIEN_BAN", Set.of(editorRole));

        // ══════════════════════════════════════════════════════════════════════
        // EVNNPC — Ban Kỹ thuật (BAN_KT)
        // ══════════════════════════════════════════════════════════════════════
        seedUser("tb_kt",  "Trưởng Ban KT",       "tb_kt@evnnpc.vn",
                "EVNNPC", null, "BAN_KT", "TRUONG_BAN",      Set.of(editorRole));
        seedUser("pb_kt",  "Phó Ban KT",          "pb_kt@evnnpc.vn",
                "EVNNPC", null, "BAN_KT", "PHO_BAN",         Set.of(editorRole));
        seedUser("cv_kt",  "Chuyên viên Ban KT",  "cv_kt@evnnpc.vn",
                "EVNNPC", null, "BAN_KT", "CHUYEN_VIEN_BAN", Set.of(editorRole));

        // ══════════════════════════════════════════════════════════════════════
        // PC_COMPANY (PCBN) — Lãnh đạo (deptCode = null)
        // positionCode: GD, PGD (orgLevelScope = PC_COMPANY)
        // ══════════════════════════════════════════════════════════════════════
        seedUser("gd_pcbn",  "Giám đốc PCBN",       "gd@pcbn.evnnpc.vn",
                "PC_COMPANY", "PCBN", null, "GD",  Set.of(editorRole));
        seedUser("pgd_pcbn", "Phó GĐ PCBN",         "pgd@pcbn.evnnpc.vn",
                "PC_COMPANY", "PCBN", null, "PGD", Set.of(editorRole));

        // ══════════════════════════════════════════════════════════════════════
        // PC_COMPANY (PCBN) — Phòng Kế hoạch (PHONG_KH)
        // positionCode: TRUONG_PHONG, PHO_PHONG, CHUYEN_VIEN_PHONG (orgLevelScope = PC_DEPT)
        // ══════════════════════════════════════════════════════════════════════
        seedUser("tp_pcbn_kh",  "Trưởng Phòng KH PCBN",     "tp_kh@pcbn.evnnpc.vn",
                "PC_COMPANY", "PCBN", "PHONG_KH", "TRUONG_PHONG",      Set.of(editorRole));
        seedUser("pp_pcbn_kh",  "Phó Phòng KH PCBN",        "pp_kh@pcbn.evnnpc.vn",
                "PC_COMPANY", "PCBN", "PHONG_KH", "PHO_PHONG",         Set.of(editorRole));
        seedUser("cv_pcbn_kh",  "Chuyên viên Phòng KH PCBN", "cv_kh@pcbn.evnnpc.vn",
                "PC_COMPANY", "PCBN", "PHONG_KH", "CHUYEN_VIEN_PHONG", Set.of(editorRole));

        // ══════════════════════════════════════════════════════════════════════
        // PC_COMPANY (PCBN) — Phòng Kỹ thuật (PHONG_KT)
        // ══════════════════════════════════════════════════════════════════════
        seedUser("tp_pcbn_kt",  "Trưởng Phòng KT PCBN",     "tp_kt@pcbn.evnnpc.vn",
                "PC_COMPANY", "PCBN", "PHONG_KT", "TRUONG_PHONG",      Set.of(editorRole));
        seedUser("pp_pcbn_kt",  "Phó Phòng KT PCBN",        "pp_kt@pcbn.evnnpc.vn",
                "PC_COMPANY", "PCBN", "PHONG_KT", "PHO_PHONG",         Set.of(editorRole));
        seedUser("cv_pcbn_kt",  "Chuyên viên Phòng KT PCBN", "cv_kt@pcbn.evnnpc.vn",
                "PC_COMPANY", "PCBN", "PHONG_KT", "CHUYEN_VIEN_PHONG", Set.of(editorRole));

        log.info("Đã seed xong tài khoản người dùng mẫu");
    }

    private void seedUser(String username, String fullName, String email,
                          String orgGroupCode, String companyCode,
                          String deptCode, String positionCode,
                          Set<AppRole> roles) {
        if (appUserRepository.existsByUsername(username)) return;
        AppUser user = AppUser.builder()
                .username(username)
                .password(passwordEncoder.encode("123456"))
                .fullName(fullName)
                .email(email)
                .orgGroupCode(orgGroupCode)
                .companyCode(companyCode)
                .deptCode(deptCode)
                .positionCode(positionCode)
                .active(true)
                .roles(roles)
                .build();
        appUserRepository.save(user);
        log.info("  + {} — {}/{}/{} ({})", username, orgGroupCode,
                deptCode != null ? deptCode : "-", positionCode,
                companyCode != null ? companyCode : "TCT");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // WORKFLOW
    // ══════════════════════════════════════════════════════════════════════════

    private void seedSclWorkflow() {
        if (workflowDefinitionRepository.existsByWorkflowKey("scl-approval")) return;

        WorkflowDefinition def = workflowDefinitionRepository.save(WorkflowDefinition.builder()
                .workflowKey("scl-approval")
                .name("Quy trình SCL")
                .description("Quy trình phê duyệt sửa chữa lớn - 4 cấp duyệt")
                .status(WorkflowDefinitionStatus.DEPLOYED)
                .build());

        workflowStepRepository.saveAll(List.of(
                step(def.getId(), 1, "bkh",  "Ban Kế hoạch xét duyệt",   "APPROVE:1", "BKH_REVIEWED",  "SUBMITTER",     "Có phiên nhập liệu mới cần Ban Kế hoạch xét duyệt"),
                step(def.getId(), 2, "bkt",  "Ban Kỹ thuật thẩm tra",     "APPROVE:2", "BKT_VERIFIED",  "PREVIOUS_STEP", "Phiên nhập liệu đã qua Ban KH, Ban KT cần thẩm tra"),
                step(def.getId(), 3, "tgd",  "TGĐ/P.TGĐ phê duyệt",      "APPROVE:3", "TGD_APPROVED",  "SUBMITTER",     "Phiên nhập liệu cần TGĐ/P.TGĐ phê duyệt"),
                step(def.getId(), 4, "hdtv", "HĐTV phê duyệt",            "APPROVE:4", "HDTV_APPROVED", "PREVIOUS_STEP", "Phiên nhập liệu cần HĐTV phê duyệt")
        ));
        log.info("Đã tạo quy trình SCL (scl-approval) 4 bước");
    }

    private WorkflowStep step(Long defId, int order, String key, String name,
                               String actionKey, String statusAfter, String returnTarget, String msg) {
        return WorkflowStep.builder()
                .workflowDefinitionId(defId).stepOrder(order).stepKey(key)
                .stepName(name).candidateActionKey(actionKey)
                .statusAfterApprove(statusAfter).returnTarget(returnTarget)
                .notifyMessage(msg).build();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CATALOG
    // ══════════════════════════════════════════════════════════════════════════

    private void seedCatalogTypes() {
        if (masterCatalogTypeRepository.count() > 0) return;
        String[][] types = {
                {"CT_MTV",         "Các CT MTV",         "Các Công ty TNHH MTV",                "tuiIconBuilding"},
                {"DON_VI_PHU_TRO", "Các đơn vị phụ trợ", "Văn phòng cơ quan và đơn vị phụ trợ", "tuiIconUsers"},
                {"CT_DIEN_LUC",    "Các CT điện lực",    "Các Công ty Điện lực trực thuộc",      "tuiIconZap"},
                {"PRODUCT",        "Sản phẩm",           "Danh mục sản phẩm",                   "tuiIconBox"},
                {"REGION",         "Vùng miền",          "Danh mục vùng miền",                  "tuiIconMapPin"},
                {"CUSTOM",         "Tùy chỉnh",          "Danh mục tùy chỉnh",                  "tuiIconSettings"},
        };
        for (int i = 0; i < types.length; i++) {
            masterCatalogTypeRepository.save(MasterCatalogType.builder()
                    .type(types[i][0]).name(types[i][1]).description(types[i][2])
                    .icon(types[i][3]).sortOrder(i + 1).active(true).build());
        }
        log.info("Đã tạo {} loại danh mục", types.length);
    }

    private void seedCatalogItems() {
        if (masterCatalogRepository.count() > 0) return;

        String[][] ctMtv = {{"PCHP","Hải Phòng","1"},{"PCHD","Hải Dương","2"},{"PCNB","Ninh Bình","3"}};
        seedCatalogGroup(ctMtv, "CT_MTV");

        String[][] donViPhuTro = {
                {"NPC_VP","Văn phòng cơ quan","4"},{"NPCIT","Công ty CNTT Điện lực miền Bắc","5"},
                {"NPCCC","Trung tâm CSKH","6"},{"NPSC","NPSC","7"},{"PBTC","Phân bổ theo tiêu chí",null},
        };
        seedCatalogGroup(donViPhuTro, "DON_VI_PHU_TRO");

        String[][] ctDienLuc = {
                {"PCND","Công ty Điện lực Nam Định","8"},    {"PCPT","Công ty Điện lực Phú Thọ","9"},
                {"PCQN","Công ty Điện lực Quảng Ninh","10"}, {"PCTN","Công ty Điện lực Thái Nguyên","11"},
                {"PCBG","Công ty Điện lực Bắc Giang","12"},  {"PCTH","Công ty Điện lực Thanh Hóa","13"},
                {"PCTB","Công ty Điện lực Thái Bình","14"},  {"PCYB","Công ty Điện lực Yên Bái","15"},
                {"PCLS","Công ty Điện lực Lạng Sơn","16"},   {"PCTQ","Công ty Điện lực Tuyên Quang","17"},
                {"PCNA","Công ty Điện lực Nghệ An","18"},    {"PCCB","Công ty Điện lực Cao Bằng","19"},
                {"PCSL","Công ty Điện lực Sơn La","20"},     {"PCHT","Công ty Điện lực Hà Tĩnh","21"},
                {"PCHB","Công ty Điện lực Hòa Bình","22"},   {"PCLC","Công ty Điện lực Lào Cai","23"},
                {"PCDB","Công ty Điện lực Điện Biên","24"},  {"PCHG","Công ty Điện lực Hà Giang","25"},
                {"PCBN","Công ty Điện lực Bắc Ninh","26"},   {"PCHY","Công ty Điện lực Hưng Yên","27"},
                {"PCHN","Công ty Điện lực Hà Nam","28"},     {"PCVP","Công ty Điện lực Vĩnh Phúc","29"},
                {"PCBK","Công ty Điện lực Bắc Kạn","30"},    {"PCLCH","Công ty Điện lực Lai Châu","31"},
        };
        seedCatalogGroup(ctDienLuc, "CT_DIEN_LUC");

        log.info("Đã tạo {} catalog items", ctMtv.length + donViPhuTro.length + ctDienLuc.length);
    }

    private void seedCatalogGroup(String[][] items, String type) {
        for (int i = 0; i < items.length; i++) {
            masterCatalogRepository.save(MasterCatalog.builder()
                    .id(items[i][0]).name(items[i][1]).note(items[i][2])
                    .type(type).sortOrder(i + 1).active(true).build());
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // GRID TEMPLATE mẫu SCL
    // ══════════════════════════════════════════════════════════════════════════

    private void seedSclTemplate() {
        if (gridTemplateRepository.existsByCode("SCL")) return;
        gridTemplateRepository.save(GridTemplate.builder()
                .code("SCL")
                .name("Biểu mẫu Sửa chữa lớn (SCL)")
                .description("Biểu mẫu kế hoạch sửa chữa lớn toàn EVNNPC — do Ban Kế hoạch quản lý")
                .status(TemplateStatus.DRAFT)
                .ownerDeptCode("BAN_KH")
                .processDefinitionKey("scl-approval")
                .version(1)
                .build());
        log.info("Đã tạo GridTemplate mẫu: SCL");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // TEMPLATE_ACCESS — phân quyền mặc định cho template SCL
    //
    // Rule = (subjectOrgCode, subjectPositionCode) — cả hai nullable (wildcard).
    // Khớp với AppUser.deptCode và AppUser.positionCode.
    //
    // Ví dụ:
    //   (PHONG_KH, CHUYEN_VIEN_PHONG) + EDIT    → CV Phòng KH bất kỳ PC nhập liệu
    //   (BAN_KH,   CHUYEN_VIEN_BAN)   + APPROVE:1 → CV Ban KH EVNNPC duyệt bước 1
    //   (null,     TGD)               + APPROVE:3 → TGĐ phê duyệt
    //   (null,     null)              + VIEW       → tất cả user xem được
    // ══════════════════════════════════════════════════════════════════════════

    private void seedTemplateAccess() {
        gridTemplateRepository.findByCode("SCL").ifPresent(tpl -> {
            Long tid = tpl.getId();
            if (!templateAccessRepository.findByTemplateIdAndActiveTrue(tid).isEmpty()) return;

            List<TemplateAccess> rules = List.of(
                // ── VIEW — tất cả user xem được ─────────────────────────────
                ta(tid, "VIEW",     null,        null),

                // ── EDIT — CV / TP / PP Phòng KH của bất kỳ PC ─────────────
                ta(tid, "EDIT",     "PHONG_KH",  "CHUYEN_VIEN_PHONG"),
                ta(tid, "EDIT",     "PHONG_KH",  "TRUONG_PHONG"),
                ta(tid, "EDIT",     "PHONG_KH",  "PHO_PHONG"),

                // ── SUBMIT — Trưởng Phòng KH hoặc GĐ PC ────────────────────
                ta(tid, "SUBMIT",   "PHONG_KH",  "TRUONG_PHONG"),
                ta(tid, "SUBMIT",   null,         "GD"),

                // ── APPROVE:1 — Ban KH EVNNPC xét duyệt ─────────────────────
                ta(tid, "APPROVE:1","BAN_KH",    "CHUYEN_VIEN_BAN"),
                ta(tid, "APPROVE:1","BAN_KH",    "PHO_BAN"),
                ta(tid, "APPROVE:1","BAN_KH",    "TRUONG_BAN"),

                // ── APPROVE:2 — Ban KT EVNNPC thẩm tra ───────────────────────
                ta(tid, "APPROVE:2","BAN_KT",    "CHUYEN_VIEN_BAN"),
                ta(tid, "APPROVE:2","BAN_KT",    "PHO_BAN"),
                ta(tid, "APPROVE:2","BAN_KT",    "TRUONG_BAN"),

                // ── APPROVE:3 — TGĐ / P.TGĐ EVNNPC ──────────────────────────
                ta(tid, "APPROVE:3",null,         "TGD"),
                ta(tid, "APPROVE:3",null,         "PTGD"),

                // ── APPROVE:4 — HĐTV EVNNPC ───────────────────────────────────
                ta(tid, "APPROVE:4",null,         "HDTV")
            );
            templateAccessRepository.saveAll(rules);
            log.info("Đã seed {} rules TEMPLATE_ACCESS cho SCL (templateId={})", rules.size(), tid);
        });
    }

    private TemplateAccess ta(Long templateId, String actionKey, String orgCode, String positionCode) {
        return TemplateAccess.builder()
                .templateId(templateId)
                .actionKey(actionKey)
                .subjectOrgCode(orgCode)
                .subjectPositionCode(positionCode)
                .build();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // TEMPLATE_BUTTON
    // ══════════════════════════════════════════════════════════════════════════

    private void seedTemplateButtons() {
        gridTemplateRepository.findByCode("SCL").ifPresent(tpl -> {
            Long tid = tpl.getId();
            if (!templateButtonRepository.findByTemplateIdAndActiveTrueOrderBySortOrderAsc(tid).isEmpty()) return;

            List<TemplateButton> buttons = List.of(
                btn(tid, "VIEW",      "Xem",           "tuiIconEye",        1),
                btn(tid, "EDIT",      "Nhập liệu",     "tuiIconEdit",       2),
                btn(tid, "SUBMIT",    "Nộp duyệt",     "tuiIconUpload",     3),
                btn(tid, "APPROVE:1", "Xét duyệt BKH", "tuiIconCheck",      4),
                btn(tid, "APPROVE:2", "Thẩm tra BKT",  "tuiIconCheckSquare",5),
                btn(tid, "APPROVE:3", "Phê duyệt TGĐ", "tuiIconCheckCircle",6),
                btn(tid, "APPROVE:4", "Phê duyệt HĐTV","tuiIconStar",       7),
                btn(tid, "EXPORT",    "Xuất Excel",    "tuiIconDownload",   8)
            );
            templateButtonRepository.saveAll(buttons);
            log.info("Đã seed {} TEMPLATE_BUTTON cho SCL (templateId={})", buttons.size(), tid);
        });
    }

    private TemplateButton btn(Long templateId, String key, String label, String icon, int order) {
        return TemplateButton.builder()
                .templateId(templateId)
                .buttonKey(key).buttonLabel(label).buttonIcon(icon)
                .sortOrder(order).createdBy("SYSTEM").build();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Helpers
    // ══════════════════════════════════════════════════════════════════════════

    private AppRole findOrCreateRole(String code, String name, String description) {
        return appRoleRepository.findByRoleCode(code).orElseGet(() -> {
            AppRole role = AppRole.builder()
                    .roleCode(code).roleName(name).description(description).active(true).build();
            log.info("Đã tạo vai trò: {}", code);
            return appRoleRepository.save(role);
        });
    }
}
