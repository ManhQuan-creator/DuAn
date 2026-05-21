package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.WorkflowDefinition;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WorkflowDefinitionRepository extends JpaRepository<WorkflowDefinition, Long> {

    Optional<WorkflowDefinition> findByWorkflowKey(String workflowKey);

    boolean existsByWorkflowKey(String workflowKey);

    List<WorkflowDefinition> findByStatus(String status);

    @Query("""
        select w
        from WorkflowDefinition w
        where (:status is null or upper(w.status) = upper(:status))
          and (
            :keyword is null
            or :keyword = ''
            or lower(w.name) like lower(concat('%', :keyword, '%'))
            or lower(w.workflowKey) like lower(concat('%', :keyword, '%'))
          )
        order by w.updatedAt desc
        """)
    Page<WorkflowDefinition> search(@Param("keyword") String keyword,
                                   @Param("status") String status,
                                   Pageable pageable);
}
