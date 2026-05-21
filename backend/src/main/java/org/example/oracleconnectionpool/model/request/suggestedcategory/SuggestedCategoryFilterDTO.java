package org.example.oracleconnectionpool.model.request.suggestedcategory;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.oracleconnectionpool.model.base.PageAndOrderRequest;

@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
public class SuggestedCategoryFilterDTO extends PageAndOrderRequest {
    private String unitName;
    private String categoryName;
    private String categoryCode;
    private String yearPlan;
    private String status;
}
