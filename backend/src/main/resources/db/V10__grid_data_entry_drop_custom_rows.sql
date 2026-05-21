-- =============================================
-- V10 — Drop column GRID_DATA_ENTRY.CUSTOM_ROWS sau khi đã merge data vào ROW_DATA.
--
-- PRE-REQ: phải chạy SAU khi Spring app khởi động ít nhất 1 lần với BE mới có
--   `CustomRowsMergeMigrationRunner` (chạy auto ở `ApplicationRunner`). Runner
--   sẽ scan tất cả entry có CUSTOM_ROWS non-null, merge JSON vào ROW_DATA với
--   flag `_isCustomRow=true` ở mỗi RX row, rồi UPDATE customRows=NULL.
--
-- VERIFY trước khi drop:
--   SELECT COUNT(*) FROM GRID_DATA_ENTRY
--    WHERE CUSTOM_ROWS IS NOT NULL AND DBMS_LOB.GETLENGTH(CUSTOM_ROWS) > 2;
--   -- Phải = 0. Nếu > 0 → check log app cho các entry skip do corrupt JSON.
--
-- BACKUP RECOMMEND: tạo bảng backup trước khi drop để rollback dễ:
--   CREATE TABLE GRID_DATA_ENTRY_BACKUP_V10 AS
--     SELECT ID, ROW_DATA, CUSTOM_ROWS FROM GRID_DATA_ENTRY;
--
-- Lưu ý: JPA ddl-auto=update KHÔNG tự drop column khi field bị xóa khỏi entity.
-- Phải chạy manual script này.
-- =============================================

ALTER TABLE GRID_DATA_ENTRY DROP COLUMN CUSTOM_ROWS;

COMMIT;
