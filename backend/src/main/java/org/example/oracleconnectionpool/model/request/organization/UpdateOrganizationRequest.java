package org.example.oracleconnectionpool.model.request.organization;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateOrganizationRequest {
    @Size(max = 200)
    private String orgName;

    @Size(max = 50)
    private String parentOrgCode;

    @Size(max = 20)
    private String orgLevel;

    private Boolean active;
}
