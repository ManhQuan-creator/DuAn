package org.example.oracleconnectionpool.model.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class GridTemplateDetailResponse {
    private Long id;
    private String code;
    private String name;
    private String description;
    private String columnConfigs;
    private String columnGroups;
    private String status;
    private Integer version;
    private List<GridRowResponse> rows;
    private String processDefinitionKey;
    private List<String> reportDepartments;
    private List<String> reportFcGroups;
    private String periodType;
    private Boolean useDueDate;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
