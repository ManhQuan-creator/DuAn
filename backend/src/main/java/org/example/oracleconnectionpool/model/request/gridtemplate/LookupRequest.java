package org.example.oracleconnectionpool.model.request.gridtemplate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class LookupRequest {
    @NotBlank
    private String templateCode;

    @NotNull
    private Integer year;

    private Integer month;

    private String orgCode;

    private String rowCode;

    @NotEmpty
    private List<String> columns;
}
