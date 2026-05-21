package org.example.oracleconnectionpool.model.request.sclassessment;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class SclAssessmentProjection {
    private Long id;
    private String status;
    private String assessmentDeptCode;
    private String assessmentDeptName;
}
