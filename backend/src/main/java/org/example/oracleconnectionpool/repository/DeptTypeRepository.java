package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.DeptType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeptTypeRepository extends JpaRepository<DeptType, String> {

    List<DeptType> findAllByOrderBySortOrderAscDeptTypeCodeAsc();

    List<DeptType> findByActiveTrueOrderBySortOrderAscDeptTypeCodeAsc();

    List<DeptType> findByOrgLevelScopeAndActiveTrueOrderBySortOrderAscDeptTypeCodeAsc(String orgLevelScope);

    boolean existsByDeptTypeCode(String deptTypeCode);
}
