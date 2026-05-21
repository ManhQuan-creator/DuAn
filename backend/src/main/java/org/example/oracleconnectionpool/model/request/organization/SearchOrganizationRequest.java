package org.example.oracleconnectionpool.model.request.organization;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.oracleconnectionpool.model.base.PageAndOrderRequest;

@NoArgsConstructor
@Getter
@Setter
public class SearchOrganizationRequest extends PageAndOrderRequest {
    private String keyword;
    private Boolean active;
}
