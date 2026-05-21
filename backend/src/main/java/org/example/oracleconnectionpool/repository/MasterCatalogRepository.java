package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.MasterCatalog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MasterCatalogRepository extends JpaRepository<MasterCatalog, String>, JpaSpecificationExecutor<MasterCatalog> {

    List<MasterCatalog> findByTypeAndActiveTrueOrderBySortOrderAsc(String type);

    List<MasterCatalog> findByTypeOrderBySortOrderAsc(String type);

    boolean existsById(String id);

    long countByTypeAndActiveTrue(String type);
}
