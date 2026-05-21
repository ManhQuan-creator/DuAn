package org.example.oracleconnectionpool.service;

import org.example.oracleconnectionpool.model.request.IdsDTO;
import org.example.oracleconnectionpool.model.request.sclassessment.RejectRequestDTO;
import org.example.oracleconnectionpool.model.request.sclassessment.ReviseRequestDTO;
import org.example.oracleconnectionpool.model.request.sclassessment.SclAssessmentFilterDTO;
import org.example.oracleconnectionpool.model.response.sclassessment.SclAssessmentDetailResponseDTO;
import org.example.oracleconnectionpool.model.response.sclassessment.SclAssessmentResponseDTO;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.springframework.data.domain.Page;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface SclAssessmentService {
    Page<SclAssessmentResponseDTO> search(SclAssessmentFilterDTO requestFilterDTO, AppUserDetails userDetails);

    SclAssessmentDetailResponseDTO getCategoryById(AppUserDetails userDetail, Long id);

    void approve(AppUserDetails userDetails, Long id);
    void reject(AppUserDetails userDetails, List<MultipartFile> files, RejectRequestDTO request);
    void revise(AppUserDetails userDetails, ReviseRequestDTO request);
}
