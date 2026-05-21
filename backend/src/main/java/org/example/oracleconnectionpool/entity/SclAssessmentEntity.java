package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "SCL_ASSESSMENT")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SclAssessmentEntity extends AbstractAuditingTimeEntity {
    @Id
    @SequenceGenerator(
            name = "SCL_ASSESSMENT_SEQ",
            sequenceName = "SCL_ASSESSMENT_SEQ",
            allocationSize = 1
    )
    @GeneratedValue(
            strategy = GenerationType.SEQUENCE,
            generator = "SCL_ASSESSMENT_SEQ"
    )
    private Long id;

    @Column(name = "PC")
    private String pc; // PC

    @Column(name = "UNIT", nullable = false)
    private String unit; // Đơn vị

    @Column(name = "CATEGORY_CODE")
    private String categoryCode; // Mã hạng mục

    @Column(name = "ASSET_CODE")
    private String assetCode; // Mã tài sản

    @Column(name = "CATEGORY_NAME")
    private String categoryName; // Tên hạng mục

    @Column(name = "ASSET_TYPE")
    private String assetType; // Phân loại

    @Column(name = "PLAN_TYPE")
    private String planType; // Loại kế hoạch

    @Column(name = "ACTUAL_VOLUME")
    private String actualVolume; // Khối lượng thực hiện (%)

    @Column(name = "PROGRESS")
    private String progress; // Tiến độ

    @Column(name = "LAST_SCL_YEAR")
    private String lastSclYear; // Năm SCL gần nhất

    @Column(name = "YEAR_PLAN")
    private String yearPlan; // Năm kế hoạch

    @Column(name = "REGISTER_TYPE")
    private String registerType;

    @Column(name = "STATUS")
    private String status; // Trạng thái

    @Column(name = "SCL_CATEGORY_ID")
    private Long categoryId;

    @Column(name = "ASSESSMENT_DEPT_CODE")
    private String assessmentDeptCode;

    @Column(name = "ASSESSMENT_DEPT_NAME")
    private String assessmentDeptName;

    @Column(name = "CREATED_DEPT")
    private String createdDept; // Đơn vị tạo
}