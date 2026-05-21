package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.WorkflowSubmitterCandidate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkflowSubmitterCandidateRepository extends JpaRepository<WorkflowSubmitterCandidate, Long> {

    List<WorkflowSubmitterCandidate> findByWorkflowDefinitionId(Long workflowDefinitionId);

    void deleteByWorkflowDefinitionId(Long workflowDefinitionId);

    /**
     * Kiểm tra user có quyền SUBMIT cho quy trình này không.
     */
    @Query("""
        SELECT CASE WHEN COUNT(c) > 0 THEN true ELSE false END
        FROM WorkflowSubmitterCandidate c
        WHERE c.workflowDefinitionId = :wfDefId
          AND (c.subjectOrgCode IS NULL OR c.subjectOrgCode = :deptCode)
          AND (c.subjectPositionCode IS NULL OR c.subjectPositionCode = :positionCode)
    """)
    boolean hasSubmitAccess(
            @Param("wfDefId") Long workflowDefinitionId,
            @Param("deptCode") String deptCode,
            @Param("positionCode") String positionCode);
}
