package org.example.oracleconnectionpool.model.response.sidebarmenu;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SidebarMenuNode {
    private Long id;
    private Long parentId;
    private String menuKey;
    private String label;
    private String path;
    private String icon;
    private Integer sortOrder;

    /** Phạm vi nhóm tổ chức (null = không giới hạn, mọi user xem được). */
    private String orgGroupCode;

    /**
     * Danh sách quy tắc phân quyền: mỗi quy tắc gồm {@code deptCode} + {@code positionCodes}.
     * Empty = không giới hạn theo dept/position (mọi user trong orgGroupCode đều thấy).
     */
    @Builder.Default
    private List<PermissionRule> permissionRules = new ArrayList<>();

    private Boolean active;

    @Builder.Default
    private List<SidebarMenuNode> children = new ArrayList<>();
}
