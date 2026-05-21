package org.example.oracleconnectionpool.service;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.entity.AppUser;
import org.example.oracleconnectionpool.entity.Position;
import org.example.oracleconnectionpool.entity.TemplateAccess;
import org.example.oracleconnectionpool.model.request.templateaccess.CreateTemplateAccessRequest;
import org.example.oracleconnectionpool.model.request.templateaccess.SearchTemplateAccessRequest;
import org.example.oracleconnectionpool.model.request.templateaccess.UpdateTemplateAccessRequest;
import org.example.oracleconnectionpool.model.response.TemplateAccessResponse;
import org.example.oracleconnectionpool.repository.AppUserRepository;
import org.example.oracleconnectionpool.repository.OrganizationRepository;
import org.example.oracleconnectionpool.repository.PositionRepository;
import org.example.oracleconnectionpool.repository.TemplateAccessRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class TemplateAccessService {

    private final TemplateAccessRepository templateAccessRepository;
    private final AppUserRepository        appUserRepository;
    private final OrganizationRepository   organizationRepository;
    private final PositionRepository       positionRepository;

    public Page<TemplateAccessResponse> search(SearchTemplateAccessRequest req) {
        Specification<TemplateAccess> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isTrue(root.get("active")));

            if (req.getTemplateId() != null) {
                predicates.add(cb.equal(root.get("templateId"), req.getTemplateId()));
            }

            if (req.getKeyword() != null && !req.getKeyword().isBlank()) {
                String like = "%" + req.getKeyword().trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("actionKey")),          like),
                    cb.like(cb.lower(root.get("subjectOrgCode")),     like),
                    cb.like(cb.lower(root.get("subjectPositionCode")), like)
                ));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        // pageNum từ FE bắt đầu từ 0 (Spring Page cũng 0-based)
        int page = Math.max(0, req.getPageNum() - 1);
        PageRequest pageable = PageRequest.of(page, req.getPageSize(), Sort.by("id").ascending());
        return templateAccessRepository.findAll(spec, pageable).map(this::toResponse);
    }

    public List<TemplateAccessResponse> getAll() {
        return templateAccessRepository.findAllByActiveTrue().stream()
                .map(this::toResponse)
                .toList();
    }

    public List<TemplateAccessResponse> getByTemplateId(Long templateId) {
        return templateAccessRepository.findByTemplateIdAndActiveTrue(templateId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public TemplateAccessResponse create(CreateTemplateAccessRequest req) {
        String currentUser     = SecurityContextHolder.getContext().getAuthentication().getName();
        String actionKey       = normalizeUpper(req.getActionKey());
        String subjectOrgCode  = normalizeUpperOrNull(req.getSubjectOrgCode());
        String subjectPosCode  = normalizeUpperOrNull(req.getSubjectPositionCode());

        if (actionKey.isBlank()) {
            throw new RuntimeException("actionKey không được để trống");
        }
        // if (subjectOrgCode == null && subjectPosCode == null) {
        //     throw new RuntimeException("Phải chỉ định ít nhất một điều kiện: subjectOrgCode hoặc subjectPositionCode");
        // }

        // Validate
        if (subjectOrgCode != null && organizationRepository.findByOrgCode(subjectOrgCode).isEmpty()) {
            throw new RuntimeException("Mã ban/phòng '" + subjectOrgCode + "' không tồn tại trong ORGANIZATION");
        }
        if (subjectPosCode != null) {
            Position pos = positionRepository.findByPositionCode(subjectPosCode)
                    .orElseThrow(() -> new RuntimeException("Không tồn tại chức danh: " + subjectPosCode));
            if (!Boolean.TRUE.equals(pos.getActive())) {
                throw new RuntimeException("Chức danh đang bị vô hiệu hóa: " + subjectPosCode);
            }
        }

        // Kiểm tra trùng lặp
        boolean duplicated = templateAccessRepository.findByTemplateIdAndActiveTrue(req.getTemplateId()).stream()
                .anyMatch(ta ->
                    actionKey.equals(ta.getActionKey())
                    && nullSafeEquals(subjectOrgCode, ta.getSubjectOrgCode())
                    && nullSafeEquals(subjectPosCode, ta.getSubjectPositionCode()));
        if (duplicated) {
            throw new RuntimeException("Rule phân quyền đã tồn tại");
        }

        TemplateAccess access = TemplateAccess.builder()
                .templateId(req.getTemplateId())
                .actionKey(actionKey)
                .subjectOrgCode(subjectOrgCode)
                .subjectPositionCode(subjectPosCode)
                .active(true)
                .build();

        return toResponse(templateAccessRepository.save(access));
    }

    @Transactional
    public TemplateAccessResponse update(Long id, UpdateTemplateAccessRequest req) {
        TemplateAccess access = templateAccessRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy rule phân quyền: " + id));

        String actionKey      = normalizeUpper(req.getActionKey());
        String subjectOrgCode = normalizeUpperOrNull(req.getSubjectOrgCode());
        String subjectPosCode = normalizeUpperOrNull(req.getSubjectPositionCode());

        if (actionKey.isBlank()) {
            throw new RuntimeException("actionKey không được để trống");
        }

        // Validate org
        if (subjectOrgCode != null && organizationRepository.findByOrgCode(subjectOrgCode).isEmpty()) {
            throw new RuntimeException("Mã ban/phòng '" + subjectOrgCode + "' không tồn tại trong ORGANIZATION");
        }
        // Validate position
        if (subjectPosCode != null) {
            Position pos = positionRepository.findByPositionCode(subjectPosCode)
                    .orElseThrow(() -> new RuntimeException("Không tồn tại chức danh: " + subjectPosCode));
            if (!Boolean.TRUE.equals(pos.getActive())) {
                throw new RuntimeException("Chức danh đang bị vô hiệu hóa: " + subjectPosCode);
            }
        }

        // Kiểm tra trùng lặp (trừ chính nó)
        boolean duplicated = templateAccessRepository.findByTemplateIdAndActiveTrue(access.getTemplateId()).stream()
                .anyMatch(ta ->
                        !ta.getId().equals(id)
                        && actionKey.equals(ta.getActionKey())
                        && nullSafeEquals(subjectOrgCode, ta.getSubjectOrgCode())
                        && nullSafeEquals(subjectPosCode, ta.getSubjectPositionCode()));
        if (duplicated) {
            throw new RuntimeException("Rule phân quyền đã tồn tại");
        }

        access.setActionKey(actionKey);
        access.setSubjectOrgCode(subjectOrgCode);
        access.setSubjectPositionCode(subjectPosCode);
        return toResponse(templateAccessRepository.save(access));
    }

    @Transactional
    public void delete(Long id) {
        TemplateAccess access = templateAccessRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy rule phân quyền: " + id));
        access.setActive(false);
        templateAccessRepository.save(access);
    }

    @Transactional
    public void deleteAllByTemplateId(Long templateId) {
        templateAccessRepository.deleteByTemplateId(templateId);
    }

    /** Kiểm tra có tồn tại rule phân quyền nào cho actionKey trên template không. */
    public boolean existsAnyRule(Long templateId, String actionKey) {
        return templateAccessRepository.existsAnyRule(templateId, actionKey);
    }

    /** Kiểm tra user hiện tại có actionKey với templateId không. */
    public boolean hasAccess(Long templateId, String actionKey) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        AppUser user = appUserRepository.findByUsername(username).orElse(null);
        if (user == null) return false;
        return hasAccessForUser(templateId, actionKey, user);
    }

    /** Kiểm tra user cụ thể có actionKey với templateId không (dùng nội bộ). */
    public boolean hasAccessForUser(Long templateId, String actionKey, AppUser user) {
        return templateAccessRepository.hasActionAccess(
                templateId,
                actionKey,
                user.getDeptCode()     != null ? user.getDeptCode()     : "",
                user.getPositionCode() != null ? user.getPositionCode() : ""
        );
    }

    /** Lấy danh sách templateId user hiện tại có quyền VIEW. */
    public List<Long> getViewableTemplateIds() {
        return getAccessibleTemplateIds("VIEW");
    }

    public List<Long> getAccessibleTemplateIds(String actionKey) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        AppUser user = appUserRepository.findByUsername(username).orElse(null);
        if (user == null) return List.of();
        return templateAccessRepository.findAccessibleTemplateIds(
                actionKey,
                user.getDeptCode()     != null ? user.getDeptCode()     : "",
                user.getPositionCode() != null ? user.getPositionCode() : ""
        );
    }

    /** Tìm danh sách username eligible để xử lý actionKey — dùng bởi WorkflowService. */
    public List<String> findEligibleUsernames(Long templateId, String actionKey) {
        return templateAccessRepository.findEligibleUsernames(templateId, actionKey);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String normalizeUpper(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeUpperOrNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private boolean nullSafeEquals(String a, String b) {
        return a == null ? b == null : a.equals(b);
    }

    private TemplateAccessResponse toResponse(TemplateAccess ta) {
        return TemplateAccessResponse.builder()
                .id(ta.getId())
                .templateId(ta.getTemplateId())
                .actionKey(ta.getActionKey())
                .subjectOrgCode(ta.getSubjectOrgCode())
                .subjectPositionCode(ta.getSubjectPositionCode())
                .active(ta.getActive())
                .build();
    }
}
