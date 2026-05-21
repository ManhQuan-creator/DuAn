package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.WorkflowStepCandidate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkflowStepCandidateRepository extends JpaRepository<WorkflowStepCandidate, Long> {

    List<WorkflowStepCandidate> findByWorkflowStepId(Long workflowStepId);

    void deleteByWorkflowStepId(Long workflowStepId);

    void deleteByWorkflowStepIdIn(List<Long> stepIds);

    /**
     * Tìm usernames eligible cho một workflow step — logic wildcard giống TEMPLATE_ACCESS.
     */
    @Query("""
        SELECT DISTINCT u.username FROM AppUser u
        WHERE u.active = true
          AND EXISTS (
              SELECT 1 FROM WorkflowStepCandidate c
              WHERE c.workflowStepId = :stepId
                AND (c.subjectOrgCode IS NULL OR c.subjectOrgCode = u.deptCode)
                AND (c.subjectPositionCode IS NULL OR c.subjectPositionCode = u.positionCode)
          )
    """)
    List<String> findEligibleUsernames(@Param("stepId") Long stepId);
}
