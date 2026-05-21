package org.example.oracleconnectionpool.model.request.gridtemplate;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.example.oracleconnectionpool.model.base.PageAndOrderRequest;

@Data
@EqualsAndHashCode(callSuper = true)
@AllArgsConstructor
@NoArgsConstructor
public class FilterGridTemplateRequest extends PageAndOrderRequest {
    private String keyword;
    private String status;
}
