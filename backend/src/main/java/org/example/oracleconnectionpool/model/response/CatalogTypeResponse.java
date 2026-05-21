package org.example.oracleconnectionpool.model.response;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CatalogTypeResponse {
    private Long id;
    private String type;
    private String name;
    private String description;
    private String icon;
    private Integer sortOrder;
    private Boolean active;
}
