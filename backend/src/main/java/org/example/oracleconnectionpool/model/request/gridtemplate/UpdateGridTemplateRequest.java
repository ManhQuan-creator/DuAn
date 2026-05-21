package org.example.oracleconnectionpool.model.request.gridtemplate;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;
import lombok.Data;

import java.util.List;

import org.example.oracleconnectionpool.model.request.gridrow.GridRowRequest;

@Data
public class UpdateGridTemplateRequest {
    private String code;
    private String name;
    private String description;
    private String columnConfigs;       // JSON string
    private String columnGroups;        // JSON string
    private List<GridRowRequest> rows;
    private String processDefinitionKey;
    @JsonIgnore
    private boolean processDefinitionKeySpecified;
    private List<String> reportDepartments;
    private List<String> reportFcGroups;
    private String periodType;
    /** Null = không update; true/false = set tường minh. */
    private Boolean useDueDate;

    @JsonSetter("processDefinitionKey")
    public void setProcessDefinitionKey(String processDefinitionKey) {
        this.processDefinitionKey = processDefinitionKey;
        this.processDefinitionKeySpecified = true;
    }
}
