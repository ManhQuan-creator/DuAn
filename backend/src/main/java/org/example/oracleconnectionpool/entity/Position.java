package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "POSITION")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Position extends AbstractAuditingTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "POSITION_CODE", unique = true, nullable = false, length = 50)
    private String positionCode;

    @Column(name = "POSITION_NAME", nullable = false, length = 100)
    private String positionName;

    @Column(name = "POSITION_RANK", nullable = false)
    private Integer positionRank;

    @Column(name = "ORG_LEVEL_SCOPE", nullable = false, length = 20)
    private String orgLevelScope;

    @Column(name = "ACTIVE", nullable = false)
    @Builder.Default
    private Boolean active = true;
}
