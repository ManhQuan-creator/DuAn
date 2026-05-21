package org.example.oracleconnectionpool.model.request.gridpermission;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class GridPermissionRequest {

    private List<AddPermissionRequest> addPermissionRequest;

    private List<Long> idDeleted;

    @Data
    public static class AddPermissionRequest {
        @NotBlank
        private String level; // COLUMN | ROW | CELL

        private String targetField;
        private String targetRowCode;

        private String permissionType; // ALLOW | DENY | LOCK

        private String userId;
        private String roleCode;
    }
}