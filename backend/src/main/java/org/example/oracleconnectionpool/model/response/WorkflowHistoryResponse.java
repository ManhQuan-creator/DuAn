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
public class WorkflowHistoryResponse {

    private String activityName;
    private String assignee;
    private String action;
    private String comment;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Long durationMs;
}
