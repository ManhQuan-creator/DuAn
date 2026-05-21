package org.example.oracleconnectionpool.model.request.position;

import lombok.Data;

@Data
public class UpdatePositionRequest {
    private String positionName;
    private Integer positionRank;
    private String orgLevelScope;
    private Boolean active;
}
