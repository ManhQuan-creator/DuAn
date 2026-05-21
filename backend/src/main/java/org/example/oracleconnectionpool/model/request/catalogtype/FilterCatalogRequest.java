package org.example.oracleconnectionpool.model.request.catalogtype;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.example.oracleconnectionpool.model.base.PageAndOrderRequest;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class FilterCatalogRequest extends PageAndOrderRequest {
    private String type;
    private String keyword;
    private Boolean active;
}
