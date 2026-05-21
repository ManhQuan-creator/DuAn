package org.example.oracleconnectionpool.model.request.gridrow;

import lombok.Data;

@Data
public class GridRowRequest {
    private String rowCode;
    private String rowName;
    private String rowData;         // JSON string
    private String cellConfig;      // JSON string
    private Boolean isTypeHeader;
    private String catalogField;
    private Integer sortOrder;
}
