package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.GridTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GridTemplateRepository extends JpaRepository<GridTemplate, Long>, JpaSpecificationExecutor<GridTemplate> {

    Optional<GridTemplate> findByCode(String code);

    boolean existsByCode(String code);

    @Query("SELECT g.code FROM GridTemplate g WHERE g.id = :id")
    String findCodeById(@Param("id") Long id);

    @Query("SELECT t FROM GridTemplate t WHERE " +
           "(:keyword IS NULL OR LOWER(t.name) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(t.code) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "AND (:status IS NULL OR t.status = :status) " +
           "ORDER BY t.updatedAt DESC")
    List<GridTemplate> searchTemplates(@Param("keyword") String keyword, @Param("status") String status);
}
