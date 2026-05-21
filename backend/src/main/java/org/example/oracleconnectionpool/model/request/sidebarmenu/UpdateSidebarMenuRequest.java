package org.example.oracleconnectionpool.model.request.sidebarmenu;

import jakarta.validation.constraints.Size;
import lombok.Data;
import org.example.oracleconnectionpool.model.response.sidebarmenu.PermissionRule;

import java.util.List;

@Data
public class UpdateSidebarMenuRequest {

    private Long parentId;

    @Size(max = 100)
    private String menuKey;

    @Size(max = 255)
    private String label;

    @Size(max = 500)
    private String path;

    @Size(max = 100)
    private String icon;

    private Integer sortOrder;

    private Boolean active;

    /** Phạm vi nhóm tổ chức. Khi {@code updateOrgGroupCode = true}, chuỗi rỗng = xóa giới hạn. */
    @Size(max = 20)
    private String orgGroupCode;

    /** Danh sách quy tắc phân quyền. Khi {@code updatePermissionRules = true}, danh sách rỗng = xóa toàn bộ rule. */
    private List<PermissionRule> permissionRules;

    /** Cờ cho phép cập nhật field tương ứng kể cả khi giá trị rỗng/null. Frontend gửi true khi save. */
    private Boolean updateOrgGroupCode;
    private Boolean updatePermissionRules;
}
