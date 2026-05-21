package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "SIDEBAR_MENU")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SidebarMenu extends AbstractAuditingTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Long id;

    /** ID của menu cha (NULL = menu cấp gốc/section) */
    @Column(name = "PARENT_ID")
    private Long parentId;

    /** Khóa định danh duy nhất, dùng cho tracking & i18n nếu cần */
    @Column(name = "MENU_KEY", unique = true, nullable = false, length = 100)
    private String menuKey;

    @Column(name = "LABEL", nullable = false, length = 255)
    private String label;

    /** Đường dẫn route (chỉ áp dụng cho menu lá) */
    @Column(name = "PATH", length = 500)
    private String path;

    @Column(name = "ICON", length = 100)
    private String icon;

    @Column(name = "SORT_ORDER", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    /**
     * Phạm vi nhóm tổ chức được xem menu này.
     *   NULL  → tất cả người dùng (mọi nhóm) đều thấy, bỏ qua permissionRules
     *   EVNNPC     → chỉ user thuộc Tổng công ty
     *   PC_COMPANY → chỉ user thuộc Công ty Điện lực thành viên
     *
     * Khớp với {@code AppUser.orgGroupCode}.
     */
    @Column(name = "ORG_GROUP_CODE", length = 20)
    private String orgGroupCode;

    /**
     * Quy tắc phân quyền per-dept (JSON serialized). Cấu trúc:
     * <pre>[
     *   {"deptCode":"PHONG_KH","positionCodes":["TRUONG_PHONG","PHO_PHONG"]},
     *   {"deptCode":"PHONG_KT","positionCodes":[]}
     * ]</pre>
     * NULL hoặc rỗng → không giới hạn thêm theo dept/position (mọi user trong orgGroupCode đều thấy).
     * Service tự serialize/deserialize qua Jackson.
     */
    @Column(name = "PERMISSION_RULES", length = 4000)
    private String permissionRules;

    @Column(name = "ACTIVE", nullable = false)
    @Builder.Default
    private Boolean active = true;
}
