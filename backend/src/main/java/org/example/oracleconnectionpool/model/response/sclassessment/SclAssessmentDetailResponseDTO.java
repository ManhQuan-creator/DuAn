package org.example.oracleconnectionpool.model.response.sclassessment;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.example.oracleconnectionpool.model.response.comment.CommentsResponseDTO;
import org.example.oracleconnectionpool.model.response.sclcategory.SclCategoryResponseDTO;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SclAssessmentDetailResponseDTO {
    private Long id;
    private String actualVolume; // Khối lượng thực hiện (%)
    private String progress; // Tiến độ
    private String lastSclYear; // Năm SCL gần nhất
    private String status; // Trạng thái
    private String statusAssessment; // Trạng thái
    private String createdAt;
    private String updatedAt;
    private String assessmentDeptCode;
    private String assessmentDeptName;

    private SclCategoryResponseDTO categoryResponse;
}
