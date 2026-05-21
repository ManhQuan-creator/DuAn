package org.example.oracleconnectionpool.model.request.sidebarmenu;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import org.example.oracleconnectionpool.model.response.sidebarmenu.PermissionRule;

import java.util.List;

@Data
public class CreateSidebarMenuRequest {

    private Long parentId;

    @NotBlank
    @Size(max = 100)
    private String menuKey;

    @NotBlank
    @Size(max = 255)
    private String label;

    @Size(max = 500)
    private String path;

    @Size(max = 100)
    private String icon;

    private Integer sortOrder;

    /** Phạm vi nhóm tổ chức: null/empty = mọi nhóm, "EVNNPC" hoặc "PC_COMPANY". */
    @Size(max = 20)
    private String orgGroupCode;

    /** Danh sách quy tắc phân quyền (per-dept positions). null/empty = không giới hạn thêm. */
    private List<PermissionRule> permissionRules;
}
