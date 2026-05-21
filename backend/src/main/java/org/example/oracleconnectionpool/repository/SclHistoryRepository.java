package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.SclHistoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface SclHistoryRepository extends JpaRepository<SclHistoryEntity, Long>, JpaSpecificationExecutor<SclHistoryEntity> {
}
