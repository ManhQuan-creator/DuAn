package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.SclCategoryEntity;
import org.example.oracleconnectionpool.model.response.sclcategory.OrgDataEntryProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SclCategoryRepository extends JpaRepository<SclCategoryEntity, Long>, JpaSpecificationExecutor<SclCategoryEntity> {

    @Query("SELECT COUNT(sc) > 0 FROM SclCategoryEntity sc WHERE sc.categoryCode = :categoryCode " +
            "AND (:excludeId IS NULL OR sc.id <> :excludeId) ")
    boolean existsByCategoryCode(String categoryCode, Long excludeId);

    @Query("SELECT sc FROM SclCategoryEntity sc WHERE sc.id IN :ids")
    List<SclCategoryEntity> findByIdIn(List<Long> ids);

    @Modifying
    @Query("UPDATE SclCategoryEntity sc SET sc.status = :status, sc.unitReceiveAssessment = :unitReceiveAssessment, sc.updatedAt = :updatedAt WHERE sc.id IN :ids")
    void sendAssessment(List<Long> ids, String unitReceiveAssessment, String status, LocalDateTime updatedAt);
}
