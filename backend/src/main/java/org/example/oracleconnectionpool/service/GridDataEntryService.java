package org.example.oracleconnectionpool.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.constant.EntryRowKeys;
import org.example.oracleconnectionpool.constant.EntryStatus;
import org.example.oracleconnectionpool.entity.GridDataEntry;
import org.example.oracleconnectionpool.entity.GridRow;
import org.example.oracleconnectionpool.exceptions.BadRequestException;
import org.example.oracleconnectionpool.exceptions.ForbiddenException;
import org.example.oracleconnectionpool.exceptions.NotFoundException;
import org.example.oracleconnectionpool.model.request.griddataentry.CreateGridDataEntryRequest;
import org.example.oracleconnectionpool.model.request.griddataentry.UpdateGridDataEntryRequest;
import org.example.oracleconnectionpool.model.response.GridDataEntryDetailResponse;
import org.example.oracleconnectionpool.model.response.GridDataEntryListResponse;
import org.example.oracleconnectionpool.repository.GridDataEntryRepository;
import org.example.oracleconnectionpool.repository.GridRowRepository;
import org.example.oracleconnectionpool.repository.GridTemplateRepository;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class GridDataEntryService {

    private final GridDataEntryRepository entryRepository;
    private final GridTemplateRepository  templateRepository;
    private final GridRowRepository       rowRepository;
    private final ObjectMapper            objectMapper;

    public List<GridDataEntryListResponse> getEntries(Long templateId,
                                                       String orgCode,
                                                       Integer year,
                                                       Integer month,
                                                       AppUserDetails currentUser) {
        if (isEvnnpcScope(currentUser)) {
            // EVNNPC / ADMIN — thấy tất cả
            if (orgCode == null && year == null && month == null) {
                return entryRepository.findByTemplateIdOrderByCreatedAtDesc(templateId).stream()
                        .map(this::toListResponse).toList();
            }
            return entryRepository.findByTemplateIdWithFilters(templateId, orgCode, year, month).stream()
                    .map(this::toListResponse).toList();
        }

        // PC_COMPANY — thấy entry của mình + entry DISTRIBUTED (đã được giao)
        String companyCode = currentUser.getCompanyCode();
        return entryRepository.findByTemplateIdOrderByCreatedAtDesc(templateId).stream()
                .filter(e -> EntryStatus.DISTRIBUTED.equals(e.getStatus())
                        || (companyCode != null && companyCode.equals(e.getOrgCode())))
                .map(this::toListResponse)
                .toList();
    }

    public GridDataEntryDetailResponse getEntry(Long templateId, Long entryId, AppUserDetails currentUser) {
        GridDataEntry entry = entryRepository.findById(entryId)
                .orElseThrow(() -> new NotFoundException("Data entry not found: " + entryId));
        if (!entry.getTemplateId().equals(templateId)) {
            throw new NotFoundException("Entry does not belong to template: " + templateId);
        }
        checkOrgAccess(entry, currentUser);
        return toDetailResponse(entry);
    }

    @Transactional
    public GridDataEntryDetailResponse createEntry(Long templateId,
                                                    CreateGridDataEntryRequest request,
                                                    AppUserDetails currentUser) {
        if (!templateRepository.existsById(templateId)) {
            throw new NotFoundException("Grid template not found: " + templateId);
        }

        // PC_COMPANY users: auto-fill orgCode từ companyCode của họ, bỏ qua giá trị request
        String orgCode;
        if (!isEvnnpcScope(currentUser)) {
            orgCode = currentUser.getCompanyCode();
        } else {
            orgCode = request.getOrgCode();
        }

        if (entryRepository.existsByTemplateIdAndEntryCode(templateId, request.getEntryCode())) {
            throw new BadRequestException(buildDuplicateEntryCodeMessage(request));
        }
        if (entryRepository.existsByTemplateIdAndOrgCodeAndYearAndMonth(
                templateId, orgCode, request.getYear(), request.getMonth())) {
            throw new NotFoundException("Entry already exists for this template + orgCode + year + month");
        }

        // Snapshot rows từ template ngay lúc tạo entry → entry độc lập với
        // mọi thay đổi sau này của template (reorder, format, cellConfig).
        // Nếu client gửi rowData không rỗng (đặc biệt từ flow import), giữ nguyên.
        String rowDataJson = isEmptyRowDataPayload(request.getRowData())
                ? snapshotTemplateRows(templateId)
                : request.getRowData();

        GridDataEntry entry = GridDataEntry.builder()
                .templateId(templateId)
                .entryCode(request.getEntryCode())
                .entryName(request.getEntryName())
                .orgCode(orgCode)
                .year(request.getYear())
                .month(request.getMonth())
                .rowData(rowDataJson)
                .dueDate(request.getDueDate())
                .build();
        return toDetailResponse(entryRepository.save(entry));
    }

    @Transactional
    public GridDataEntryDetailResponse updateEntry(Long templateId, Long entryId,
                                                    UpdateGridDataEntryRequest request,
                                                    AppUserDetails currentUser) {
        GridDataEntry entry = entryRepository.findById(entryId)
                .orElseThrow(() -> new NotFoundException("Data entry not found: " + entryId));
        if (!entry.getTemplateId().equals(templateId)) {
            throw new NotFoundException("Entry does not belong to template: " + templateId);
        }
        checkOrgAccess(entry, currentUser);

        if (request.getEntryName()  != null) entry.setEntryName(request.getEntryName());
        if (request.getRowData()    != null) entry.setRowData(request.getRowData());
        if (Boolean.TRUE.equals(request.getClearDueDate())) {
            entry.setDueDate(null);
        } else if (request.getDueDate() != null) {
            entry.setDueDate(request.getDueDate());
        }
        return toDetailResponse(entryRepository.save(entry));
    }

    @Transactional
    public void deleteEntry(Long entryId, AppUserDetails currentUser) {
        GridDataEntry entry = entryRepository.findById(entryId)
                .orElseThrow(() -> new NotFoundException("Data entry not found: " + entryId));
        checkOrgAccess(entry, currentUser);
        entryRepository.deleteById(entryId);
    }

    /**
     * EVNNPC scope = cán bộ EVNNPC hoặc ADMIN → thấy tất cả dữ liệu.
     * PC_COMPANY scope → chỉ thấy dữ liệu của công ty mình.
     */
    private boolean isEvnnpcScope(AppUserDetails user) {
        boolean isAdmin = user.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return isAdmin || "EVNNPC".equals(user.getOrgGroupCode());
    }

    /** PC_COMPANY user chỉ truy cập entry của companyCode của mình, hoặc entry DISTRIBUTED. */
    private static String buildDuplicateEntryCodeMessage(CreateGridDataEntryRequest request) {
        String period = formatEntryPeriodLabel(request.getYear(), request.getMonth());
        if (period.isEmpty()) {
            return "Báo cáo đã tồn tại. Vui lòng chọn mã báo cáo khác.";
        }
        return "Báo cáo với phiên dữ liệu " + period + " đã tồn tại. Vui lòng chọn phiên dữ liệu khác.";
    }

    private static String formatEntryPeriodLabel(Integer year, Integer month) {
        if (month != null && year != null) {
            return "tháng " + month + " năm " + year;
        }
        if (month != null) {
            return "tháng " + month;
        }
        if (year != null) {
            return "năm " + year;
        }
        return "";
    }

    private void checkOrgAccess(GridDataEntry entry, AppUserDetails user) {
        if (isEvnnpcScope(user)) return;
        // Entry đã được giao (DISTRIBUTED) → mọi user đều xem được
        if (EntryStatus.DISTRIBUTED.equals(entry.getStatus())) return;
        String companyCode = user.getCompanyCode();
        if (companyCode == null || !companyCode.equals(entry.getOrgCode())) {
            throw new ForbiddenException("Bạn không có quyền truy cập dữ liệu đơn vị khác");
        }
    }

    private GridDataEntryListResponse toListResponse(GridDataEntry e) {
        return GridDataEntryListResponse.builder()
                .id(e.getId())
                .entryCode(e.getEntryCode())
                .entryName(e.getEntryName())
                .orgCode(e.getOrgCode())
                .year(e.getYear())
                .month(e.getMonth())
                .status(e.getStatus())
                .submittedBy(e.getSubmittedBy())
                .submittedAt(e.getSubmittedAt())
                .dueDate(e.getDueDate())
                .createdBy(e.getCreatedBy())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }

    private GridDataEntryDetailResponse toDetailResponse(GridDataEntry e) {
        return GridDataEntryDetailResponse.builder()
                .id(e.getId())
                .templateId(e.getTemplateId())
                .entryCode(e.getEntryCode())
                .entryName(e.getEntryName())
                .orgCode(e.getOrgCode())
                .year(e.getYear())
                .month(e.getMonth())
                .rowData(e.getRowData())
                .status(e.getStatus())
                .processInstanceId(e.getProcessInstanceId())
                .submittedBy(e.getSubmittedBy())
                .submittedAt(e.getSubmittedAt())
                .dueDate(e.getDueDate())
                .createdBy(e.getCreatedBy())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }

    /** Coi như rỗng nếu null/blank/"[]" — không có row nào client gửi. */
    private boolean isEmptyRowDataPayload(String s) {
        return s == null || s.isBlank() || "[]".equals(s.trim());
    }

    /**
     * Snapshot rows + cellConfig + sortOrder của template thành JSON cho entry.rowData.
     * Mỗi row gồm: row_code, row_name, _sortOrder, _isTypeHeader?, _catalogField?,
     * _cellConfig?, plus cell values từ template (default cells).
     * Format khớp với FE convention (xem {@link EntryRowKeys}) để FE load không cần transform.
     *
     * Public để các flow ngoài `createEntry` (vd `ButtonActionEntryUtil.createTargetEntry`
     * tạo entry tự động qua button action handler) cùng dùng — entry phải có data
     * snapshot template lúc tạo, KHÔNG được rỗng (snapshot model — entry là source
     * of truth, KHÔNG live-load template lúc render).
     */
    public String snapshotTemplateRows(Long templateId) {
        List<GridRow> rows = rowRepository.findByTemplateIdOrderBySortOrderAsc(templateId);
        List<Map<String, Object>> snapshot = new ArrayList<>(rows.size());
        for (GridRow r : rows) {
            snapshot.add(buildRowSnapshot(r));
        }
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (Exception ex) {
            // Fail loud: nếu serialize fail thì entry sẽ bị tạo với rowData rỗng,
            // tái hiện đúng bug "entry leak từ template". Throw để rollback @Transactional.
            throw new IllegalStateException(
                    "Failed to snapshot template " + templateId + " into entry rowData", ex);
        }
    }

    /** Build 1 row JSON từ GridRow entity. Trả LinkedHashMap để giữ thứ tự key. */
    private Map<String, Object> buildRowSnapshot(GridRow r) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put(EntryRowKeys.ROW_CODE, r.getRowCode());
        if (r.getRowName() != null) row.put(EntryRowKeys.ROW_NAME, r.getRowName());
        row.put(EntryRowKeys.SORT_ORDER, r.getSortOrder() != null ? r.getSortOrder() : 0);
        if (Boolean.TRUE.equals(r.getIsTypeHeader())) row.put(EntryRowKeys.TYPE_HEADER, true);
        if (r.getCatalogField() != null) row.put(EntryRowKeys.CATALOG_FIELD, r.getCatalogField());

        Map<String, Object> cells = parseJsonObject(r.getRowData(), r.getRowCode(), "rowData");
        if (cells != null) row.putAll(cells);

        Map<String, Object> cfg = parseJsonObject(r.getCellConfig(), r.getRowCode(), "cellConfig");
        if (cfg != null && !cfg.isEmpty()) row.put(EntryRowKeys.CELL_CONFIG, cfg);
        return row;
    }

    /** Parse JSON string → Map; trả null + log warn nếu blank/invalid (không break snapshot). */
    private Map<String, Object> parseJsonObject(String json, String rowCode, String fieldName) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception ex) {
            log.warn("Snapshot row {}: invalid {} JSON, skipped — {}", rowCode, fieldName, ex.getMessage());
            return null;
        }
    }
}
