package org.example.oracleconnectionpool.model.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class WorkflowActionHandlerResponse {
    private String key;
    private String label;
    private String description;
}
