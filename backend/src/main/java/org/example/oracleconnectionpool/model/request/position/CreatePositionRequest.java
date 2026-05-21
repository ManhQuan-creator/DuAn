package org.example.oracleconnectionpool.model.request.position;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreatePositionRequest {
    @NotBlank
    private String positionCode;
    @NotBlank
    private String positionName;
    @NotNull
    private Integer positionRank;
    @NotBlank
    private String orgLevelScope;
}
