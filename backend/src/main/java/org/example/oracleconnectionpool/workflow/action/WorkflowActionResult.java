package org.example.oracleconnectionpool.workflow.action;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Kết quả trả về sau khi workflow handler xử lý xong.
 *
 * <p>Được propagate qua {@code WorkflowActionDispatcher} → {@code WorkflowService.completeTask}
 * → controller → frontend. Frontend dùng {@link #redirectUrl} để điều hướng người dùng
 * tới trang liên quan (vd: entry mới được handler tạo ra).
 *
 * <p>Trả {@code null} từ {@code handle()} = không có tín hiệu gì cho FE (hành vi cũ).
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowActionResult {
    /** URL điều hướng sau khi task complete thành công. Null = không điều hướng. */
    private String redirectUrl;
    /** Dữ liệu tuỳ ý handler muốn trả về (để mở rộng sau). Null nếu không dùng. */
    private Object data;

    /** Shortcut tạo result chỉ với redirectUrl. */
    public static WorkflowActionResult redirect(String url) {
        return WorkflowActionResult.builder().redirectUrl(url).build();
    }
}
