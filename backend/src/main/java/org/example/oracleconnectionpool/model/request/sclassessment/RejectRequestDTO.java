package org.example.oracleconnectionpool.model.request.sclassessment;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class RejectRequestDTO {
    private Long id;
    private String reason;
}
