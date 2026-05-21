package org.example.oracleconnectionpool.workflow.action;

/**
 * Interface cho logic phụ (extension) khi user phê duyệt/trả lại/từ chối một bước workflow.
 *
 * <p>Mỗi @Component implement interface này sẽ tự động được Spring đưa vào
 * {@link WorkflowActionHandlerRegistry}. Admin chọn {@link #getKey()} cho từng bước
 * qua UI workflow-manager; runtime dispatcher sẽ gọi {@link #handle(WorkflowActionContext)}
 * trước khi Camunda complete task.
 *
 * <p>Lưu ý: handler chạy trong cùng @Transactional của WorkflowService.completeTask.
 * Nếu throw RuntimeException → rollback Camunda + cả logic phụ → task không complete.
 */
public interface WorkflowActionHandler {

    /**
     * Key định danh handler — dùng làm giá trị lưu trong WorkflowStep.onXxxHandlerKey.
     * Phải unique trong toàn bộ classpath. Nên theo convention UPPER_SNAKE_CASE.
     */
    String getKey();

    /** Tên hiển thị trên UI (tiếng Việt). */
    String getLabel();

    /** Mô tả ngắn để BA hiểu handler làm gì. Có thể null. */
    default String getDescription() {
        return null;
    }

    /**
     * Thực thi logic. Ném RuntimeException nếu muốn abort toàn bộ action (rollback + trả lỗi).
     *
     * <p>Trả {@link WorkflowActionResult} nếu muốn truyền tín hiệu (vd URL điều hướng) về frontend,
     * hoặc trả {@code null} nếu không có gì cần báo (FE sẽ giữ behavior hiện tại: refresh list/entry).
     */
    WorkflowActionResult handle(WorkflowActionContext ctx);
}
