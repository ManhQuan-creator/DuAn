package org.example.oracleconnectionpool.controller;

import java.util.List;

import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.request.catalogitem.CreateCatalogItemRequest;
import org.example.oracleconnectionpool.model.request.catalogitem.UpdateCatalogItemRequest;
import org.example.oracleconnectionpool.model.request.catalogtype.CreateCatalogTypeRequest;
import org.example.oracleconnectionpool.model.request.catalogtype.FilterCatalogRequest;
import org.example.oracleconnectionpool.model.request.catalogtype.UpdateCatalogTypeRequest;
import org.example.oracleconnectionpool.model.response.CatalogItemResponse;
import org.example.oracleconnectionpool.model.response.CatalogTypeResponse;
import org.example.oracleconnectionpool.service.MasterCatalogService;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RequiredArgsConstructor
@RestController
@RequestMapping(Api.V1.MASTER_DATA)
public class MasterCatalogController {

    private final MasterCatalogService service;

    // === Catalog Items ===

    @GetMapping("/catalogs")
    public ResponseEntity<ResponseData<List<CatalogItemResponse>>> getCatalogs(
            @RequestParam String type,
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        return ResponseEntity.ok(new ResponseData<List<CatalogItemResponse>>().success(service.getCatalogs(type, includeInactive)));
    }

    @PostMapping("/catalogs/search")
    public ResponseEntity<ResponseData<Page<CatalogItemResponse>>> searchCatalog(
            @RequestBody FilterCatalogRequest request) {
        return ResponseEntity.ok(new ResponseData<Page<CatalogItemResponse>>().success(service.search(request)));
    }

    @PostMapping("/catalogs")
    public ResponseEntity<ResponseData<CatalogItemResponse>> createCatalogItem(
            @Valid @RequestBody CreateCatalogItemRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(new ResponseData<CatalogItemResponse>().success(service.createCatalogItem(request)));
    }

    @PutMapping("/catalogs/{id}")
    public ResponseEntity<ResponseData<CatalogItemResponse>> updateCatalogItem(
            @PathVariable String id,
            @Valid @RequestBody UpdateCatalogItemRequest request) {
        return ResponseEntity.ok(new ResponseData<CatalogItemResponse>().success(service.updateCatalogItem(id, request)));
    }

    @DeleteMapping("/catalogs/{id}")
    public ResponseEntity<ResponseData<Void>> deleteCatalogItem(@PathVariable String id) {
        service.deleteCatalogItem(id);
        return ResponseEntity.ok(new ResponseData<Void>().success());
    }

    // === Catalog Types ===

    @GetMapping("/catalog-types")
    public ResponseEntity<ResponseData<List<CatalogTypeResponse>>> getCatalogTypes(
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        return ResponseEntity.ok(new ResponseData<List<CatalogTypeResponse>>().success(service.getCatalogTypes(includeInactive)));
    }

    @PostMapping("/catalog-types")
    public ResponseEntity<ResponseData<CatalogTypeResponse>> createCatalogType(
            @Valid @RequestBody CreateCatalogTypeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(new ResponseData<CatalogTypeResponse>().success(service.createCatalogType(request)));
    }

    @PutMapping("/catalog-types/{id}")
    public ResponseEntity<ResponseData<CatalogTypeResponse>> updateCatalogType(
            @PathVariable Long id,
            @Valid @RequestBody UpdateCatalogTypeRequest request) {
        return ResponseEntity.ok(new ResponseData<CatalogTypeResponse>().success(service.updateCatalogType(id, request)));
    }
    @DeleteMapping("/catalog-types/{id}")
    public ResponseEntity<ResponseData<Void>> deleteCatalogType(@PathVariable Long id) {

        service.deleteCatalogType(id);

        return ResponseEntity.ok(new ResponseData<Void>().success());
    }
}
