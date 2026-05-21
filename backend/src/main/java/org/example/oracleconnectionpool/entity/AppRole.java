package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "APP_ROLE")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppRole extends AbstractAuditingTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ROLE_CODE", unique = true, nullable = false, length = 50)
    private String roleCode;

    @Column(name = "ROLE_NAME", length = 100)
    private String roleName;

    @Column(name = "DESCRIPTION", length = 500)
    private String description;

    @Column(name = "ACTIVE", nullable = false)
    @Builder.Default
    private Boolean active = true;
}
