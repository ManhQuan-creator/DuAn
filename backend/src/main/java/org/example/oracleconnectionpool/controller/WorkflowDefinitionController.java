package org.example.oracleconnectionpool.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.request.workflow.CreateWorkflowDefinitionRequest;
import org.example.oracleconnectionpool.model.request.workflow.UpdateWorkflowDefinitionRequest;
import org.example.oracleconnectionpool.model.request.workflow.XmlBpmnRequest;
import org.example.oracleconnectionpool.model.response.WorkflowDefinitionDetailResponse;
import org.example.oracleconnectionpool.model.response.WorkflowDefinitionListResponse;
import org.example.oracleconnectionpool.model.response.XmlValidateResponse;
import org.example.oracleconnectionpool.service.WorkflowDefinitionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RequiredArgsConstructor
@RestController
@RequestMapping(Api.V1.WORKFLOW_DEFINITIONS)
public class WorkflowDefinitionController {

    private final Logger logger =  LoggerFactory.getLogger(WorkflowDefinitionController.class);
    private final WorkflowDefinitionService service;

    @GetMapping
    public ResponseEntity<ResponseData<List<WorkflowDefinitionListResponse>>> getAll() {
        return ResponseEntity.ok(new ResponseData<List<WorkflowDefinitionListResponse>>().success(service.getAll()));
    }

    
    @GetMapping("/search")
    public ResponseEntity<ResponseData<Page<WorkflowDefinitionListResponse>>> search(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer pageSize
    ) {
        return ResponseEntity.ok(
                new ResponseData<Page<WorkflowDefinitionListResponse>>().success(
                        service.search(keyword, status, pageNum, pageSize)
                )
        );
    }

    @GetMapping("/deployed")
    public ResponseEntity<ResponseData<List<WorkflowDefinitionListResponse>>> getDeployed() {
        return ResponseEntity.ok(new ResponseData<List<WorkflowDefinitionListResponse>>().success(service.getDeployed()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResponseData<WorkflowDefinitionDetailResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(new ResponseData<WorkflowDefinitionDetailResponse>().success(service.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ResponseData<WorkflowDefinitionDetailResponse>> create(
            @Valid @RequestBody CreateWorkflowDefinitionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(new ResponseData<WorkflowDefinitionDetailResponse>().success(service.create(request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ResponseData<WorkflowDefinitionDetailResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateWorkflowDefinitionRequest request) {
        return ResponseEntity.ok(new ResponseData<WorkflowDefinitionDetailResponse>().success(service.update(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseData<Void>> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.ok(new ResponseData<Void>().success());
    }

    @PostMapping("/{id}/deploy")
    public ResponseEntity<?> deploy(@PathVariable Long id) {
        return ResponseEntity.ok(new ResponseData<WorkflowDefinitionDetailResponse>().success(service.deploy(id)));
    }

    @PostMapping("/{id}/validate-xml")
    public ResponseEntity<ResponseData<XmlValidateResponse>> validateXml(
            @PathVariable Long id,
            @Valid @RequestBody XmlBpmnRequest request
    ) {
        return ResponseEntity.ok(
                new ResponseData<XmlValidateResponse>().success(service.validateXml(id, request.getBpmnXml()))
        );
    }

}
