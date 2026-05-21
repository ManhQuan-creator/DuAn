package org.example.oracleconnectionpool.model.request.catalogitem;

import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateCatalogItemRequest {

    @Size(max = 4000)
    private String name;

    @Size(max = 50)
    private String parentId;

    @Size(max = 100)
    private String note;

    private Integer sortOrder;

    private Boolean active;
}
