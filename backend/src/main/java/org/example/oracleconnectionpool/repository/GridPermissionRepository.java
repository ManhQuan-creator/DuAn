package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.GridPermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GridPermissionRepository extends JpaRepository<GridPermission, Long> {

    List<GridPermission> findByTemplateId(Long templateId);

    void deleteByTemplateId(Long templateId);
}
