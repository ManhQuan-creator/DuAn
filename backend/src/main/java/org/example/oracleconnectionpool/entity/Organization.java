package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "ORGANIZATION")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Long id;

    @Column(name = "ORG_CODE", unique = true, nullable = false, length = 50)
    private String orgCode;

    @Column(name = "ORG_NAME", length = 200)
    private String orgName;

    @Column(name = "PARENT_ORG_CODE", length = 50)
    private String parentOrgCode;

    @Column(name = "ORG_LEVEL", nullable = false, length = 20)
    private String orgLevel;

    @Column(name = "ACTIVE", nullable = false)
    @Builder.Default
    private Boolean active = true;
}
