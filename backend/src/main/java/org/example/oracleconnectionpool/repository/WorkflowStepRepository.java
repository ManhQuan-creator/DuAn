package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.WorkflowStep;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkflowStepRepository extends JpaRepository<WorkflowStep, Long> {

    List<WorkflowStep> findByWorkflowDefinitionIdOrderByStepOrderAsc(Long workflowDefinitionId);

    void deleteByWorkflowDefinitionId(Long workflowDefinitionId);

    java.util.Optional<WorkflowStep> findByWorkflowDefinitionIdAndStepKey(Long workflowDefinitionId, String stepKey);
}
