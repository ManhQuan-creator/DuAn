package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Date;

@Entity
@Table(name = "SCL_CATEGORY")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SclCategoryEntity extends AbstractAuditingTimeEntity {
    @Id
    @SequenceGenerator(
            name = "SCL_CATEGORY_SEQ",
            sequenceName = "SCL_CATEGORY_SEQ",
            allocationSize = 1,
            initialValue = 1000
    )
    @GeneratedValue(
            strategy = GenerationType.SEQUENCE,
            generator = "SCL_CATEGORY_SEQ"
    )
    private Long id;

    @Column(name = "PC")
    private String pc; // PC

    @Column(name = "UNIT")
    private String unit; // Đơn vị

    @Column(name = "CATEGORY_CODE")
    private String categoryCode; // Mã hạng mục

    @Column(name = "ASSET_CODE", length = 4000)
    private String assetCode; // Mã tài sản

    @Column(name = "CATEGORY_NAME")
    private String categoryName; // Tên hạng mục

    @Column(name = "ASSET_TYPE")
    private String assetType; // Phân loại

    @Column(name = "PLAN_TYPE")
    private String planType; // Loại kế hoạch

    @Column(name = "STATUS")
    private String status; // Trạng thái

    @Column(name = "YEAR_PLAN")
    private String yearPlan; // Năm kế hoạch

    @Column(name = "LAST_SCL_YEAR")
    private String lastSclYear; // Năm SCL gần nhất

    @Column(name = "ACTUAL_VOLUME")
    private String actualVolume; // Khối lượng thực hiện

    @Column(name = "PROGRESS")
    private String progress; // Tiến độ

    @Column(name = "SC_CONTENT", length = 4000)
    private String scContent; // Nội dung SC chủ yếu

    @Column(name = "SCL_PERFORM")
    private String sclPerform; // Thực hiện SCL theo

    @Column(name = "SSKT_CODE")
    private Long ssktCode; // Mã số trên SSKT

    @Column(name = "DATE_COMPLETE_CONTRACT")
    private Date dateCompleteContract; // Ngày hoàn thành theo hợp đồng xây lắp

    @Column(name = "APPROVED_CATEGORY")
    private String approvedCategory; // Thông qua danh mục tại văn bản QĐ

    @Column(name = "APPROVAL_LEVEL")
    private String approvalLevel; // Phân cấp phê duyệt PAKT - ĐT

    @Column(name = "EXECUTION_METHOD")
    private String executionMethod; // Hình thức thực hiện

    @Column(name = "ACCUMULATED_PROGRESS")
    private String accumulatedProgress; // KL thực hiện lũy kế (%)

    @Column(name = "NEXT_MONTH_PLAN")
    private String nextMonthPlan; // Kế hoạch thực hiện tháng tiếp theo

    @Column(name = "DECISION_NO_PAKT")
    private String decisionNoPakt; // Số QĐ Phê duyệt PAKT

    @Column(name = "APPROVAL_DATE_PAKT")
    private Date approvalDatePakt; // Ngày phê duyệt PAKT

    @Column(name = "DECISION_NO_ESTIMATE")
    private String decisionNoEstimate; // Số QĐ phê duyệt dự toán

    @Column(name = "APPROVAL_DATE_ESTIMATE")
    private Date approvalDateEstimate; // Ngày phê duyệt dự toán

    @Column(name = "VALUE_VAT")
    private String valueVat; // Giá trị trước VAT

    @Column(name = "APPROVED_ESTIMATED_COST")
    private String approvedEstimatedCost; // Giá trị khái toán đã thông qua

    @Column(name = "ASSIGNED_SCL_COST")
    private String assignedSclCost; // Giá trị chi phí SCL giao

    @Column(name = "TOTAL_CONTRACT_VALUE")
    private String totalContractValue; // Tổng giá trị hợp đồng các gói thầu (trước VAT)

    @Column(name = "MONTH_ACCOUNTING_VALUE")
    private String monthAccountingValue; // Giá trị hạch toán tháng

    @Column(name = "ACCUMULATED_ACCOUNTING_VALUE")
    private String accumulatedAccountingValue; // Giá trị đã hạch toán đến thời điểm hiện tại

    @Column(name = "PROJECT_VALUE")
    private String projectValue; // Giá trị công trình HM (trước VAT)

    @Column(name = "ITEM_ACCOUNTING_VALUE")
    private String itemAccountingValue; // Giá trị hạch toán hạng mục

    @Column(name = "DELIVERY_PLAN")
    private Date deliveryPlan; // Kế hoạch giao

    @Column(name = "PLANNED_COMPLETION_DATE")
    private Date plannedCompletionDate; // Ngày hoàn thành theo kế hoạch xây lắp

    @Column(name = "ACTUAL")
    private Date actual; // Thực tế

    @Column(name = "PERCENTAGE")
    private String percentage; // Phần trăm

    @Column(name = "VALUE_COST_EQUIVALENT")
    private String valueCostEquivalent; // Giá trị

    @Column(name = "EQUIPMENT_BEFORE_SCL")
    private String equipmentBeforeScl; // Trước SCL

    @Column(name = "EQUIPMENT_AFTER_SCL")
    private String equipmentAfterScl; // Sau SCL

    @Column(name = "ISSUES")
    private String issues; // Khó khăn vướng mắc

    @Column(name = "NOTE")
    private String note; // Ghi chú

    @Column(name = "UNIT_RECEIVE_ASSESSMENT")
    private String unitReceiveAssessment; // Đơn vị nhận thẩm định

    @Column(name = "CREATED_UNIT")
    private String createdUnit; // Đơn vị tạo

    @Column(name = "REGISTER_TYPE")
    private String registerType; // Loại đăng ký
}
