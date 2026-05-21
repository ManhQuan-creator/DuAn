package org.example.oracleconnectionpool.model.response.sclcategory;

import lombok.*;
import org.example.oracleconnectionpool.annotation.ExcelColumn;
import org.example.oracleconnectionpool.model.response.sclassessment.SclCategoryCommentsDTO;

import java.util.Date;

@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class SclCategoryResponseDTO {
    private Long id;

    @ExcelColumn("PC")
    private String pc; // PC

    @ExcelColumn("Đơn vị")
    private String unit; // Đơn vị

    @ExcelColumn("Mã hạng mục")
    private String categoryCode; // Mã hạng mục

    @ExcelColumn("Mã tài sản")
    private String assetCode; // Mã tài sản

    @ExcelColumn("Tên hạng mục")
    private String categoryName; // Tên hạng mục

    @ExcelColumn("Phân loại")
    private String assetType; // Phân loại

    @ExcelColumn("Loại kế hoạch")
    private String planType; // Loại kế hoạch

    @ExcelColumn("Trạng thái")
    private String status; // Trạng thái

    @ExcelColumn("Năm kế hoạch")
    private String yearPlan; // Năm kế hoạch

    @ExcelColumn("Năm SCL gần nhất")
    private String lastSclYear; // Năm SCL gần nhất

    @ExcelColumn("Loại đăng ký")
    private String registerType; // Loại đăng ký

    private String actualVolume; // Khối lượng thực hiện

    @ExcelColumn("Tiến độ")
    private String progress; // Tiến độ
    private String scContent; // Nội dung SC chủ yếu
    private String sclPerform; // Thực hiện SCL theo
    private Long ssktCode; // Mã số trên SSKT
    private Date dateCompleteContract; // Ngày hoàn thành theo hợp đồng xây lắp
    private String approvedCategory; // Thông qua danh mục tại văn bản QĐ
    private String approvalLevel; // Phân cấp phê duyệt PAKT - ĐT
    private String executionMethod; // Hình thức thực hiện
    private String accumulatedProgress; // KL thực hiện lũy kế (%)
    private String nextMonthPlan; // Kế hoạch thực hiện tháng tiếp theo
    private String decisionNoPakt; // Số QĐ Phê duyệt PAKT
    private Date approvalDatePakt; // Ngày phê duyệt PAKT
    private String decisionNoEstimate; // Số QĐ phê duyệt dự toán
    private Date approvalDateEstimate; // Ngày phê duyệt dự toán
    private String valueVat; // Giá trị trước VAT
    private String approvedEstimatedCost; // Giá trị khái toán đã thông qua
    private String assignedSclCost; // Giá trị chi phí SCL giao
    private String totalContractValue; // Tổng giá trị hợp đồng các gói thầu (trước VAT)
    private String monthAccountingValue; // Giá trị hạch toán tháng
    private String accumulatedAccountingValue; // Giá trị đã hạch toán đến thời điểm hiện tại
    private String projectValue; // Giá trị công trình HM (trước VAT)
    private String itemAccountingValue; // Giá trị hạch toán hạng mục
    private Date deliveryPlan; // Kế hoạch giao
    private Date plannedCompletionDate; // Ngày hoàn thành theo kế hoạch xây lắp
    private Date actual; // Thực tế
    private String percentage; // Phần trăm
    private String valueCostEquivalent; // Giá trị
    private String equipmentBeforeScl; // Trước SCL
    private String equipmentAfterScl; // Sau SCL
    private String issues; // Khó khăn vướng mắc
    private String note; // Ghi chú
    private String createdAt;

    @ExcelColumn("Thời gian cập nhật")
    private String updatedAt;
    private String createdUnit;

    private SclCategoryCommentsDTO categoryCommentsDTO;
}
