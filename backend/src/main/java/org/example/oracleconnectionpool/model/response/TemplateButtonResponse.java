package org.example.oracleconnectionpool.model.response;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TemplateButtonResponse {
    private Long id;
    private Long templateId;
    private String buttonKey;
    private String buttonLabel;
    private String buttonIcon;
    private Integer sortOrder;
    /** Key của handler xử lý logic — null = nút mặc định (SAVE). */
    private String actionHandlerKey;
    /** CSV status được phép hiển thị, vd "DRAFT,RETURNED". Null = mọi status. */
    private String visibleStatuses;
    /** CSV status bị disable, vd "DISTRIBUTED". Null = không disable. */
    private String disabledStatuses;
    /** URL template điều hướng. Hỗ trợ {templateId}, {entryId}, {$data.xxx}. Null = không điều hướng. */
    private String navigationUrl;
    /** "_self" (cùng tab) hoặc "_blank" (tab mới). Null = "_self". */
    private String navigationTarget;
    private Boolean active;
    /** true nếu user hiện tại có quyền sử dụng nút này (populated theo context) */
    private Boolean allowed;
}
