package org.example.oracleconnectionpool.model.request.sclmark;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.example.oracleconnectionpool.model.base.PageAndOrderRequest;

@Data
@EqualsAndHashCode(callSuper = true)
@AllArgsConstructor
@NoArgsConstructor
public class FilterSclMarkRequest extends PageAndOrderRequest {
    private Long sclCategoryId;
}
