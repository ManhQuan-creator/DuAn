package org.example.oracleconnectionpool.controller;

import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.response.GridDumpResponse;
import org.example.oracleconnectionpool.service.GridDumpService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Debug endpoint phục vụ AI/dev khảo sát dữ liệu Excel Builder + Render.
 * Trả về JSON gộp: GRID_TEMPLATE.COLUMN_CONFIGS/COLUMN_GROUPS,
 * GRID_ROW của template tương ứng, và GRID_DATA_ENTRY.ROW_DATA.
 */
@RequiredArgsConstructor
@RestController
@RequestMapping(Api.V1.GRID_DEBUG)
public class GridDumpController {

    private final GridDumpService service;

    @GetMapping("/entries/{entryId}")
    public ResponseEntity<ResponseData<GridDumpResponse>> dumpByEntryId(@PathVariable Long entryId) {
        return ResponseEntity.ok(new ResponseData<GridDumpResponse>().success(service.dumpByEntryId(entryId)));
    }

    @GetMapping("/templates/{templateId}")
    public ResponseEntity<ResponseData<GridDumpResponse>> dumpByTemplateId(@PathVariable Long templateId) {
        return ResponseEntity.ok(new ResponseData<GridDumpResponse>().success(service.dumpByTemplateId(templateId)));
    }
}
