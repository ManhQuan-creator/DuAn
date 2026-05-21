package org.example.oracleconnectionpool.model.request.sclcategory;

import lombok.*;
import org.example.oracleconnectionpool.model.base.PageAndOrderRequest;

@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class SclCategoryFilterDTO extends PageAndOrderRequest {
    private String unit;
    private String categoryCode;
    private String categoryName;
    private String yearPlan;
    private String progress;
    private String status;
    private String assetType;
    private String planType;
    private String registerType;
}
