package org.example.oracleconnectionpool.model.response.sqlhistory;

import jakarta.persistence.Column;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SclHistoryResponse {
    private Long id;

    private String sclCategoryId; // Id hạng mục SCL

    private String unit; // Đơn vị

    private String categoryName; // Tên hạng mục

    private String assetType; // Phân loại

    private String yearPlan; // Năm dữ liệu

    private String actualVolume; // KL thực hiện

    private String progress; // Tiến độ

    private String note; // Ghi chú
    private String month; // Ghi chú

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
