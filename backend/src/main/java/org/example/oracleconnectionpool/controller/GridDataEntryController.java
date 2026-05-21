package org.example.oracleconnectionpool.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.request.griddataentry.CreateGridDataEntryRequest;
import org.example.oracleconnectionpool.model.request.griddataentry.UpdateGridDataEntryRequest;
import org.example.oracleconnectionpool.model.response.GridDataEntryDetailResponse;
import org.example.oracleconnectionpool.model.response.GridDataEntryListResponse;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.example.oracleconnectionpool.service.GridDataEntryService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping(Api.V1.GRID_TEMPLATE + "/{templateId}/entries")
public class GridDataEntryController {

    private final GridDataEntryService service;

    @GetMapping
    public ResponseEntity<ResponseData<List<GridDataEntryListResponse>>> getEntries(
            @PathVariable Long templateId,
            @RequestParam(required = false) String orgCode,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @AuthenticationPrincipal AppUserDetails currentUser) {
        return ResponseEntity.ok(new ResponseData<List<GridDataEntryListResponse>>().success(service.getEntries(templateId, orgCode, year, month, currentUser)));
    }

    @GetMapping("/{entryId}")
    public ResponseEntity<ResponseData<GridDataEntryDetailResponse>> getEntry(
            @PathVariable Long templateId,
            @PathVariable Long entryId,
            @AuthenticationPrincipal AppUserDetails currentUser) {
        return ResponseEntity.ok(new ResponseData<GridDataEntryDetailResponse>().success(service.getEntry(templateId, entryId, currentUser)));
    }

    @PostMapping
    public ResponseEntity<ResponseData<GridDataEntryDetailResponse>> createEntry(
            @PathVariable Long templateId,
            @Valid @RequestBody CreateGridDataEntryRequest request,
            @AuthenticationPrincipal AppUserDetails currentUser) {
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(new ResponseData<GridDataEntryDetailResponse>()
            .success(service.createEntry(templateId, request, currentUser)));
    }

    @PutMapping("/{entryId}")
    public ResponseEntity<ResponseData<GridDataEntryDetailResponse>> updateEntry(
            @PathVariable Long templateId,
            @PathVariable Long entryId,
            @Valid @RequestBody UpdateGridDataEntryRequest request,
            @AuthenticationPrincipal AppUserDetails currentUser) {
        return ResponseEntity.ok(new ResponseData<GridDataEntryDetailResponse>().success(service.updateEntry(templateId, entryId, request, currentUser)));
    }

    @DeleteMapping("/{entryId}")
    public ResponseEntity<ResponseData<Void>> deleteEntry(
            @PathVariable Long entryId,
            @AuthenticationPrincipal AppUserDetails currentUser) {
        service.deleteEntry(entryId, currentUser);
        return ResponseEntity.ok(new ResponseData<Void>().success());
    }
}
