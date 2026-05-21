package org.example.oracleconnectionpool.repository.custom;

import org.example.oracleconnectionpool.model.request.sclcategory.SclCategoryFilterDTO;
import org.example.oracleconnectionpool.model.response.sclcategory.SclCategoryResponseDTO;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.springframework.data.domain.Page;

import java.util.List;

public interface SclCategoryRepositoryCustom {
    Page<SclCategoryResponseDTO> search(SclCategoryFilterDTO req, AppUserDetails user);

    List<SclCategoryResponseDTO> searchForExport(SclCategoryFilterDTO req, AppUserDetails user);
}
