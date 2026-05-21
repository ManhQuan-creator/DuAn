package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Loại ban/phòng (Department Type) — danh mục các loại đơn vị tổ chức.
 *
 * Phân theo orgLevelScope:
 *   HQ_DEPT  → các Ban thuộc Tổng công ty (BAN_KH, BAN_KT, BAN_AT, ...)
 *   PC_DEPT  → các Phòng thuộc Công ty Điện lực (PHONG_KH, PHONG_KT, ...)
 *
 * Được tham chiếu bởi:
 *   APP_USER.deptCode → user thuộc ban/phòng nào
 *   SIDEBAR_MENU.permissionRules (JSON) → quy tắc {deptCode, positionCodes} per-dept
 */
@Entity
@Table(name = "DEPT_TYPE")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeptType {

    /** Mã loại đơn vị: BAN_KH, PHONG_KH, ... */
    @Id
    @Column(name = "DEPT_TYPE_CODE", length = 50)
    private String deptTypeCode;

    @Column(name = "DEPT_TYPE_NAME", nullable = false, length = 200)
    private String deptTypeName;

    /** HQ_DEPT | PC_DEPT */
    @Column(name = "ORG_LEVEL_SCOPE", nullable = false, length = 20)
    private String orgLevelScope;

    @Column(name = "SORT_ORDER", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "ACTIVE", nullable = false)
    @Builder.Default
    private Boolean active = true;
}
