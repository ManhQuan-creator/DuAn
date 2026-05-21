-- =============================================
-- Dọn dẹp các cột cũ trong SIDEBAR_MENU
--   DEPT_CODES, POSITION_CODES: thay bằng PERMISSION_RULES (JSON) ở V4
--   ADMIN_ONLY: cờ phân quyền cũ, thay bằng ORG_GROUP_CODE + PERMISSION_RULES
-- Chạy thủ công trên DB sản phẩm vì JPA ddl-auto=update không tự drop column.
-- =============================================

ALTER TABLE SIDEBAR_MENU DROP COLUMN DEPT_CODES;
ALTER TABLE SIDEBAR_MENU DROP COLUMN POSITION_CODES;
ALTER TABLE SIDEBAR_MENU DROP COLUMN ADMIN_ONLY;

COMMIT;
