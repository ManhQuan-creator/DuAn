package org.example.oracleconnectionpool.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.buttonaction.*;
import org.example.oracleconnectionpool.entity.AppUser;
import org.example.oracleconnectionpool.entity.TemplateButton;
import org.example.oracleconnectionpool.model.request.templatebutton.CreateTemplateButtonRequest;
import org.example.oracleconnectionpool.model.request.templatebutton.ExecuteButtonActionRequest;
import org.example.oracleconnectionpool.model.request.templatebutton.UpdateTemplateButtonRequest;
import org.example.oracleconnectionpool.model.response.TemplateButtonResponse;
import org.example.oracleconnectionpool.repository.AppUserRepository;
import org.example.oracleconnectionpool.repository.TemplateButtonRepository;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TemplateButtonService {

    private final TemplateButtonRepository templateButtonRepository;
    private final TemplateAccessService templateAccessService;
    private final AppUserRepository appUserRepository;
    private final ButtonActionHandlerRegistry buttonActionHandlerRegistry;

    /** Lấy danh sách nút của template, kèm flag allowed cho user hiện tại.
     *  Logic: nếu không có rule phân quyền nào cho nút → allowed = true (tất cả user).
     *         nếu có rule → kiểm tra user hiện tại có khớp rule nào không. */
    public List<TemplateButtonResponse> getByTemplateId(Long templateId) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        AppUser user = appUserRepository.findByUsername(username).orElse(null);

        return templateButtonRepository
                .findByTemplateIdAndActiveTrueOrderBySortOrderAsc(templateId)
                .stream()
                .map(btn -> {
                    boolean hasAnyRules = templateAccessService.existsAnyRule(templateId, btn.getButtonKey());
                    boolean allowed;
                    if (!hasAnyRules) {
                        // Không có rule nào → mặc định tất cả user được phép
                        allowed = true;
                    } else {
                        // Có rule → kiểm tra user hiện tại
                        allowed = user != null &&
                                templateAccessService.hasAccessForUser(templateId, btn.getButtonKey(), user);
                    }
                    return toResponse(btn, allowed);
                })
                .toList();
    }

    @Transactional
    public TemplateButtonResponse create(CreateTemplateButtonRequest request) {
        String key = request.getButtonKey().trim().toUpperCase();
        if (templateButtonRepository.existsByTemplateIdAndButtonKeyAndActiveTrue(request.getTemplateId(), key)) {
            throw new RuntimeException("Button Key '" + key + "' đã tồn tại trên biểu mẫu này");
        }

        String currentUser = SecurityContextHolder.getContext().getAuthentication().getName();
        String handlerKey = request.getActionHandlerKey() != null && !request.getActionHandlerKey().isBlank()
                ? request.getActionHandlerKey().trim() : null;

        TemplateButton btn = TemplateButton.builder()
                .templateId(request.getTemplateId())
                .buttonKey(key)
                .buttonLabel(request.getButtonLabel())
                .buttonIcon(request.getButtonIcon())
                .sortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0)
                .actionHandlerKey(handlerKey)
                .visibleStatuses(normalizeCsv(request.getVisibleStatuses()))
                .disabledStatuses(normalizeCsv(request.getDisabledStatuses()))
                .navigationUrl(normalizeNavUrl(request.getNavigationUrl()))
                .navigationTarget(normalizeNavTarget(request.getNavigationTarget()))
                .active(true)
                .createdBy(currentUser)
                .build();
        return toResponse(templateButtonRepository.save(btn), null);
    }

    @Transactional
    public TemplateButtonResponse update(Long id, UpdateTemplateButtonRequest request) {
        TemplateButton btn = templateButtonRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nút với ID: " + id));

        btn.setButtonLabel(request.getButtonLabel());
        btn.setButtonIcon(request.getButtonIcon());
        btn.setSortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0);
        btn.setActionHandlerKey(request.getActionHandlerKey() != null && !request.getActionHandlerKey().isBlank()
                ? request.getActionHandlerKey().trim() : null);
        btn.setVisibleStatuses(normalizeCsv(request.getVisibleStatuses()));
        btn.setDisabledStatuses(normalizeCsv(request.getDisabledStatuses()));
        btn.setNavigationUrl(normalizeNavUrl(request.getNavigationUrl()));
        btn.setNavigationTarget(normalizeNavTarget(request.getNavigationTarget()));
        return toResponse(templateButtonRepository.save(btn), null);
    }

    private String normalizeNavUrl(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeNavTarget(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim().toLowerCase();
        if (trimmed.isEmpty()) return null;
        return "_blank".equals(trimmed) ? "_blank" : "_self";
    }

    /** Chuẩn hóa CSV: trim, uppercase, bỏ item rỗng. Null/rỗng → null. */
    private String normalizeCsv(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String cleaned = java.util.Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toUpperCase)
                .distinct()
                .reduce((a, b) -> a + "," + b)
                .orElse(null);
        return (cleaned == null || cleaned.isBlank()) ? null : cleaned;
    }

    @Transactional
    public void delete(Long id) {
        TemplateButton btn = templateButtonRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nút với ID: " + id));
        // if ("SAVE".equalsIgnoreCase(btn.getButtonKey())) {
        //     throw new RuntimeException("Không thể xóa nút SAVE — đây là nút mặc định của hệ thống");
        // }
        btn.setActive(false);
        templateButtonRepository.save(btn);
    }

    /**
     * Thực thi logic xử lý cho nút.
     * Ưu tiên tìm handler theo actionHandlerKey (lưu trên DB) → fallback theo buttonKey.
     * Nếu không có handler → trả info mặc định.
     */
    @Transactional
    public ButtonActionResult executeAction(ExecuteButtonActionRequest request) {
        String buttonKey = request.getButtonKey().trim().toUpperCase();

        // Tìm actionHandlerKey từ DB nếu có entryId hoặc templateId
        String resolvedHandlerKey = resolveHandlerKey(request.getTemplateId(), buttonKey);

        // Resolve user
        AppUserDetails userDetails = null;
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AppUserDetails) {
            userDetails = (AppUserDetails) auth.getPrincipal();
        }

        ButtonActionContext ctx = ButtonActionContext.builder()
                .templateId(request.getTemplateId())
                .entryId(request.getEntryId())
                .buttonKey(buttonKey)
                .user(userDetails)
                .rowData(request.getRowData())
                .payload(request.getPayload())
                .params(request.getParams() != null ? request.getParams() : java.util.Collections.emptyMap())
                .build();

        // Tìm handler: actionHandlerKey (cấu hình) → buttonKey (convention)
        ButtonActionHandler handler = null;
        if (resolvedHandlerKey != null && !resolvedHandlerKey.isBlank()) {
            handler = buttonActionHandlerRegistry.find(resolvedHandlerKey).orElse(null);
        }
        if (handler == null) {
            handler = buttonActionHandlerRegistry.find(buttonKey).orElse(null);
        }

        if (handler == null) {
            log.info("Không tìm thấy handler cho buttonKey='{}' (handlerKey='{}') — trả mặc định",
                    buttonKey, resolvedHandlerKey);
            return ButtonActionResult.info("Nút [" + buttonKey + "] chưa được cấu hình logic xử lý.");
        }

        log.info("Executing button handler '{}' cho buttonKey='{}' (template={}, entry={}, user={})",
                handler.getKey(), buttonKey, request.getTemplateId(), request.getEntryId(),
                userDetails != null ? userDetails.getUsername() : "anonymous");

        return handler.handle(ctx);
    }

    /** Tìm actionHandlerKey đã cấu hình cho buttonKey trên template. */
    private String resolveHandlerKey(Long templateId, String buttonKey) {
        if (templateId == null) return null;
        return templateButtonRepository
                .findByTemplateIdAndActiveTrueOrderBySortOrderAsc(templateId)
                .stream()
                .filter(b -> buttonKey.equalsIgnoreCase(b.getButtonKey()))
                .map(TemplateButton::getActionHandlerKey)
                .findFirst()
                .orElse(null);
    }

    private TemplateButtonResponse toResponse(TemplateButton btn, Boolean allowed) {
        return TemplateButtonResponse.builder()
                .id(btn.getId())
                .templateId(btn.getTemplateId())
                .buttonKey(btn.getButtonKey())
                .buttonLabel(btn.getButtonLabel())
                .buttonIcon(btn.getButtonIcon())
                .sortOrder(btn.getSortOrder())
                .actionHandlerKey(btn.getActionHandlerKey())
                .visibleStatuses(btn.getVisibleStatuses())
                .disabledStatuses(btn.getDisabledStatuses())
                .navigationUrl(btn.getNavigationUrl())
                .navigationTarget(btn.getNavigationTarget())
                .active(btn.getActive())
                .allowed(allowed)
                .build();
    }
}
