package org.example.oracleconnectionpool.model.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowTaskResponse {

    private String taskId;
    private String taskName;
    private String taskDefinitionKey;
    private String processInstanceId;
    private Long entryId;
    private Long templateId;
    private String orgCode;
    private String submittedBy;
    private String assignee;
    private LocalDateTime createdAt;
}
