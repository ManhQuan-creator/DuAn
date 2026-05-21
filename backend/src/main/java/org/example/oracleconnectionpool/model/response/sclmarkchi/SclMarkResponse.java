package org.example.oracleconnectionpool.model.response.sclmarkchi;

import jakarta.persistence.Column;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SclMarkResponse {
    private Long id;
    private Long sclCategoryId; // Id hạng mục SCL
    private String assetCode; // Id tai san
    private Long assetName; // Tên tai san
    private String equipmentBeforeScl; // Trước SCL
    private String equipmentAfterScl; // Sau SCL
}
