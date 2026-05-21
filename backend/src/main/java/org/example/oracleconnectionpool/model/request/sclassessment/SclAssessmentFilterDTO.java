package org.example.oracleconnectionpool.model.request.sclassessment;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.oracleconnectionpool.model.base.PageAndOrderRequest;

@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
public class SclAssessmentFilterDTO extends PageAndOrderRequest {
    private String unit;
    private String categoryCode;
    private String categoryName;
    private String yearPlan;
    private String progress;
    private String status;
    private String statusAssessment;
    private String assetType;
    private String planType;
    private String registerType;

    private Long categoryId;
    private String assessmentDeptCode;
}
