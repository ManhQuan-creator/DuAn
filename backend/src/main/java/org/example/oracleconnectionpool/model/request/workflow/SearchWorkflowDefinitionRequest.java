package org.example.oracleconnectionpool.model.request.workflow;

import lombok.Data;

@Data
public class SearchWorkflowDefinitionRequest {

    private String keyword;

    private String status;

    private Integer pageNum = 0;

    private Integer pageSize = 20;
}

