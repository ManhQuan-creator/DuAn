package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.PcCompany;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PcCompanyRepository extends JpaRepository<PcCompany, String> {

    List<PcCompany> findByActiveTrueOrderByCompanyCodeAsc();

    List<PcCompany> findAllByOrderByCompanyCodeAsc();

    boolean existsByCompanyCode(String companyCode);
}
