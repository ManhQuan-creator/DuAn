package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Phân quyền truy cập template theo cơ cấu tổ chức EVNNPC.
 *
 * Mỗi row khai báo: "Đối tượng có orgCode X, positionCode Y được thực hiện actionKey Z trên template T".
 *
 * Cả hai điều kiện đều nullable (= wildcard):
 *   subject_org_code      → ORGANIZATION.org_code (BAN_KH, PHONG_KH, EVNNPC, ...)
 *                           null = áp dụng cho tất cả ban/phòng
 *   subject_position_code → POSITION.position_code (TGD, CHUYEN_VIEN_PHONG, ...)
 *                           null = áp dụng cho tất cả chức danh
 *
 * Logic kiểm tra quyền:
 *   (subject_org_code IS NULL OR subject_org_code = user.deptCode)
 *   AND (subject_position_code IS NULL OR subject_position_code = user.positionCode)
 *
 * Ví dụ khai báo:
 *   (PHONG_KH, CHUYEN_VIEN_PHONG) + EDIT    → CV Phòng KH bất kỳ PC nhập liệu
 *   (BAN_KH,   CHUYEN_VIEN_BAN)  + APPROVE:1 → CV Ban KH EVNNPC duyệt bước 1
 *   (null,     TGD)              + APPROVE:3 → TGĐ EVNNPC duyệt bước 3
 *   (null,     null)             + VIEW       → tất cả user đã xác thực xem được
 *
 * Phân tách data entry theo công ty: GRID_DATA_ENTRY.company_code — không xử lý ở đây.
 *
 * actionKey: VIEW | EDIT | SUBMIT | APPROVE:1 | APPROVE:2 | ... | <button_key>
 */
@Entity
@Table(name = "TEMPLATE_ACCESS", indexes = {
        @Index(name = "IDX_TA_TEMPLATE",  columnList = "TEMPLATE_ID"),
        @Index(name = "IDX_TA_ORG_POS",   columnList = "SUBJECT_ORG_CODE, SUBJECT_POSITION_CODE")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TemplateAccess {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "TEMPLATE_ID", nullable = false)
    private Long templateId;

    /** VIEW | EDIT | SUBMIT | APPROVE:N | <button_key> */
    @Column(name = "ACTION_KEY", nullable = false, length = 50)
    private String actionKey;

    /**
     * Mã ban/phòng từ bảng ORGANIZATION.
     * Ví dụ: BAN_KH (HQ_DEPT), PHONG_KH (PC_DEPT), EVNNPC (root).
     * null = áp dụng cho tất cả ban/phòng.
     * Khớp với AppUser.deptCode.
     */
    @Column(name = "SUBJECT_ORG_CODE", length = 50)
    private String subjectOrgCode;

    /**
     * Mã chức danh từ bảng POSITION.
     * Ví dụ: TGD, TRUONG_PHONG, CHUYEN_VIEN_BAN, ...
     * null = áp dụng cho tất cả chức danh.
     * Khớp với AppUser.positionCode.
     */
    @Column(name = "SUBJECT_POSITION_CODE", length = 50)
    private String subjectPositionCode;

    @Column(name = "ACTIVE", nullable = false)
    @Builder.Default
    private Boolean active = true;
}
