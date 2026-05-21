package org.example.oracleconnectionpool.model.base;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(
        ignoreUnknown = true
)
public class QueryRequest extends PageAndOrderRequest {
}
