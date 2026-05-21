package org.example.oracleconnectionpool.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;

import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.request.gridtemplate.BatchLookupRequest;
import org.example.oracleconnectionpool.model.request.gridtemplate.LookupRequest;
import org.example.oracleconnectionpool.model.response.LookupResponse;
import org.example.oracleconnectionpool.service.DataLookupService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping(Api.V1.DATA_LOOKUP)
public class DataLookupController {

    private final DataLookupService lookupService;

    @GetMapping
    public ResponseEntity<ResponseData<LookupResponse>> lookup(
            @RequestParam String templateCode,
            @RequestParam Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) String orgCode,
            @RequestParam(required = false) String rowCode,
            @RequestParam String columns) {

        LookupRequest request = new LookupRequest();
        request.setTemplateCode(templateCode);
        request.setYear(year);
        request.setMonth(month);
        request.setOrgCode(orgCode);
        request.setRowCode(rowCode);
        request.setColumns(Arrays.asList(columns.split(",")));

        LookupResponse response = lookupService.lookup(request);
        return ResponseEntity.ok(new ResponseData<LookupResponse>().success(response));
    }

    @PostMapping("/batch")
    public ResponseEntity<ResponseData<List<LookupResponse>>> batchLookup(
            @Valid @RequestBody BatchLookupRequest request) {
        List<LookupResponse> responses = lookupService.batchLookup(request.getRequests());
        return ResponseEntity.ok(new ResponseData<List<LookupResponse>>().success(responses));
    }
}
