package org.example.oracleconnectionpool.model.request.workflow;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class CreateWorkflowDefinitionRequest {
    @NotBlank
    private String workflowKey;
    @NotBlank
    private String name;
    private String description;
    @NotNull
    @Valid
    private List<WorkflowStepRequest> steps;

    /** Ai được gửi duyệt (SUBMIT) — dùng chung SubmitterCandidateRequest */
    private List<WorkflowStepRequest.StepCandidateRequest> submitterCandidates;
}
