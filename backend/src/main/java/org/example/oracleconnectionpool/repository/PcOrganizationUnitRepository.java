package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.PcOrganizationUnitEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PcOrganizationUnitRepository extends JpaRepository<PcOrganizationUnitEntity, Long> {
    List<PcOrganizationUnitEntity> findPcOrganizationUnitEntityByPcAndActive(String pc, String active);
}
