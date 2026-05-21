package org.example.oracleconnectionpool.model.request.gridtemplate;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class BatchLookupRequest {
    @NotEmpty
    @Size(max = 10)
    @Valid
    private List<LookupRequest> requests;
}
