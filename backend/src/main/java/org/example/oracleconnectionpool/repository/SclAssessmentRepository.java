package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.SclAssessmentEntity;
import org.example.oracleconnectionpool.model.request.sclassessment.SclAssessmentProjection;
import org.example.oracleconnectionpool.model.request.sclassessment.SclAssessmentStatusProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SclAssessmentRepository extends JpaRepository<SclAssessmentEntity, Long>, JpaSpecificationExecutor<SclAssessmentEntity> {

    @Query("""
        SELECT new org.example.oracleconnectionpool.model.request.sclassessment.SclAssessmentProjection(
            a.id,
            a.status,
            a.assessmentDeptCode,
            a.assessmentDeptName
        )
        FROM SclAssessmentEntity a
        WHERE a.categoryId = :categoryId
    """)
    List<SclAssessmentProjection> findByCategoryId(Long categoryId);

    @Query("SELECT new org.example.oracleconnectionpool.model.request.sclassessment.SclAssessmentStatusProjection(a.id, a.status) " +
            "FROM SclAssessmentEntity a WHERE a.categoryId = :categoryIds")
    List<SclAssessmentStatusProjection> findAssessmentByCategoryId(Long categoryIds);
}
