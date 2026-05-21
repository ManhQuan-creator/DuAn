package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "APP_USER")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppUser extends AbstractAuditingUserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "USERNAME", unique = true, nullable = false, length = 50)
    private String username;

    @Column(name = "PASSWORD", nullable = false, length = 255)
    private String password;

    @Column(name = "FULL_NAME", length = 100)
    private String fullName;

    @Column(name = "EMAIL", length = 100)
    private String email;

    @Column(name = "PHONE", length = 20)
    private String phone;

    /**
     * Nhóm tổ chức — dùng cho phân quyền template:
     *   EVNNPC     → cán bộ Tổng công ty (lãnh đạo TCT + các Ban)
     *   PC_COMPANY → cán bộ Công ty điện lực thành viên
     * Tất cả PC dùng chung giá trị "PC_COMPANY" để 1 rule TemplateAccess
     * áp dụng cho toàn bộ PC mà không cần khai báo riêng từng PC.
     */
    @Column(name = "ORG_GROUP_CODE", nullable = false, length = 20)
    private String orgGroupCode;

    /**
     * Mã công ty cụ thể — dùng để auto-fill orgCode khi tạo GridDataEntry:
     *   EVNNPC users: null (hoặc "EVNNPC" nếu cần)
     *   PC users: PCND, PCHP, PCBN, ...
     * Không dùng cho logic phân quyền.
     */
    @Column(name = "COMPANY_CODE", length = 50)
    private String companyCode;

    /**
     * Mã ban/phòng trực thuộc:
     *   EVNNPC users → BAN_KH, BAN_KT, BAN_AT, ... (HQ_DEPT orgCode)
     *   PC users     → PHONG_KH, PHONG_KT, PHONG_AT, ... (DeptType.deptTypeCode)
     * Null nếu là lãnh đạo cấp tổng (TGĐ, P.TGĐ, GĐ, P.GĐ).
     */
    @Column(name = "DEPT_CODE", length = 50)
    private String deptCode;

    /**
     * Chức danh: TGD, PTGD, HDTV, TRUONG_BAN, PHO_BAN, CHUYEN_VIEN_BAN,
     *            GD, PGD, TRUONG_PHONG, PHO_PHONG, CHUYEN_VIEN_PHONG.
     * FK → POSITION.positionCode
     */
    @Column(name = "POSITION_CODE", length = 50)
    private String positionCode;

    @Column(name = "ACTIVE", nullable = false)
    @Builder.Default
    private Boolean active = true;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "APP_USER_ROLE",
            joinColumns = @JoinColumn(name = "USER_ID"),
            inverseJoinColumns = @JoinColumn(name = "ROLE_ID")
    )
    @Builder.Default
    private Set<AppRole> roles = new HashSet<>();
}
