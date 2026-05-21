package org.example.oracleconnectionpool.buttonaction;

/**
 * Interface cho logic xử lý khi user bấm nút chức năng trên biểu mẫu.
 *
 * <p>Mỗi @Component implement interface này sẽ tự động được đưa vào
 * {@link ButtonActionHandlerRegistry}. Button Key khai báo trong TEMPLATE_BUTTON
 * phải khớp với {@link #getKey()} của handler tương ứng.
 *
 * <p>Nếu không tìm thấy handler cho 1 buttonKey → trả về thông báo mặc định,
 * không gây lỗi. Developer chỉ cần tạo @Component mới để thêm logic cho nút mới.
 */
public interface ButtonActionHandler {

    /**
     * Key định danh handler — phải khớp với TEMPLATE_BUTTON.buttonKey.
     * Unique trong toàn classpath. Convention: UPPER_SNAKE_CASE.
     */
    String getKey();

    /** Tên hiển thị (tiếng Việt). */
    String getLabel();

    /** Mô tả ngắn. Có thể null. */
    default String getDescription() {
        return null;
    }

    /**
     * Thực thi logic. Trả về message hiển thị cho user (có thể null).
     * Ném RuntimeException nếu muốn abort + hiển thị lỗi.
     */
    ButtonActionResult handle(ButtonActionContext ctx);
}
