package org.example.oracleconnectionpool.model.response;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CatalogItemResponse {
    private String id;
    private String name;
    private String parentId;
    private String note;
    private String type;
    private Integer sortOrder;
    private Boolean active;
}
