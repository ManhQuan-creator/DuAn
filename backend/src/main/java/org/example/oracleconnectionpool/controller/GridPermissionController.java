package org.example.oracleconnectionpool.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.request.gridpermission.GridPermissionRequest;
import org.example.oracleconnectionpool.model.response.GridPermissionResponse;
import org.example.oracleconnectionpool.model.response.grid.GridPermissionUpdateResponse;
import org.example.oracleconnectionpool.service.GridPermissionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping(Api.V1.GRID_TEMPLATE + "/{templateId}/permissions")
public class GridPermissionController {

    private final GridPermissionService service;

    @GetMapping
    public ResponseEntity<ResponseData<List<GridPermissionResponse>>> getPermissions(
            @PathVariable Long templateId) {
        return ResponseEntity.ok(new ResponseData<List<GridPermissionResponse>>()
        .success(service.getPermissions(templateId)));
    }

    @PostMapping
    public ResponseEntity<ResponseData<GridPermissionUpdateResponse>> savePermission(
            @PathVariable Long templateId,
            @Valid @RequestBody GridPermissionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(new ResponseData<GridPermissionUpdateResponse>()
        .success(service.savePermission(templateId, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseData<Void>> deletePermission(
            @PathVariable Long templateId,
            @PathVariable Long id) {
        service.deletePermission(id);
        return ResponseEntity.ok(new ResponseData<Void>().success());
    }
}
