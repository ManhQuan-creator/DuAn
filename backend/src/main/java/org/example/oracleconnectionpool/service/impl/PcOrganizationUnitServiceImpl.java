package org.example.oracleconnectionpool.service.impl;

import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.entity.PcOrganizationUnitEntity;
import org.example.oracleconnectionpool.enums.ActiveEnum;
import org.example.oracleconnectionpool.repository.PcOrganizationUnitRepository;
import org.example.oracleconnectionpool.service.PcOrganizationUnitService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PcOrganizationUnitServiceImpl implements PcOrganizationUnitService {
    private final PcOrganizationUnitRepository pcOrganizationUnitRepository;

    @Override
    public List<PcOrganizationUnitEntity> getPcOrganizationUnitByPc(String pc) {
        return pcOrganizationUnitRepository.findPcOrganizationUnitEntityByPcAndActive(pc, ActiveEnum.ACTIVE.getKey());
    }
}
