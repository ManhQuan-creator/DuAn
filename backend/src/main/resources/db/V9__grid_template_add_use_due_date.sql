-- Per-template flag bật tính năng "Hạn xử lý" (due_date) cho entries.
-- 0 = tắt (default — backward compat); 1 = bật (form tạo entry hiển thị input,
-- render entry hiện badge due_date).
ALTER TABLE GRID_TEMPLATE ADD USE_DUE_DATE NUMBER(1) DEFAULT 0;
