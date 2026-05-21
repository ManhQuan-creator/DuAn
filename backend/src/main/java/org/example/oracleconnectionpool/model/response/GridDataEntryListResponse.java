package org.example.oracleconnectionpool.model.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class GridDataEntryListResponse {
    private Long id;
    private String entryCode;
    private String entryName;
    private String orgCode;
    private Integer year;
    private Integer month;
    private String status;
    private String submittedBy;
    private LocalDateTime submittedAt;
    private LocalDateTime dueDate;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
