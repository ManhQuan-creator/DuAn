package org.example.oracleconnectionpool.model.request.appuser;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.example.oracleconnectionpool.model.base.PageAndOrderRequest;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class FilterAppUserRequest extends PageAndOrderRequest {
    private String keyword;
    private Boolean active;
}
