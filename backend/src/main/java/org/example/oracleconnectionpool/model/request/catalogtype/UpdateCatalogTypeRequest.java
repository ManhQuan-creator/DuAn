package org.example.oracleconnectionpool.model.request.catalogtype;

import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateCatalogTypeRequest {

    @Size(max = 100)
    private String name;

    @Size(max = 500)
    private String description;

    @Size(max = 100)
    private String icon;

    private Integer sortOrder;

    private Boolean active;
}
