package org.example.oracleconnectionpool.service;

import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.entity.Organization;
import org.example.oracleconnectionpool.model.request.organization.CreateOrganizationRequest;
import org.example.oracleconnectionpool.model.request.organization.UpdateOrganizationRequest;
import org.example.oracleconnectionpool.repository.OrganizationRepository;
import org.example.oracleconnectionpool.model.request.organization.SearchOrganizationRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OrganizationService {

    private final OrganizationRepository organizationRepository;

    /**
     * Kiểm tra user có thuộc cấp EVNNPC (Tổng công ty) không.
     * Dùng để xác định scope xem dữ liệu (EVNNPC thấy tất cả, PC chỉ thấy của mình).
     */
    public boolean isEvnnpc(String orgGroupCode) {
        return "EVNNPC".equals(orgGroupCode);
    }

    public List<Organization> getAll() {
        return organizationRepository.findByActiveTrue();
    }

    /** Lấy danh sách các Ban thuộc EVNNPC (HQ_DEPT). */
    public List<Organization> getHqDepts() {
        return organizationRepository.findByOrgLevel("HQ_DEPT").stream()
                .filter(org -> Boolean.TRUE.equals(org.getActive()))
                .toList();
    }

    public List<Organization> getAllOrganizations() {
        return organizationRepository.findAllByOrderByOrgCodeAsc();
    }

    public Organization getById(Long id) {
        return organizationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn vị với ID: " + id));
    }

    public Organization create(CreateOrganizationRequest request) {
        String orgCode = request.getOrgCode().toUpperCase().trim();
        if (organizationRepository.existsByOrgCode(orgCode)) {
            throw new RuntimeException("Mã đơn vị '" + orgCode + "' đã tồn tại");
        }
        Organization org = Organization.builder()
                .orgCode(orgCode)
                .orgName(request.getOrgName().trim())
                .parentOrgCode(request.getParentOrgCode())
                .orgLevel(request.getOrgLevel())
                .active(true)
                .build();
        return organizationRepository.save(org);
    }

    public Organization update(Long id, UpdateOrganizationRequest request) {
        Organization org = getById(id);
        if (request.getOrgName()       != null) org.setOrgName(request.getOrgName().trim());
        if (request.getParentOrgCode() != null) org.setParentOrgCode(request.getParentOrgCode());
        if (request.getOrgLevel()      != null) org.setOrgLevel(request.getOrgLevel());
        if (request.getActive()        != null) org.setActive(request.getActive());
        return organizationRepository.save(org);
    }

    public void delete(Long id) {
        Organization org = getById(id);
        org.setActive(false);
        organizationRepository.save(org);
    }

    public Page<Organization> search(SearchOrganizationRequest request) {
        String kw = StringUtils.hasText(request.getKeyword()) ? request.getKeyword().trim() : null;
        int page = Math.max(0, request.getPageNum() - 1);
        PageRequest pageable = PageRequest.of(page, request.getPageSize());
        return organizationRepository.searchOrganizations(kw, request.getActive(), pageable);
    }
}
