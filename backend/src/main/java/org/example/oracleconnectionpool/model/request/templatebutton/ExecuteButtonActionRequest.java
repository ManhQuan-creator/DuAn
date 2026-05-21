package org.example.oracleconnectionpool.model.request.templatebutton;

import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ExecuteButtonActionRequest {
    @NotNull
    private Long templateId;
    /** Có thể null nếu chưa tạo entry (vd: nút tạo mới). */
    private Long entryId;
    @NotBlank
    private String buttonKey;
    /** Dữ liệu dòng từ grid (JSON string) — optional. */
    private String rowData;
    /** Payload tùy ý — handler custom quyết định format. */
    private String payload;
    /** Tham số runtime do user nhập (vd: dueDate). Null/empty → handler nhận empty map. */
    private Map<String, Object> params;
}
