package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "GRID_ROW")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GridRow extends AbstractAuditingUserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Long id;

    @Column(name = "TEMPLATE_ID", nullable = false)
    private Long templateId;

    @Column(name = "ROW_CODE", length = 100)
    private String rowCode;

    @Column(name = "ROW_NAME", length = 200)
    private String rowName;

    @Column(name = "ROW_DATA", columnDefinition = "CLOB")
    private String rowData;

    @Column(name = "CELL_CONFIG", columnDefinition = "CLOB")
    private String cellConfig;

    @Column(name = "IS_TYPE_HEADER")
    @Builder.Default
    private Boolean isTypeHeader = false;

    @Column(name = "CATALOG_FIELD", length = 50)
    private String catalogField;

    @Column(name = "SORT_ORDER")
    @Builder.Default
    private Integer sortOrder = 0;
}
