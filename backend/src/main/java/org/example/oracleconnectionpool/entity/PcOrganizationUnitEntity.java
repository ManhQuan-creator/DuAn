package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "PC_ORGANIZATION_UNIT")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PcOrganizationUnitEntity extends AbstractAuditingTimeEntity {
    @Id
    @SequenceGenerator(
            name = "PC_ORGANIZATION_UNIT_SEQ",
            sequenceName = "PC_ORGANIZATION_UNIT_SEQ",
            allocationSize = 1
    )
    @GeneratedValue(
            strategy = GenerationType.SEQUENCE,
            generator = "PC_ORGANIZATION_UNIT_SEQ"
    )
    private Long id;

    @Column(name = "PC")
    private String pc; // PC

    @Column(name = "UNIT")
    private String unit; // Tên đơn vị

    @Column(name = "ACTIVE")
    private String active; // Trạng thái hoạt động
}