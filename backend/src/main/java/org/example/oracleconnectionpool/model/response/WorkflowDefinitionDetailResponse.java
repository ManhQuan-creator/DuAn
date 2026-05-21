package org.example.oracleconnectionpool.model.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class WorkflowDefinitionDetailResponse {
    private Long id;
    private String workflowKey;
    private String name;
    private String description;
    private String status;
    private Integer version;
    private String deploymentId;
    private String bpmnXml;
    private List<WorkflowStepResponse> steps;
    /** Ai được gửi duyệt (SUBMIT) */
    private List<WorkflowStepResponse.StepCandidateResponse> submitterCandidates;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
