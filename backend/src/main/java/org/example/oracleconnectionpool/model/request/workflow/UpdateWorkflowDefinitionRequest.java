package org.example.oracleconnectionpool.model.request.workflow;

import jakarta.validation.Valid;
import lombok.Data;

import java.util.List;

@Data
public class UpdateWorkflowDefinitionRequest {
    private String name;
    private String description;
    private String bpmnXml;
    @Valid
    private List<WorkflowStepRequest> steps;

    private List<WorkflowStepRequest.StepCandidateRequest> submitterCandidates;
}
