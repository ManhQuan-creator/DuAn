package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.SclMarkEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface SclMarkRepository extends JpaRepository<SclMarkEntity, Long>, JpaSpecificationExecutor<SclMarkEntity> {
}
