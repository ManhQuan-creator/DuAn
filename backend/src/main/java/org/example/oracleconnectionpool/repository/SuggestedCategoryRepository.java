package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.SclCategoryEntity;
import org.example.oracleconnectionpool.entity.SuggestedCategoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SuggestedCategoryRepository extends JpaRepository<SuggestedCategoryEntity, Long>, JpaSpecificationExecutor<SuggestedCategoryEntity> {
    @Query("SELECT COUNT(sc) > 0 FROM SuggestedCategoryEntity sc WHERE sc.categoryCode = :categoryCode " +
            "AND (:excludeId IS NULL OR sc.id <> :excludeId) ")
    boolean existsByAssetCode(String categoryCode, Long excludeId);

    @Query("SELECT sc FROM SuggestedCategoryEntity sc WHERE sc.id IN :ids")
    List<SuggestedCategoryEntity> findByIdIn(List<Long> ids);
}
