package org.example.oracleconnectionpool.model.request.organization;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateOrganizationRequest {
    @NotBlank
    @Size(max = 50)
    private String orgCode;

    @NotBlank
    @Size(max = 200)
    private String orgName;

    @Size(max = 50)
    private String parentOrgCode;

    @NotBlank
    @Size(max = 20)
    private String orgLevel;
}
