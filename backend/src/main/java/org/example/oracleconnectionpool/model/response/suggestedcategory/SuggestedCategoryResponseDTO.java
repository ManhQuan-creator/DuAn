package org.example.oracleconnectionpool.model.response.suggestedcategory;

import lombok.*;
import org.example.oracleconnectionpool.annotation.ExcelColumn;
import org.example.oracleconnectionpool.model.response.EntryFileResponse;

import java.util.List;

@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class SuggestedCategoryResponseDTO {
    @ExcelColumn("Tên đơn vị")
    private String unitName;

    @ExcelColumn("Tên hạng mục")
    private String categoryName;

    @ExcelColumn("Mã hạng mục")
    private String categoryCode;

    @ExcelColumn("Năm kế hoạch")
    private String yearPlan;

    @ExcelColumn("Giá trị khái toán")
    private String estimatedValue;

    @ExcelColumn("Trạng thái")
    private String status;

    private List<EntryFileResponse> attachmentFile;
}
