-- =============================================
-- SIDEBAR_MENU: Quản lý menu sidebar động
-- Cây menu 2 cấp (section -> child) hoặc nhiều cấp tuỳ ý.
-- PARENT_ID = NULL → menu cha (section); ngược lại → menu con
-- =============================================

CREATE TABLE SIDEBAR_MENU (
    ID            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    PARENT_ID     NUMBER,
    MENU_KEY      VARCHAR2(100) NOT NULL,
    LABEL         NVARCHAR2(255) NOT NULL,
    PATH          VARCHAR2(500),
    ICON          VARCHAR2(100),
    SORT_ORDER    NUMBER(10)    DEFAULT 0 NOT NULL,
    ADMIN_ONLY    NUMBER(1)     DEFAULT 0 NOT NULL,
    ACTIVE        NUMBER(1)     DEFAULT 1 NOT NULL,
    CREATED_AT    TIMESTAMP     DEFAULT SYSTIMESTAMP,
    UPDATED_AT    TIMESTAMP     DEFAULT SYSTIMESTAMP,
    CONSTRAINT FK_SIDEBAR_MENU_PARENT FOREIGN KEY (PARENT_ID)
        REFERENCES SIDEBAR_MENU(ID)
);

CREATE INDEX IDX_SIDEBAR_MENU_PARENT ON SIDEBAR_MENU(PARENT_ID);
CREATE INDEX IDX_SIDEBAR_MENU_SORT   ON SIDEBAR_MENU(SORT_ORDER);
CREATE UNIQUE INDEX UQ_SIDEBAR_MENU_KEY ON SIDEBAR_MENU(MENU_KEY);

-- =============================================
-- Seed data: chỉ các section ĐỘNG (sau QL_CHI_TIEU).
-- Các section trước QL_CHI_TIEU vẫn fix cứng trong sidebar.component.ts
-- =============================================

-- 1. QL_CHI_TIEU
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('QL_CHI_TIEU', N'Quản lý chỉ tiêu', NULL, NULL, 100, NULL);

INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('QL_CHI_TIEU__SCL', N'Quản lý chỉ tiêu SCL', '/report/quan-ly-chi-tieu-scl', 'tuiIconTagLarge', 1,
        (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'QL_CHI_TIEU'));

-- 2. SCL
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('SCL', N'Quy trình SCL', NULL, NULL, 200, NULL);

INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('SCL__LAP_KH_TT', N'Lập kế hoạch tạm tính', '/report/lap-ke-hoach-tam-tinh', 'tuiIconEditLarge', 1,
        (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'SCL'));
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('SCL__GIAO_KH_TT', N'Giao kế hoạch tạm tính', '/report/giao-ke-hoach-tam-tinh', 'tuiIconSendLarge', 2,
        (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'SCL'));
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('SCL__DV_LAP_KH', N'Đơn vị lập kế hoạch', '/report/don-vi-lap-ke-hoach', 'tuiIconToolLarge', 3,
        (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'SCL'));
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('SCL__TH_KH_TUNG_DV', N'Tổng hợp kế hoạch từng đơn vị', '/report/tong-hop-ke-hoach-danh-muc-tung-don-vi', 'tuiIconListLarge', 4,
        (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'SCL'));
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('SCL__TH_KH_TAT_CA_DV', N'Tổng hợp kế hoạch tất cả đơn vị', '/report/tong-hop-ke-hoach-tat-ca-don-vi', 'tuiIconLayersLarge', 5,
        (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'SCL'));
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('SCL__GIAO_KH_CT', N'Giao kế hoạch chính thức', '/report/giao-ke-hoach-chinh-thuc', 'tuiIconFlagLarge', 6,
        (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'SCL'));
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('SCL__BC_TD_DV', N'Báo cáo tiến độ thực hiện kế hoạch theo tháng của đơn vị', '/report/bao-cao-tien-do-thuc-hien-tung-don-vi', 'tuiIconTrendingUpLarge', 7,
        (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'SCL'));
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('SCL__BC_TD_TCT', N'Báo cáo tiến độ thực hiện kế hoạch theo tháng của TCT', '/report/bao-cao-tien-do-thuc-hien-toan-cty', 'tuiIconBarChart2Large', 8,
        (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'SCL'));
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('SCL__BC_TD_6T_TD', N'Báo cáo tiến độ thực hiện 6 tháng cho tập đoàn', '/report/bao-cao-tien-do-gui-tap-doan', 'tuiIconPieChartLarge', 9,
        (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'SCL'));

-- 3. DTXD_110KV
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('DTXD_110KV', N'Quy trình DTXD 110kV', NULL, NULL, 300, NULL);

INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('DTXD_110KV__LAP_PA', N'Lập phương án đầu tư xây dựng', '/report/lap-phuong-an-dau-tu-xay-dung', 'tuiIconEditLarge', 1,
        (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'DTXD_110KV'));
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('DTXD_110KV__TH_KH', N'Tổng hợp kế hoạch đầu tư xây dựng', '/report/tong-hop-ke-hoach-dau-tu-xay-dung', 'tuiIconListLarge', 2,
        (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'DTXD_110KV'));
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('DTXD_110KV__GIAO_DM_KH', N'Giao danh mục và kế hoạch', '/report/giao-danh-muc-va-ke-hoach', 'tuiIconSendLarge', 3,
        (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'DTXD_110KV'));
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('DTXD_110KV__DK_KH', N'Đăng ký kế hoạch đầu tư xây dựng', '/report/dang-ky-ke-hoach-dau-tu-xay-dung', 'tuiIconFlagLarge', 4,
        (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'DTXD_110KV'));
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('DTXD_110KV__GIAO_KH_CT', N'Giao kế hoạch chính thức cho các đơn vị', '/report/giao-ke-hoach-chinh-thuc-cho-cac-don-vi', 'tuiIconFlagLarge', 5,
        (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'DTXD_110KV'));
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('DTXD_110KV__TH_TH_DG', N'Tổng hợp thực hiện và đánh giá', '/report/tong-hop-thuc-hien-va-danh-gia', 'tuiIconTrendingUpLarge', 6,
        (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'DTXD_110KV'));

-- 4. DTXD_THT_KHAC
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('DTXD_THT_KHAC', N'Quy trình DTXD THT khác', NULL, NULL, 400, NULL);

-- 5. SXKD
INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID)
VALUES ('SXKD', N'Quy trình SXKD', NULL, NULL, 500, NULL);

COMMIT;
