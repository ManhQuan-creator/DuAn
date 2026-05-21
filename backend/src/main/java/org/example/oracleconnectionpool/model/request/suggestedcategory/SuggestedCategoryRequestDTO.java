package org.example.oracleconnectionpool.model.request.suggestedcategory;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
public class SuggestedCategoryRequestDTO {
    private Long id;
    private String unitName;
    private String categoryName;
    private String categoryCode;
    private String yearPlan;
    private String estimatedValue;
    private String status;
}
