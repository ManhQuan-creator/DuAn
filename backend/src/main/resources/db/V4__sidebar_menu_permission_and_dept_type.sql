-- =============================================
-- 1. DEPT_TYPE: Loại ban/phòng (đã tồn tại trong DB sản phẩm — script ở đây
--    chỉ dùng cho môi trường mới hoặc tham chiếu).
-- =============================================
CREATE TABLE DEPT_TYPE (
    DEPT_TYPE_CODE   VARCHAR2(50)  PRIMARY KEY,
    DEPT_TYPE_NAME   NVARCHAR2(200) NOT NULL,
    ORG_LEVEL_SCOPE  VARCHAR2(20)  NOT NULL,   -- HQ_DEPT | PC_DEPT
    SORT_ORDER       NUMBER(10)    DEFAULT 0 NOT NULL,
    ACTIVE           NUMBER(1)     DEFAULT 1 NOT NULL
);

CREATE INDEX IDX_DEPT_TYPE_SCOPE ON DEPT_TYPE(ORG_LEVEL_SCOPE);

-- Seed data tham khảo (HQ_DEPT)
INSERT INTO DEPT_TYPE (DEPT_TYPE_CODE, DEPT_TYPE_NAME, ORG_LEVEL_SCOPE, SORT_ORDER, ACTIVE)
VALUES ('BAN_KH', N'Ban Kế hoạch', 'HQ_DEPT', 10, 1);
INSERT INTO DEPT_TYPE (DEPT_TYPE_CODE, DEPT_TYPE_NAME, ORG_LEVEL_SCOPE, SORT_ORDER, ACTIVE)
VALUES ('BAN_KT', N'Ban Kỹ thuật', 'HQ_DEPT', 11, 1);
-- ... (xem dữ liệu hiện có trong DB sản phẩm)

-- =============================================
-- 2. SIDEBAR_MENU: bổ sung phân quyền theo nhóm tổ chức / ban-phòng / chức danh
-- =============================================
ALTER TABLE SIDEBAR_MENU ADD (
    ORG_GROUP_CODE  VARCHAR2(20),
    DEPT_CODES      VARCHAR2(2000),
    POSITION_CODES  VARCHAR2(2000)
);

CREATE INDEX IDX_SIDEBAR_MENU_ORG_GROUP ON SIDEBAR_MENU(ORG_GROUP_CODE);

-- ADMIN_ONLY giữ nguyên (NOT NULL DEFAULT 0) để tương thích ngược.
-- Code mới không sử dụng cột này; mọi rule phân quyền chuyển sang 3 cột mới ở trên.

COMMIT;
