package org.example.oracleconnectionpool.model.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class XmlValidateResponse {
    private boolean valid;
    private String message;
}

