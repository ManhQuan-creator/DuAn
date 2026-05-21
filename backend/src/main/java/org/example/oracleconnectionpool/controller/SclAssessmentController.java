package org.example.oracleconnectionpool.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.request.IdsDTO;
import org.example.oracleconnectionpool.model.request.sclassessment.RejectRequestDTO;
import org.example.oracleconnectionpool.model.request.sclassessment.ReviseRequestDTO;
import org.example.oracleconnectionpool.model.request.sclassessment.SclAssessmentFilterDTO;
import org.example.oracleconnectionpool.model.response.sclassessment.SclAssessmentDetailResponseDTO;
import org.example.oracleconnectionpool.model.response.sclassessment.SclAssessmentResponseDTO;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.example.oracleconnectionpool.service.SclAssessmentService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping(Api.V1.SCL_ASSESSMENT)
@RequiredArgsConstructor
public class SclAssessmentController {
    private final SclAssessmentService sclAssessmentService;

    @PostMapping("/search")
    public ResponseEntity<ResponseData<Page<SclAssessmentResponseDTO>>> search(
            @AuthenticationPrincipal AppUserDetails userDetails,
            @RequestBody SclAssessmentFilterDTO requestDTO) {
        Page<SclAssessmentResponseDTO> page = sclAssessmentService.search(requestDTO, userDetails);
        return ResponseEntity.ok(new ResponseData<Page<SclAssessmentResponseDTO>>().success(page));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResponseData<SclAssessmentDetailResponseDTO>> getSclCategoryByAssessmentId(
            @AuthenticationPrincipal AppUserDetails userDetails,
            @PathVariable Long id) {
        SclAssessmentDetailResponseDTO response = sclAssessmentService.getCategoryById(userDetails, id);
        return ResponseEntity.ok(new ResponseData<SclAssessmentDetailResponseDTO>().success(response));
    }

    @PostMapping("approve")
    public ResponseEntity<ResponseData<Void>> approve(
            @AuthenticationPrincipal AppUserDetails userDetails,
            @RequestParam Long id) {

        sclAssessmentService.approve(userDetails, id);
        return ResponseEntity.ok(new ResponseData<Void>().success(null));
    }

    @PostMapping("reject")
    public ResponseEntity<ResponseData<Void>> reject(
            @AuthenticationPrincipal AppUserDetails userDetails,
            @RequestPart(value = "files", required = false) List<MultipartFile> files,
            @RequestPart("request") @Valid RejectRequestDTO request) {

        sclAssessmentService.reject(userDetails, files, request);
        return ResponseEntity.ok(new ResponseData<Void>().success(null));
    }

    @PostMapping("revise")
    public ResponseEntity<ResponseData<Void>> revise(
            @AuthenticationPrincipal AppUserDetails userDetails,
            @RequestBody ReviseRequestDTO request) {

        sclAssessmentService.revise(userDetails, request);
        return ResponseEntity.ok(new ResponseData<Void>().success(null));
    }
}
