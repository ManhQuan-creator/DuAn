package org.example.oracleconnectionpool.model.request.sclcategory;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Date;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class SclCategoryRequestDTO {
    private Long id;
    private String pc; // PC
    private String unit; // Đơn vị
    private String categoryCode; // Mã hạng mục
    private String assetCode; // Mã tài sản
    private String categoryName; // Tên hạng mục
    private String assetType; // Phân loại
    private String planType; // Loại kế hoạch
    private String status; // Trạng thái
    private String yearPlan; // Năm kế hoạch
    private String lastSclYear; // Năm SCL gần nhất
    private String actualVolume; // Khối lượng thực hiện
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
}
