package org.example.oracleconnectionpool.service;

import org.example.oracleconnectionpool.entity.PcOrganizationUnitEntity;

import java.util.List;

public interface PcOrganizationUnitService {
    List<PcOrganizationUnitEntity> getPcOrganizationUnitByPc(String pc);
}
