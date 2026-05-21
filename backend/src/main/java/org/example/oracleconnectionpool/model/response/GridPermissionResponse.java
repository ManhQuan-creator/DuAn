package org.example.oracleconnectionpool.model.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class GridPermissionResponse {
    private Long id;
    private String level;
    private String targetField;
    private String targetRowCode;
    private String permissionType;
    private String userId;
    private String roleCode;
    private String createdBy;
    private LocalDateTime createdAt;
}
