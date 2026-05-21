package org.example.oracleconnectionpool.model.response.grid;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GridPermissionUpdateResponse {

    private List<GridPermission> gridPermissions;

    private List<Long> idDeleted;

    @Data
    public static class GridPermission {
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
}
