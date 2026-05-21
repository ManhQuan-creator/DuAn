package org.example.oracleconnectionpool.model.request.gridtemplate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

import org.example.oracleconnectionpool.model.request.gridrow.GridRowRequest;

@Data
public class CreateGridTemplateRequest {
    @NotBlank
    private String code;
    @NotBlank
    private String name;
    private String description;
    @NotNull
    private String columnConfigs;       // JSON string
    private String columnGroups;        // JSON string
    private List<GridRowRequest> rows;
    private String processDefinitionKey;
    private List<String> reportDepartments;
    private List<String> reportFcGroups;
    /** Kỳ báo cáo: YEAR | HALF_YEAR | QUARTER | MONTH. Default = MONTH. */
    private String periodType;
    /** Bật/tắt tính năng "Hạn xử lý" cho mọi entry của template. Null/false = tắt. */
    private Boolean useDueDate;
}
