-- =============================================
-- Thêm cột DUE_DATE vào GRID_DATA_ENTRY — hạn xử lý của phiên nhập liệu.
--   Người tạo phiên set khi tạo entry. NSD nhập liệu thấy badge ở header
--   excel-render với màu cảnh báo theo còn bao nhiêu ngày tới hạn.
-- Lưu ý: JPA ddl-auto=update sẽ tự tạo cột này — script này chỉ để doc/prod.
-- =============================================

ALTER TABLE GRID_DATA_ENTRY ADD DUE_DATE TIMESTAMP;

COMMIT;
