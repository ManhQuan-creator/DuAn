package org.example.oracleconnectionpool.model.request.templatebutton;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateTemplateButtonRequest {
    @NotBlank
    private String buttonLabel;
    private String buttonIcon;
    private Integer sortOrder;
    private String actionHandlerKey;
    private String visibleStatuses;
    private String disabledStatuses;
    /** URL template điều hướng sau khi nhấn nút. Hỗ trợ {templateId}, {entryId}, {$data.xxx}. */
    private String navigationUrl;
    /** Target điều hướng: "_self" hoặc "_blank". Null/rỗng = "_self". */
    private String navigationTarget;
}
