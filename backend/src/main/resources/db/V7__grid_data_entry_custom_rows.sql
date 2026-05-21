-- =============================================
-- Thêm cột CUSTOM_ROWS vào GRID_DATA_ENTRY — hỗ trợ dòng động per-entry (Option A).
--   Cấu trúc JSON:
--     [{"rowCode":"RX1","rowName":"RX1","afterRowCode":"R3","sortOrder":0}, ...]
--   afterRowCode: row_code của template row (hoặc customRow khác) mà dòng mới
--                 chèn ngay sau đó. Nếu afterRowCode không còn tồn tại
--                 (template đổi), FE fallback đặt dòng ở cuối grid.
-- Lưu ý: JPA ddl-auto=update sẽ tự tạo cột này — script này chỉ để doc/prod.
-- =============================================

ALTER TABLE GRID_DATA_ENTRY ADD CUSTOM_ROWS CLOB;

COMMIT;
