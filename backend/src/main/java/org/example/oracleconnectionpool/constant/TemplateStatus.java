package org.example.oracleconnectionpool.constant;

/**
 * Status hợp lệ cho {@code GRID_TEMPLATE.status}.
 *
 * <p>{@link #DRAFT} = đang xây dựng/chỉnh sửa, có thể clone hoặc xóa.
 * {@link #PUBLISHED} = đã publish, không cho phép sửa cấu trúc; entry mới được tạo từ
 * template ở trạng thái này.
 */
public final class TemplateStatus {

    public static final String DRAFT = "DRAFT";
    public static final String PUBLISHED = "PUBLISHED";

    private TemplateStatus() {}
}
