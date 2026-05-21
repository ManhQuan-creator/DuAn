package org.example.oracleconnectionpool.service;

import java.util.List;

import org.example.oracleconnectionpool.constant.PeriodType;
import org.example.oracleconnectionpool.constant.TemplateStatus;
import org.example.oracleconnectionpool.entity.GridRow;
import org.example.oracleconnectionpool.entity.GridTemplate;
import org.example.oracleconnectionpool.exceptions.BadRequestException;
import org.example.oracleconnectionpool.exceptions.NotFoundException;
import org.example.oracleconnectionpool.model.request.gridrow.GridRowRequest;
import org.example.oracleconnectionpool.model.request.gridtemplate.CreateGridTemplateRequest;
import org.example.oracleconnectionpool.model.request.gridtemplate.FilterGridTemplateRequest;
import org.example.oracleconnectionpool.model.request.gridtemplate.UpdateGridTemplateRequest;
import org.example.oracleconnectionpool.model.response.GridRowResponse;
import org.example.oracleconnectionpool.model.response.GridTemplateDetailResponse;
import org.example.oracleconnectionpool.model.response.GridTemplateListResponse;
import org.example.oracleconnectionpool.entity.TemplateButton;
import org.example.oracleconnectionpool.repository.GridDataEntryRepository;
import org.example.oracleconnectionpool.repository.GridRowRepository;
import org.example.oracleconnectionpool.repository.GridTemplateRepository;
import org.example.oracleconnectionpool.repository.TemplateButtonRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class GridTemplateService {
    private final ObjectMapper objectMapper;
    private final GridTemplateRepository templateRepository;
    private final GridRowRepository rowRepository;
    private final GridDataEntryRepository entryRepository;
    private final TemplateButtonRepository templateButtonRepository;

    public List<GridTemplateListResponse> getTemplates() {
        return templateRepository.findAll().stream()
                .map(this::toListResponse)
                .toList();
    }

    public Page<GridTemplateListResponse> searchTemplates(FilterGridTemplateRequest request) {
        Specification<GridTemplate> spec = Specification
                .where(buildKeywordSpec(request.getKeyword()))
                .and(buildStatusSpec(request.getStatus()));

        Pageable pageable = PageRequest.of(request.getPageNum(), request.getPageSize(), Sort.by("updatedAt").descending());

        return templateRepository.findAll(spec, pageable).map(template -> GridTemplateListResponse.builder()
                .id(template.getId())
                .code(template.getCode())
                .name(template.getName())
                .description(template.getDescription())
                .status(template.getStatus())
                .version(template.getVersion())
                .processDefinitionKey(template.getProcessDefinitionKey())
                .reportDepartments(deserializeStringList(template.getReportDepartment()))
                .reportFcGroups(deserializeStringList(template.getReportFcGroup()))
                .periodType(template.getPeriodType())
                .useDueDate(Boolean.TRUE.equals(template.getUseDueDate()))
                .createdBy(template.getCreatedBy())
                .createdAt(template.getCreatedAt())
                .updatedAt(template.getUpdatedAt())
                .build());
    }

    private Specification<GridTemplate> buildKeywordSpec(String keyword) {
        return (root, query, cb) -> {
            if (keyword == null || keyword.isBlank()) return null;
            String pattern = "%" + keyword.toLowerCase() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("name")), pattern),
                    cb.like(cb.lower(root.get("code")), pattern)
            );
        };
    }

    private Specification<GridTemplate> buildStatusSpec(String status) {
        return (root, query, cb) -> {
            if (status == null || status.isBlank()) return null;
            return cb.equal(root.get("status"), status);
        };
    }
    
    private String serializeStringList(List<String> values) {
        try {
            return (values == null || values.isEmpty()) ? null : objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException e) {
            return null;
        }
    }
    
    public List<String> deserializeStringList(String raw) {
        try {
            if (raw == null || raw.isBlank()) return List.of();
            return objectMapper.readValue(raw, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    public GridTemplateDetailResponse getTemplate(Long id) {
        GridTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Grid template not found: " + id));
        List<GridRow> rows = rowRepository.findByTemplateIdOrderBySortOrderAsc(id);
        return toDetailResponse(template, rows);
    }

    @Transactional
    public GridTemplateDetailResponse createTemplate(CreateGridTemplateRequest request) {
        if (templateRepository.existsByCode(request.getCode())) {
            throw new NotFoundException("Template code '" + request.getCode() + "' already exists");
        }

        GridTemplate template = GridTemplate.builder()
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .columnConfigs(request.getColumnConfigs())
                .columnGroups(request.getColumnGroups())
                .processDefinitionKey(request.getProcessDefinitionKey())
                .reportDepartment(serializeStringList(request.getReportDepartments()))
                .reportFcGroup(serializeStringList(request.getReportFcGroups()))
                .periodType(resolvePeriodType(request.getPeriodType()))
                .useDueDate(Boolean.TRUE.equals(request.getUseDueDate()))
                .build();
        template = templateRepository.save(template);

        seedDefaultButtons(template.getId());

        List<GridRow> rows = saveRows(template.getId(), request.getRows());
        return toDetailResponse(template, rows);
    }

    @Transactional
    public GridTemplateDetailResponse updateTemplate(Long id, UpdateGridTemplateRequest request) {
        GridTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Grid template not found: " + id));

        if (request.getCode() != null) template.setCode(request.getCode());
        if (request.getName() != null) template.setName(request.getName());
        if (request.getDescription() != null) template.setDescription(request.getDescription());
        if (request.getColumnConfigs() != null) template.setColumnConfigs(request.getColumnConfigs());
        if (request.getColumnGroups() != null) template.setColumnGroups(request.getColumnGroups());
        if (request.isProcessDefinitionKeySpecified()) {
            template.setProcessDefinitionKey(
                    StringUtils.hasText(request.getProcessDefinitionKey())
                            ? request.getProcessDefinitionKey().trim()
                            : null
            );
        }
        if (request.getReportDepartments() != null) {
            template.setReportDepartment(serializeStringList(request.getReportDepartments()));
        }
        if (request.getReportFcGroups() != null) {
            template.setReportFcGroup(serializeStringList(request.getReportFcGroups()));
        }
        if (request.getPeriodType() != null) {
            template.setPeriodType(resolvePeriodType(request.getPeriodType()));
        }
        if (request.getUseDueDate() != null) {
            template.setUseDueDate(request.getUseDueDate());
        }

        template.setVersion(template.getVersion() + 1);
        template = templateRepository.save(template);

        if (request.getRows() != null) {
            rowRepository.deleteByTemplateId(id);
            List<GridRow> rows = saveRows(id, request.getRows());
            return toDetailResponse(template, rows);
        }

        List<GridRow> rows = rowRepository.findByTemplateIdOrderBySortOrderAsc(id);
        return toDetailResponse(template, rows);
    }

    @Transactional
    public void deleteTemplate(Long id) {
        GridTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Grid template not found: " + id));
        if (TemplateStatus.PUBLISHED.equalsIgnoreCase(template.getStatus())) {
            throw new BadRequestException(
                    "Không thể xóa biểu mẫu đã xuất bản. Vui lòng tạo phiên bản mới hoặc gỡ xuất bản trước khi xóa.");
        }
        entryRepository.deleteByTemplateId(id);
        rowRepository.deleteByTemplateId(id);
        templateButtonRepository.deleteByTemplateId(id);
        templateRepository.deleteById(id);
    }

    /**
     * Copy nguyên cấu trúc một biểu mẫu sang biểu mẫu mới (status = DRAFT, version = 1).
     * Code/name được hậu tố " - Từ copy" để phân biệt; code tự tăng số nếu đã tồn tại.
     * Copy: cấu hình cột, nhóm cột, rows, template buttons, các thông số định danh (workflow,
     * report department, fc group, period type, owner dept).
     * Không copy: status (luôn DRAFT), version (reset 1), data entries.
     */
    @Transactional
    public GridTemplateDetailResponse copyTemplate(Long sourceId) {
        GridTemplate source = templateRepository.findById(sourceId)
                .orElseThrow(() -> new NotFoundException("Grid template not found: " + sourceId));

        String newCode = generateUniqueCopyCode(source.getCode());
        String newName = (source.getName() == null ? "" : source.getName()) + " - Từ copy";

        GridTemplate copy = GridTemplate.builder()
                .code(newCode)
                .name(newName)
                .description(source.getDescription())
                .columnConfigs(source.getColumnConfigs())
                .columnGroups(source.getColumnGroups())
                .processDefinitionKey(source.getProcessDefinitionKey())
                .reportDepartment(source.getReportDepartment())
                .reportFcGroup(source.getReportFcGroup())
                .periodType(source.getPeriodType())
                .useDueDate(Boolean.TRUE.equals(source.getUseDueDate()))
                .ownerDeptCode(source.getOwnerDeptCode())
                .build();
        copy.setStatus(TemplateStatus.DRAFT);
        copy.setVersion(1);
        copy = templateRepository.save(copy);

        List<GridRow> sourceRows = rowRepository.findByTemplateIdOrderBySortOrderAsc(sourceId);
        List<GridRow> rowCopies = new java.util.ArrayList<>();
        for (GridRow r : sourceRows) {
            rowCopies.add(GridRow.builder()
                    .templateId(copy.getId())
                    .rowCode(r.getRowCode())
                    .rowName(r.getRowName())
                    .rowData(r.getRowData())
                    .cellConfig(r.getCellConfig())
                    .isTypeHeader(r.getIsTypeHeader())
                    .catalogField(r.getCatalogField())
                    .sortOrder(r.getSortOrder())
                    .build());
        }
        List<GridRow> savedRows = rowRepository.saveAll(rowCopies);

        List<TemplateButton> sourceButtons =
                templateButtonRepository.findByTemplateIdAndActiveTrueOrderBySortOrderAsc(sourceId);
        if (sourceButtons.isEmpty()) {
            seedDefaultButtons(copy.getId());
        } else {
            for (TemplateButton b : sourceButtons) {
                templateButtonRepository.save(TemplateButton.builder()
                        .templateId(copy.getId())
                        .buttonKey(b.getButtonKey())
                        .buttonLabel(b.getButtonLabel())
                        .buttonIcon(b.getButtonIcon())
                        .actionHandlerKey(b.getActionHandlerKey())
                        .visibleStatuses(b.getVisibleStatuses())
                        .disabledStatuses(b.getDisabledStatuses())
                        .navigationUrl(b.getNavigationUrl())
                        .navigationTarget(b.getNavigationTarget())
                        .sortOrder(b.getSortOrder())
                        .active(true)
                        .build());
            }
        }

        return toDetailResponse(copy, savedRows);
    }

    /**
     * Seed nút mặc định (SAVE + IMPORT) cho template mới hoặc bản copy không có buttons.
     * Single source of truth cho định nghĩa nút mặc định — gọi từ createTemplate +
     * copyTemplate (nhánh empty).
     */
    private void seedDefaultButtons(Long templateId) {
        templateButtonRepository.saveAll(List.of(
                TemplateButton.builder()
                        .templateId(templateId)
                        .buttonKey("SAVE")
                        .buttonLabel("Lưu dữ liệu")
                        .buttonIcon("tuiIconSave")
                        .sortOrder(0)
                        .visibleStatuses("DRAFT,RETURNED")
                        
                        .active(true)
                        .build(),
                TemplateButton.builder()
                        .templateId(templateId)
                        .buttonKey("IMPORT")
                        .buttonLabel("Nhập Excel")
                        .buttonIcon("tuiIconUpload")
                        .sortOrder(1)
                        .visibleStatuses("DRAFT,RETURNED")
                        .active(true)
                        .build()
        ));
    }

    /** Sinh code duy nhất bằng cách thêm "_COPY" (và đếm tăng nếu trùng). */
    private String generateUniqueCopyCode(String sourceCode) {
        String base = (sourceCode == null ? "TEMPLATE" : sourceCode) + "_COPY";
        if (!templateRepository.existsByCode(base)) return truncateCode(base);
        for (int i = 2; i < 1000; i++) {
            String candidate = base + "_" + i;
            if (!templateRepository.existsByCode(candidate)) return truncateCode(candidate);
        }
        throw new BadRequestException("Không thể sinh mã copy duy nhất cho biểu mẫu nguồn: " + sourceCode);
    }

    /** Cột CODE giới hạn 50 ký tự — cắt bớt nếu vượt. */
    private String truncateCode(String code) {
        return code.length() <= 50 ? code : code.substring(0, 50);
    }

    @Transactional
    public GridTemplateDetailResponse publishTemplate(Long id) {
        GridTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Grid template not found: " + id));
        template.setStatus(TemplateStatus.PUBLISHED);
        template = templateRepository.save(template);
        List<GridRow> rows = rowRepository.findByTemplateIdOrderBySortOrderAsc(id);
        return toDetailResponse(template, rows);
    }

    private List<GridRow> saveRows(Long templateId, List<GridRowRequest> rowRequests) {
        if (rowRequests == null || rowRequests.isEmpty()) return List.of();

        List<GridRow> entities = new java.util.ArrayList<>();
        for (int i = 0; i < rowRequests.size(); i++) {
            GridRowRequest req = rowRequests.get(i);
            entities.add(GridRow.builder()
                    .templateId(templateId)
                    .rowCode(req.getRowCode())
                    .rowName(req.getRowName())
                    .rowData(req.getRowData())
                    .cellConfig(req.getCellConfig())
                    .isTypeHeader(req.getIsTypeHeader() != null ? req.getIsTypeHeader() : false)
                    .catalogField(req.getCatalogField())
                    .sortOrder(req.getSortOrder() != null ? req.getSortOrder() : i)
                    .build());
        }
        return rowRepository.saveAll(entities);
    }

    private GridTemplateListResponse toListResponse(GridTemplate t) {
        return GridTemplateListResponse.builder()
                .id(t.getId())
                .code(t.getCode())
                .name(t.getName())
                .description(t.getDescription())
                .status(t.getStatus())
                .version(t.getVersion())
                .processDefinitionKey(t.getProcessDefinitionKey())
                .reportDepartments(deserializeStringList(t.getReportDepartment()))
                .reportFcGroups(deserializeStringList(t.getReportFcGroup()))
                .periodType(t.getPeriodType())
                .useDueDate(Boolean.TRUE.equals(t.getUseDueDate()))
                .createdBy(t.getCreatedBy())
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .build();
    }

    private GridTemplateDetailResponse toDetailResponse(GridTemplate t, List<GridRow> rows) {
        return GridTemplateDetailResponse.builder()
                .id(t.getId())
                .code(t.getCode())
                .name(t.getName())
                .description(t.getDescription())
                .columnConfigs(t.getColumnConfigs())
                .columnGroups(t.getColumnGroups())
                .status(t.getStatus())
                .version(t.getVersion())
                .rows(rows.stream().map(this::toRowResponse).toList())
                .processDefinitionKey(t.getProcessDefinitionKey())
                .reportDepartments(deserializeStringList(t.getReportDepartment()))
                .reportFcGroups(deserializeStringList(t.getReportFcGroup()))
                .periodType(t.getPeriodType())
                .useDueDate(Boolean.TRUE.equals(t.getUseDueDate()))
                .createdBy(t.getCreatedBy())
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .build();
    }

    /** Chuẩn hoá periodType: null/invalid → DEFAULT. Delegate sang {@link PeriodType}. */
    private String resolvePeriodType(String value) {
        return PeriodType.resolveCode(value);
    }

    private GridRowResponse toRowResponse(GridRow r) {
        return GridRowResponse.builder()
                .id(r.getId())
                .rowCode(r.getRowCode())
                .rowName(r.getRowName())
                .rowData(r.getRowData())
                .cellConfig(r.getCellConfig())
                .isTypeHeader(r.getIsTypeHeader())
                .catalogField(r.getCatalogField())
                .sortOrder(r.getSortOrder())
                .build();
    }
}
