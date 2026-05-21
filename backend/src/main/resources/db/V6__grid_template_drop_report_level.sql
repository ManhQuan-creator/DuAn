-- =============================================
-- Dọn dẹp cột không còn sử dụng trong GRID_TEMPLATE.
--   REPORT_LEVEL: cột "Đơn vị lập báo cáo" đã được bỏ khỏi form Cấu hình nâng cao,
--                 không còn xuất hiện trong entity/DTO/service sau refactor.
-- Chạy thủ công trên DB sản phẩm vì JPA ddl-auto=update không tự drop column.
-- Thứ tự: deploy code mới TRƯỚC (Hibernate không còn map cột này) rồi mới chạy SQL.
-- =============================================

ALTER TABLE GRID_TEMPLATE DROP COLUMN REPORT_LEVEL;

COMMIT;
