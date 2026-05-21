package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.GridRow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GridRowRepository extends JpaRepository<GridRow, Long> {

    List<GridRow> findByTemplateIdOrderBySortOrderAsc(Long templateId);

    void deleteByTemplateId(Long templateId);
}
