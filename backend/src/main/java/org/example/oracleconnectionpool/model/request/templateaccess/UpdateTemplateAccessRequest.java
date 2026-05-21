package org.example.oracleconnectionpool.model.request.templateaccess;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateTemplateAccessRequest {

    @NotBlank
    private String actionKey;

    private String subjectOrgCode;

    private String subjectPositionCode;
}
