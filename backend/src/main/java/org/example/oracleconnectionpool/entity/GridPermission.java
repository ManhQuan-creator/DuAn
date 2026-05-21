package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "GRID_PERMISSION", indexes = {
        @Index(name = "IDX_GRID_PERM_TEMPLATE", columnList = "TEMPLATE_ID"),
        @Index(name = "IDX_GRID_PERM_USER", columnList = "USER_ID")
})
public class GridPermission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "TEMPLATE_ID", nullable = false)
    private Long templateId;

    @Column(name = "PERM_LEVEL", nullable = false, length = 10)
    private String level; // COLUMN | ROW | CELL

    @Column(name = "TARGET_FIELD", length = 50)
    private String targetField;

    @Column(name = "TARGET_ROW_CODE", length = 50)
    private String targetRowCode;

    @Column(name = "PERMISSION_TYPE", length = 10)
    @Builder.Default
    private String permissionType = "ALLOW"; // ALLOW | DENY | LOCK

    @Column(name = "USER_ID", length = 50)
    private String userId;

    @Column(name = "ROLE_CODE", length = 50)
    private String roleCode;

    @Column(name = "CREATED_BY", length = 50)
    private String createdBy;

    @Column(name = "CREATED_AT")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
