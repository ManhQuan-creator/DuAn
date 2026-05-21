package org.example.oracleconnectionpool.model.request.griddataentry;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CreateGridDataEntryRequest {
    @NotBlank
    private String entryCode;

    private String entryName;

    private String orgCode;

    @NotNull
    @Min(value = 2000, message = "Năm phải lớn hơn hoặc bằng 2000, nhỏ hơn hoặc bằng 3000")
    @Max(value = 3000, message = "Năm phải lớn hơn hoặc bằng 2000, nhỏ hơn hoặc bằng 3000")
    private Integer year;

    @Min(value = 1, message = "Tháng phải lớn hơn hoặc bằng 1, nhỏ hơn hoặc bằng 12")
    @Max(value = 12, message = "Tháng phải lớn hơn hoặc bằng 1, nhỏ hơn hoặc bằng 12")
    private Integer month;

    @NotNull
    private String rowData;

    /** Hạn xử lý phiên — người tạo phiên set khi tạo entry. Optional. */
    private LocalDateTime dueDate;
}
