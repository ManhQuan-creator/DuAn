package org.example.oracleconnectionpool.model.request.templatebutton;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateTemplateButtonRequest {
    @NotNull
    private Long templateId;
    /** Phải trùng với TEMPLATE_PERMISSION.actionKey */
    @NotBlank
    private String buttonKey;
    @NotBlank
    private String buttonLabel;
    private String buttonIcon;
    private Integer sortOrder;
    /** Key của ButtonActionHandler — null nếu là nút mặc định (SAVE). */
    private String actionHandlerKey;
    /** CSV status được phép hiển thị, vd "DRAFT,RETURNED". Null = mọi status. */
    private String visibleStatuses;
    /** CSV status bị disable, vd "DISTRIBUTED". Null = không disable. */
    private String disabledStatuses;
    /** URL template điều hướng sau khi nhấn nút. Hỗ trợ {templateId}, {entryId}, {$data.xxx}. */
    private String navigationUrl;
    /** Target điều hướng: "_self" hoặc "_blank". Null/rỗng = "_self". */
    private String navigationTarget;
}
