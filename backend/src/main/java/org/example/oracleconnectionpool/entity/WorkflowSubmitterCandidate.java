package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Khai báo ai được gửi duyệt (SUBMIT) cho quy trình này.
 * Liên kết trực tiếp với WORKFLOW_DEFINITION (không phải WORKFLOW_STEP).
 *
 * Logic wildcard giống WorkflowStepCandidate:
 *   (subject_org_code IS NULL OR subject_org_code = user.deptCode)
 *   AND (subject_position_code IS NULL OR subject_position_code = user.positionCode)
 */
@Entity
@Table(name = "WORKFLOW_SUBMITTER_CANDIDATE", indexes = {
        @Index(name = "IDX_WSUB_WF_DEF", columnList = "WORKFLOW_DEFINITION_ID")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkflowSubmitterCandidate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "WORKFLOW_DEFINITION_ID", nullable = false)
    private Long workflowDefinitionId;

    /** Mã ban/phòng — null = tất cả. Khớp với AppUser.deptCode. */
    @Column(name = "SUBJECT_ORG_CODE", length = 50)
    private String subjectOrgCode;

    /** Mã chức danh — null = tất cả. Khớp với AppUser.positionCode. */
    @Column(name = "SUBJECT_POSITION_CODE", length = 50)
    private String subjectPositionCode;
}
