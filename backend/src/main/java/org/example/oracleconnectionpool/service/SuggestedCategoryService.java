package org.example.oracleconnectionpool.service;

import jakarta.servlet.http.HttpServletResponse;
import org.example.oracleconnectionpool.model.request.IdsDTO;
import org.example.oracleconnectionpool.model.request.suggestedcategory.SuggestedCategoryFilterDTO;
import org.example.oracleconnectionpool.model.request.suggestedcategory.SuggestedCategoryRequestDTO;
import org.example.oracleconnectionpool.model.response.suggestedcategory.SuggestedCategoryResponseDTO;
import org.springframework.data.domain.Page;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface SuggestedCategoryService {
    List<SuggestedCategoryResponseDTO> getAll();

    Page<SuggestedCategoryResponseDTO> search(SuggestedCategoryFilterDTO request);

    SuggestedCategoryResponseDTO getById(Long id);

    @Transactional
    Long save(SuggestedCategoryRequestDTO request);

    @Transactional
    Long update(SuggestedCategoryRequestDTO request);

    @Transactional
    void delete(IdsDTO idsDTO);

    void exportExcel(SuggestedCategoryFilterDTO filter, HttpServletResponse response);
}
