package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.MasterCatalogType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MasterCatalogTypeRepository extends JpaRepository<MasterCatalogType, Long> {

    List<MasterCatalogType> findByActiveTrueOrderBySortOrderAsc();

    List<MasterCatalogType> findAllByOrderBySortOrderAsc();

    Optional<MasterCatalogType> findByType(String type);

    boolean existsByType(String type);
}
