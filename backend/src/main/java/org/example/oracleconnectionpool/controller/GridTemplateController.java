package org.example.oracleconnectionpool.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.request.gridtemplate.CreateGridTemplateRequest;
import org.example.oracleconnectionpool.model.request.gridtemplate.FilterGridTemplateRequest;
import org.example.oracleconnectionpool.model.request.gridtemplate.UpdateGridTemplateRequest;
import org.example.oracleconnectionpool.model.response.GridTemplateDetailResponse;
import org.example.oracleconnectionpool.model.response.GridTemplateListResponse;
import org.example.oracleconnectionpool.service.GridTemplateService;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RequiredArgsConstructor
@RestController
@RequestMapping(Api.V1.GRID_TEMPLATE)
public class GridTemplateController {

    private final GridTemplateService service;

    @GetMapping
    public ResponseEntity<ResponseData<List<GridTemplateListResponse>>> getTemplates() {
        return ResponseEntity.ok(new ResponseData<List<GridTemplateListResponse>>().success(service.getTemplates()));
    }

    @PostMapping("/search")
    public ResponseEntity<ResponseData<Page<GridTemplateListResponse>>> searchTemplates(
            @RequestBody() FilterGridTemplateRequest request) {
        return ResponseEntity.ok(new ResponseData<Page<GridTemplateListResponse>>().success(service.searchTemplates(request)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResponseData<GridTemplateDetailResponse>> getTemplate(@PathVariable Long id) {
        return ResponseEntity.ok(new ResponseData<GridTemplateDetailResponse>().success(service.getTemplate(id)));
    }

    @PostMapping
    public ResponseEntity<ResponseData<GridTemplateDetailResponse>> createTemplate(
            @Valid @RequestBody CreateGridTemplateRequest request) {
        log.info("Creating grid template: code={}, name={}, rows={}", request.getCode(), request.getName(),
                request.getRows() != null ? request.getRows().size() : 0);
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(new ResponseData<GridTemplateDetailResponse>().success(service.createTemplate(request)));
        } catch (Exception e) {
            log.error("Error creating grid template", e);
            throw e;
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<ResponseData<GridTemplateDetailResponse>> updateTemplate(
            @PathVariable Long id,
            @Valid @RequestBody UpdateGridTemplateRequest request) {
        return ResponseEntity.ok(new ResponseData<GridTemplateDetailResponse>().success(service.updateTemplate(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseData<Void>> deleteTemplate(@PathVariable Long id) {
        service.deleteTemplate(id);
        return ResponseEntity.ok(new ResponseData<Void>().success());
    }

    @PutMapping("/{id}/publish")
    public ResponseEntity<ResponseData<GridTemplateDetailResponse>> publishTemplate(@PathVariable Long id) {
        return ResponseEntity.ok(new ResponseData<GridTemplateDetailResponse>().success(service.publishTemplate(id)));
    }

    @PostMapping("/{id}/copy")
    public ResponseEntity<ResponseData<GridTemplateDetailResponse>> copyTemplate(@PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new ResponseData<GridTemplateDetailResponse>().success(service.copyTemplate(id)));
    }
}
