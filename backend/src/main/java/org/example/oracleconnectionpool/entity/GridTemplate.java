package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;
import org.example.oracleconnectionpool.constant.PeriodType;
import org.example.oracleconnectionpool.constant.TemplateStatus;

@Entity
@Table(name = "GRID_TEMPLATE")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GridTemplate extends AbstractAuditingUserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Long id;

    @Column(name = "CODE", nullable = false, unique = true, length = 50)
    private String code;

    @Column(name = "NAME", nullable = false, length = 200)
    private String name;

    @Column(name = "DESCRIPTION", length = 1000)
    private String description;

    @Column(name = "COLUMN_CONFIGS", columnDefinition = "CLOB")
    private String columnConfigs;

    @Column(name = "COLUMN_GROUPS", columnDefinition = "CLOB")
    private String columnGroups;

    @Column(name = "STATUS", length = 20)
    @Builder.Default
    private String status = TemplateStatus.DRAFT;

    @Column(name = "VERSION")
    @Builder.Default
    private Integer version = 1;

    @Column(name = "PROCESS_DEFINITION_KEY", length = 50)
    private String processDefinitionKey;

    /**
     * Kỳ báo cáo: YEAR | HALF_YEAR | QUARTER | MONTH.
     * <ul>
     *   <li>YEAR — chỉ năm (month = null)</li>
     *   <li>HALF_YEAR — năm + nửa năm (H1 = month 6, H2 = month 12)</li>
     *   <li>QUARTER — năm + quý (Q1=3, Q2=6, Q3=9, Q4=12)</li>
     *   <li>MONTH — năm + tháng (1-12)</li>
     * </ul>
     * Default = MONTH để tương thích ngược với template cũ.
     */
    @Column(name = "PERIOD_TYPE", length = 20)
    @Builder.Default
    private String periodType = PeriodType.DEFAULT.name();

    /**
     * Ban chủ quản template — FK → ORGANIZATION.orgCode (orgLevel = HQ_DEPT).
     * VD: BAN_KH quản lý các báo cáo kế hoạch, BAN_AT quản lý báo cáo an toàn.
     * Dùng để lọc template theo ban khi hiển thị danh sách.
     */
    @Column(name = "OWNER_DEPT_CODE", length = 50)
    private String ownerDeptCode;

    /**
     * Ban chủ quản template — FK → MASTER_CATALOG.id where MASTER_CATALOG.TYPE = 'REPORT_DEPARTMENT'
     * Dùng MASTER_CATALOG.TYPE = 'REPORT_DEPARTMENT' không dùng được Organization.orgCode vì Organization chia đến phòng và ban. 
     * Ví dụ phòng kế hoạch và ban kế hoạch là 2 đơn vị khác nhau. nhưng cùng lĩnh vực.
     * 1 báo cáo có thể có nhiều lĩnh vực. Dữ liệu nhập vào sẽ được lưu theo kiểu TCNS,TCKT,KD,.... (Ý nghĩa: Tổ chức nhân sự, Tài chính kế toán, Kinh doanh, ...)
     */
    @Column(name = "REPORT_DEPARTMENT", nullable = true, length = 2000)
    private String reportDepartment;

    /**
     * Nhóm chức năng báo cáo — lưu JSON list các {@code SidebarMenu.menuKey} đã chọn.
     * Nguồn dữ liệu dropdown lấy từ bảng {@code SIDEBAR_MENU} (menu lá có path),
     * KHÔNG phải FK tới MASTER_CATALOG. Cột giữ nguyên tên REPORT_FC_GROUP để
     * tương thích ngược với DB hiện hữu.
     * Service serialize/deserialize qua Jackson (xem {@code GridTemplateService}).
     */
    @Column(name = "REPORT_FC_GROUP", nullable = true, length = 250)
    private String reportFcGroup;

    /**
     * Bật tính năng "Hạn xử lý" (due_date) cho mọi entry của template này.
     * False (mặc định) → form tạo entry ẩn input due_date + render entry không
     * hiện badge. Không destructive với dữ liệu cũ — chỉ là gate hiển thị.
     */
    @Column(name = "USE_DUE_DATE")
    @Builder.Default
    private Boolean useDueDate = false;
}
