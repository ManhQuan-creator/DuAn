package org.example.oracleconnectionpool.service;

import org.example.oracleconnectionpool.model.request.sclmark.FilterSclMarkRequest;
import org.example.oracleconnectionpool.model.request.sqlhistory.FilterSclHistoryRequest;
import org.example.oracleconnectionpool.model.response.sclmarkchi.SclMarkResponse;
import org.example.oracleconnectionpool.model.response.sqlhistory.SclHistoryResponse;
import org.springframework.data.domain.Page;

public interface SclMarkService {
    Page<SclMarkResponse> searchMark(FilterSclMarkRequest request);
}
