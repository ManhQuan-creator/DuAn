package org.example.oracleconnectionpool.service;

import jakarta.servlet.http.HttpServletResponse;
import org.example.oracleconnectionpool.model.request.IdsDTO;
import org.example.oracleconnectionpool.model.request.griddataentry.CreateGridDataEntryRequest;
import org.example.oracleconnectionpool.model.request.sclcategory.SclCategoryFilterDTO;
import org.example.oracleconnectionpool.model.request.sclcategory.SclCategoryRequestDTO;
import org.example.oracleconnectionpool.model.response.sclcategory.SclCategoryResponseDTO;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.example.oracleconnectionpool.utils.GridRowExtractor;
import org.springframework.data.domain.Page;

public interface SclCategoryService {

    Page<SclCategoryResponseDTO> search(SclCategoryFilterDTO request, AppUserDetails userDetails);

    SclCategoryResponseDTO getById(AppUserDetails userDetail, Long id);

    void sendAssessment(IdsDTO idsDTO);

    Long save(SclCategoryRequestDTO request,AppUserDetails userDetails);

    Long update(SclCategoryRequestDTO request, AppUserDetails user);

    void delete(IdsDTO idsDTO);

    void exportExcel(SclCategoryFilterDTO filter, AppUserDetails userDetails, HttpServletResponse response);

    void exportReport(SclCategoryFilterDTO filter, AppUserDetails userDetails, HttpServletResponse response);

    void sendApprove(IdsDTO ids, AppUserDetails user);

    void approve(IdsDTO ids, AppUserDetails user);

    void reject(IdsDTO ids, AppUserDetails user);

    void updateStatus(IdsDTO ids);
    Long planSummary(Long templateId, CreateGridDataEntryRequest request, AppUserDetails user);

}
