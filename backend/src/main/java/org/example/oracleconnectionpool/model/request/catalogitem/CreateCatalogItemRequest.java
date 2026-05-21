package org.example.oracleconnectionpool.model.request.catalogitem;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateCatalogItemRequest {

    @NotBlank(message = "Mã không được để trống")
    @Pattern(regexp = "^[A-Za-z0-9_-]+$", message = "Mã phải chứa chữ cái in hoa, số, dấu gạch dưới hoặc gạch ngang")
    @Size(max = 50)
    private String id;

    @NotBlank(message = "Tên không được để trống")
    @Size(max = 4000, message = "Tên không được vượt quá 4000 ký tự")
    private String name;

    @NotBlank(message = "Loại không được để trống")
    @Size(max = 50, message = "Loại không được vượt quá 50 ký tự")
    private String type;

    @Size(max = 50, message = "Mã cha không được vượt quá 50 ký tự")
    private String parentId;

    @Size(max = 100, message = "Ghi chú không được vượt quá 100 ký tự")
    private String note;

    private Integer sortOrder;
}
