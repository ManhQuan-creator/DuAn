package org.example.oracleconnectionpool.controller;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.request.IdsDTO;
import org.example.oracleconnectionpool.model.request.griddataentry.CreateGridDataEntryRequest;
import org.example.oracleconnectionpool.model.request.sclcategory.SclCategoryFilterDTO;
import org.example.oracleconnectionpool.model.request.sclcategory.SclCategoryRequestDTO;
import org.example.oracleconnectionpool.model.request.sqlhistory.FilterSclHistoryRequest;
import org.example.oracleconnectionpool.model.response.GridDataEntryDetailResponse;
import org.example.oracleconnectionpool.model.response.sqlhistory.SclHistoryResponse;
import org.example.oracleconnectionpool.model.response.sclcategory.SclCategoryResponseDTO;
import org.example.oracleconnectionpool.model.response.sqlhistory.SclHistoryResponse;
import org.example.oracleconnectionpool.entity.SclCategoryEntity;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.example.oracleconnectionpool.service.SclCategoryService;
import org.example.oracleconnectionpool.service.SclHistoryService;
import org.example.oracleconnectionpool.utils.GridRowExtractor;
import org.example.oracleconnectionpool.service.impl.SclCategoryExtractor;
import org.example.oracleconnectionpool.utils.ObjectMapperUtils;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping(Api.V1.SCL_CATEGORY)
@RequiredArgsConstructor
public class SclCategoryController {
    private final SclCategoryService sclCategoryService;
    private final SclHistoryService sclHistoryService;
    private final SclCategoryExtractor sclCategoryExtractor;

    @PostMapping("/create")
    public ResponseEntity<?> saveSclCategory(
            @AuthenticationPrincipal AppUserDetails userDetails,
            @Valid @RequestBody SclCategoryRequestDTO requestDTO) {
        Long id = sclCategoryService.save(requestDTO, userDetails);
        return ResponseEntity.ok(id);
    }

    @PostMapping("/update")
    public ResponseEntity<?> updateSclCategory(
            @Valid @RequestBody SclCategoryRequestDTO requestDTO, @AuthenticationPrincipal AppUserDetails userDetails) {
        Long id = sclCategoryService.update(requestDTO, userDetails);
        return ResponseEntity.ok(id);
    }

    @PostMapping("/delete")
    public ResponseEntity<?> deleteSclCategory(@RequestBody IdsDTO idsDTO) {
        sclCategoryService.delete(idsDTO);
        return ResponseEntity.ok(idsDTO.getIds());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getSclCategoryById(
            @AuthenticationPrincipal AppUserDetails userDetails,
            @PathVariable Long id) {
        SclCategoryResponseDTO response = sclCategoryService.getById(userDetails, id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchSclCategory(@ModelAttribute SclCategoryFilterDTO requestDTO, @AuthenticationPrincipal AppUserDetails userDetails) {
        Page<SclCategoryResponseDTO> page = sclCategoryService.search(requestDTO, userDetails);
        return ResponseEntity.ok(page);
    }

    @PostMapping("/history-search")
    public ResponseEntity<ResponseData<Page<SclHistoryResponse>>> searchHistory(@RequestBody FilterSclHistoryRequest request){
        return ResponseEntity.ok(new ResponseData<Page<SclHistoryResponse>>().success(sclHistoryService.searchHistory(request)));
    }

    @PostMapping("/mark-search")
    public ResponseEntity<ResponseData<Page<SclHistoryResponse>>> searchMarkCHI(@RequestBody FilterSclHistoryRequest request){
        return ResponseEntity.ok(new ResponseData<Page<SclHistoryResponse>>().success(sclHistoryService.searchHistory(request)));
    }

    @PostMapping("/send-assessment")
    public void sendAssessment(@RequestBody IdsDTO idsDTO) {
        sclCategoryService.sendAssessment(idsDTO);
    }

    @PostMapping("/export")
    public void exportParam(@RequestBody SclCategoryFilterDTO filter, @AuthenticationPrincipal AppUserDetails userDetails, HttpServletResponse response) {
        sclCategoryService.exportExcel(filter, userDetails, response);
    }

    @PostMapping("/send-approve")
    public ResponseEntity<?> sendApprove(@RequestBody IdsDTO idsDTO, @AuthenticationPrincipal AppUserDetails userDetails) {
        sclCategoryService.sendApprove(idsDTO, userDetails);
        return ResponseEntity.ok(idsDTO.getIds());
    }

    @PostMapping("/approve")
    public ResponseEntity<?> approve(@RequestBody IdsDTO idsDTO, @AuthenticationPrincipal AppUserDetails userDetails) {
        sclCategoryService.approve(idsDTO, userDetails);
        return ResponseEntity.ok(idsDTO.getIds());
    }

    @PostMapping("/reject")
    public ResponseEntity<?> reject(@RequestBody IdsDTO idsDTO, @AuthenticationPrincipal AppUserDetails userDetails) {
        sclCategoryService.reject(idsDTO, userDetails);
        return ResponseEntity.ok(idsDTO.getIds());
    }

    @PostMapping("/update-status")
    public ResponseEntity<?> updateStatus(@RequestBody IdsDTO idsDTO) {
        sclCategoryService.updateStatus(idsDTO);
        return ResponseEntity.ok(idsDTO.getIds());
    }

    @PostMapping("/plan-summary")
    public ResponseEntity<?> createEntry(
            @RequestParam Long templateId,
            @Valid @RequestBody CreateGridDataEntryRequest request,
            @AuthenticationPrincipal AppUserDetails currentUser) {
        sclCategoryService.planSummary(templateId, request, currentUser);
        return ResponseEntity.ok("thêm mới thành công");
    }

    /**
     * Debug preview: trích xuất {@link SclCategoryResponseDTO} từ entry rowData (template
     * 344 / PL159) — KHÔNG persist DB. Dùng để verify logic mapping trước khi hook vào
     * flow approve thực sự.
     */
    @GetMapping("/extract-preview/{entryId}")
    public ResponseEntity<List<SclCategoryResponseDTO>> extractPreview(@PathVariable Long entryId) {
        List<SclCategoryEntity> entities = sclCategoryExtractor.extract(entryId);
        List<SclCategoryResponseDTO> dtos = entities.stream()
                .map(e -> ObjectMapperUtils.map(e, SclCategoryResponseDTO.class))
                .toList();
        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/export-report")
    public void exportReport(@RequestBody SclCategoryFilterDTO filter, @AuthenticationPrincipal AppUserDetails userDetails, HttpServletResponse response) {
        sclCategoryService.exportReport(filter, userDetails, response);
    }
}
