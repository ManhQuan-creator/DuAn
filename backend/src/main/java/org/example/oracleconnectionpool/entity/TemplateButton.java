package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Khai báo danh sách nút chức năng cho từng biểu mẫu.
 *
 * buttonKey phải trùng với TEMPLATE_PERMISSION.actionKey để phân quyền.
 * Ví dụ: "VIEW", "EDIT", "SUBMIT", "APPROVE:1", "APPROVE:2", "EXPORT"...
 */
@Entity
@Table(name = "TEMPLATE_BUTTON", indexes = {
        @Index(name = "IDX_BTN_TEMPLATE", columnList = "TEMPLATE_ID")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TemplateButton {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "TEMPLATE_ID", nullable = false)
    private Long templateId;

    /** Key nút — trùng với TEMPLATE_PERMISSION.actionKey */
    @Column(name = "BUTTON_KEY", nullable = false, length = 50)
    private String buttonKey;

    /** Nhãn hiển thị trên UI */
    @Column(name = "BUTTON_LABEL", nullable = false, length = 100)
    private String buttonLabel;

    /** Icon Taiga (tùy chọn) */
    @Column(name = "BUTTON_ICON", length = 100)
    private String buttonIcon;

    /**
     * Key của ButtonActionHandler để xử lý khi user bấm nút.
     * Null = nút mặc định (SAVE) hoặc chưa gán logic.
     * Giá trị phải khớp với ButtonActionHandler.getKey() đã đăng ký.
     */
    @Column(name = "ACTION_HANDLER_KEY", length = 100)
    private String actionHandlerKey;

    /**
     * Danh sách entry status mà nút được phép HIỂN THỊ — CSV, vd: "DRAFT,RETURNED".
     * Null/rỗng = hiển thị ở mọi status. Check case-insensitive.
     */
    @Column(name = "VISIBLE_STATUSES", length = 200)
    private String visibleStatuses;

    /**
     * Danh sách entry status mà nút bị DISABLE (vẫn hiển thị nhưng không bấm được) — CSV.
     * Null/rỗng = không disable. Ưu tiên sau visibleStatuses: nếu không visible thì không xét disable.
     */
    @Column(name = "DISABLED_STATUSES", length = 200)
    private String disabledStatuses;

    /**
     * URL template điều hướng sau khi nhấn nút. Null/rỗng = không điều hướng.
     * Hỗ trợ placeholder:
     *   - {templateId}, {entryId}, {row_code} — từ context hiện tại của frontend
     *   - {$data.xxx} — từ ButtonActionResult.data do handler trả về
     * Nếu có actionHandlerKey: chỉ điều hướng khi handler trả status = success.
     */
    @Column(name = "NAVIGATION_URL", length = 500)
    private String navigationUrl;

    /** Target điều hướng: "_self" (cùng tab, mặc định) hoặc "_blank" (tab mới). */
    @Column(name = "NAVIGATION_TARGET", length = 20)
    private String navigationTarget;

    /** Thứ tự hiển thị */
    @Column(name = "SORT_ORDER")
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "ACTIVE", nullable = false)
    @Builder.Default
    private Boolean active = true;

    @Column(name = "CREATED_BY", length = 50)
    private String createdBy;

    @Column(name = "CREATED_AT")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
