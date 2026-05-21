package org.example.oracleconnectionpool.model.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class GridRowResponse {
    private Long id;
    private String rowCode;
    private String rowName;
    private String rowData;
    private String cellConfig;
    private Boolean isTypeHeader;
    private String catalogField;
    private Integer sortOrder;
}
