package org.example.oracleconnectionpool.model.request.sclassessment;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SclAssessmentRequestDTO {
    private Long id;
    private String unit;
    private String assetCode;
    private String assetName;
    private String assetType;
    private String status;
    private String year;
}
