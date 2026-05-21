package org.example.oracleconnectionpool.buttonaction;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Kết quả trả về sau khi handler xử lý xong.
 * Frontend dùng để hiển thị thông báo hoặc thực hiện hành động tiếp theo.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ButtonActionResult {
    /** success | info | warning | error */
    @Builder.Default
    private String status = "success";
    /** Message hiển thị cho user. */
    private String message;
    /**
     * Dữ liệu trả về (JSON) — handler tùy ý dùng.
     * Frontend có thể tham chiếu qua placeholder {@code {$data.xxx}} trong URL điều hướng của nút.
     */
    private Object data;
    /**
     * URL điều hướng do handler chỉ định (override URL template của nút).
     * Chỉ áp dụng khi status = "success". Frontend sẽ navigate tới URL này nếu có.
     */
    private String redirectUrl;

    public static ButtonActionResult success(String message) {
        return ButtonActionResult.builder().status("success").message(message).build();
    }

    public static ButtonActionResult info(String message) {
        return ButtonActionResult.builder().status("info").message(message).build();
    }

    public static ButtonActionResult warning(String message) {
        return ButtonActionResult.builder().status("warning").message(message).build();
    }

    public static ButtonActionResult error(String message) {
        return ButtonActionResult.builder().status("error").message(message).build();
    }

    /** Gắn payload dữ liệu (dùng cho placeholder {$data.xxx} trong URL template của nút). */
    public ButtonActionResult withData(Object data) {
        this.data = data;
        return this;
    }

    /** Chỉ định URL điều hướng override (ưu tiên hơn URL template của nút). */
    public ButtonActionResult withRedirect(String url) {
        this.redirectUrl = url;
        return this;
    }
}
