package org.example.oracleconnectionpool.model.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class WorkflowDefinitionListResponse {
    private Long id;
    private String workflowKey;
    private String name;
    private String description;
    private String status;
    private Integer version;
    private Integer stepCount;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
