package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "WORKFLOW_STEP_CANDIDATE", indexes = {
        @Index(name = "IDX_WSC_STEP", columnList = "WORKFLOW_STEP_ID")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkflowStepCandidate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "WORKFLOW_STEP_ID", nullable = false)
    private Long workflowStepId;

    /**
     * Mã ban/phòng — null = tất cả ban/phòng.
     * Khớp với AppUser.deptCode.
     */
    @Column(name = "SUBJECT_ORG_CODE", length = 50)
    private String subjectOrgCode;

    /**
     * Mã chức danh — null = tất cả chức danh.
     * Khớp với AppUser.positionCode.
     */
    @Column(name = "SUBJECT_POSITION_CODE", length = 50)
    private String subjectPositionCode;
}
