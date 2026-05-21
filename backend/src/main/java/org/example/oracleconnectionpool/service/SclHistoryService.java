package org.example.oracleconnectionpool.service;

import org.example.oracleconnectionpool.model.request.sqlhistory.FilterSclHistoryRequest;
import org.example.oracleconnectionpool.model.response.sqlhistory.SclHistoryResponse;
import org.springframework.data.domain.Page;

public interface SclHistoryService {
    Page<SclHistoryResponse> searchHistory(FilterSclHistoryRequest request);
}
