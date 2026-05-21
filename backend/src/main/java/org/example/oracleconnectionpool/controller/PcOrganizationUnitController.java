package org.example.oracleconnectionpool.controller;

import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.entity.PcOrganizationUnitEntity;
import org.example.oracleconnectionpool.service.PcOrganizationUnitService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping(Api.V1.PC_ORGANIZATION_UNIT)
@RequiredArgsConstructor
public class PcOrganizationUnitController {
    private final PcOrganizationUnitService pcOrganizationUnitService;

    @GetMapping("/search")
    public ResponseEntity<?> getSclCategoryById(@RequestParam("pc") String pc) {
        List<PcOrganizationUnitEntity> response = pcOrganizationUnitService.getPcOrganizationUnitByPc(pc);
        return ResponseEntity.ok(response);
    }
}
