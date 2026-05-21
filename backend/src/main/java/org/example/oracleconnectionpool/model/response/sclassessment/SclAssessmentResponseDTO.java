package org.example.oracleconnectionpool.model.response.sclassessment;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class SclAssessmentResponseDTO {
    private Long id;
    private String pc; // PC
    private String unit; // Đơn vị
    private String categoryCode; // Mã hạng mục
    private String assetCode; // Mã tài sản
    private String categoryName; // Tên hạng mục
    private String assetType; // Phân loại
    private String planType; // Loại kế hoạch
    private String actualVolume; // Khối lượng thực hiện (%)
    private String progress; // Tiến độ
    private String lastSclYear; // Năm SCL gần nhất
    private String yearPlan; // Năm kế hoạch
    private String registerType;
    private String status; // Trạng thái
    private String createdAt;
    private String updatedAt;
    private String createdDept;
}
