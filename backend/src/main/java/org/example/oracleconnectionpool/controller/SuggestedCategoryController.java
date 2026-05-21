package org.example.oracleconnectionpool.controller;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.model.request.IdsDTO;
import org.example.oracleconnectionpool.model.request.suggestedcategory.SuggestedCategoryFilterDTO;
import org.example.oracleconnectionpool.model.request.suggestedcategory.SuggestedCategoryRequestDTO;
import org.example.oracleconnectionpool.model.response.suggestedcategory.SuggestedCategoryResponseDTO;
import org.example.oracleconnectionpool.service.SuggestedCategoryService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(Api.V1.SUGGESTED_CATEGORY)
@RequiredArgsConstructor
public class SuggestedCategoryController {
    private final SuggestedCategoryService suggestedCategoryService;
    @PostMapping("/create")
    public ResponseEntity<?> saveSclCategory(@Valid @RequestBody SuggestedCategoryRequestDTO requestDTO) {
        Long id = suggestedCategoryService.save(requestDTO);
        return ResponseEntity.ok(id);
    }

    @PostMapping("/update")
    public ResponseEntity<?> updateSclCategory(
            @Valid @RequestBody SuggestedCategoryRequestDTO requestDTO) {
        Long id = suggestedCategoryService.update(requestDTO);
        return ResponseEntity.ok(id);
    }

    @PostMapping("/delete")
    public ResponseEntity<?> deleteSclCategory(@Valid @RequestBody IdsDTO idsDTO) {
        suggestedCategoryService.delete(idsDTO);
        return ResponseEntity.ok(idsDTO.getIds());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getSclCategoryById(
            @PathVariable Long id) {
        SuggestedCategoryResponseDTO response = suggestedCategoryService.getById(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchSclCategory(@ModelAttribute SuggestedCategoryFilterDTO requestDTO) {
        Page<SuggestedCategoryResponseDTO> page = suggestedCategoryService.search(requestDTO);
        return ResponseEntity.ok(page);
    }

    @PostMapping("/export")
    public void exportParam(@RequestBody SuggestedCategoryFilterDTO filter, HttpServletResponse response) {
        suggestedCategoryService.exportExcel(filter, response);
    }
}
