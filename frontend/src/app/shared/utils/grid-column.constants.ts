/**
 * Hằng số kích thước cột dùng chung cho lưới cấu hình biểu mẫu động.
 * Shared giữa Excel Builder và Excel Render để Render thấy width đúng như Builder đã set.
 */

/** Width mặc định khi `ColumnConfig.width` chưa được cấu hình. */
export const DEFAULT_COLUMN_WIDTH = 150;

/** Width mặc định cho cột catalog — pinned-left, cần rộng hơn để hiển thị tên đơn vị dài. */
export const DEFAULT_CATALOG_COLUMN_WIDTH = 250;

/** Sàn minWidth — user có thể kéo co lại nhưng không nhỏ hơn giá trị này. */
export const COLUMN_MIN_WIDTH = 60;
