package org.example.oracleconnectionpool.model.request.catalogtype;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateCatalogTypeRequest {

    @NotBlank
    @Pattern(regexp = "^[A-Z_]+$", message = "type must contain only uppercase letters and underscores")
    @Size(max = 50)
    private String type;

    @NotBlank
    @Size(max = 100)
    private String name;

    @Size(max = 500)
    private String description;

    @Size(max = 100)
    private String icon;
}
