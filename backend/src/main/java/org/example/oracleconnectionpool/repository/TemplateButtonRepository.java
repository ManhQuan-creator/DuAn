package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.TemplateButton;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TemplateButtonRepository extends JpaRepository<TemplateButton, Long> {

    List<TemplateButton> findByTemplateIdAndActiveTrueOrderBySortOrderAsc(Long templateId);

    void deleteByTemplateId(Long templateId);

    /** Kiểm tra buttonKey đã tồn tại (active) trên template — dùng cho create */
    boolean existsByTemplateIdAndButtonKeyAndActiveTrue(Long templateId, String buttonKey);
}
