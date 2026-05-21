package org.example.oracleconnectionpool.model.request.griddataentry;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class UpdateGridDataEntryRequest {
    private String entryName;
    private String rowData;
    /** Hạn xử lý phiên. Optional — null = giữ giá trị cũ (nếu muốn xoá, set clearDueDate=true). */
    private LocalDateTime dueDate;
    /**
     * True = xoá due_date (set NULL trong DB) — bỏ qua field {@code dueDate}.
     * Dùng để phân biệt "không gửi field" với "muốn xoá", vì semantic update partial
     * chỉ áp dụng khi field non-null.
     */
    private Boolean clearDueDate;
}
