package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "MASTER_CATALOG")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MasterCatalog extends AbstractAuditingTimeEntity {

    @Id
    @Column(name = "ID", length = 50)
    private String id;

    @Column(name = "NAME", nullable = false)
    private String name;

    @Column(name = "PARENT_ID", length = 50)
    private String parentId;

    @Column(name = "NOTE", length = 100)
    private String note;

    @Column(name = "TYPE", nullable = false, length = 50)
    private String type;

    @Column(name = "SORT_ORDER")
    private Integer sortOrder;

    @Column(name = "ACTIVE", nullable = false)
    @Builder.Default
    private Boolean active = true;
}
