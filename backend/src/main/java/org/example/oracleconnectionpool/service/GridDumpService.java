package org.example.oracleconnectionpool.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.entity.GridDataEntry;
import org.example.oracleconnectionpool.entity.GridRow;
import org.example.oracleconnectionpool.entity.GridTemplate;
import org.example.oracleconnectionpool.exceptions.NotFoundException;
import org.example.oracleconnectionpool.model.response.GridDumpResponse;
import org.example.oracleconnectionpool.repository.GridDataEntryRepository;
import org.example.oracleconnectionpool.repository.GridRowRepository;
import org.example.oracleconnectionpool.repository.GridTemplateRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class GridDumpService {

    private final GridDataEntryRepository entryRepository;
    private final GridTemplateRepository  templateRepository;
    private final GridRowRepository       rowRepository;
    private final ObjectMapper            objectMapper;

    public GridDumpResponse dumpByEntryId(Long entryId) {
        GridDataEntry entry = entryRepository.findById(entryId)
                .orElseThrow(() -> new NotFoundException("Data entry not found: " + entryId));
        GridTemplate template = templateRepository.findById(entry.getTemplateId())
                .orElseThrow(() -> new NotFoundException("Grid template not found: " + entry.getTemplateId()));
        List<GridRow> rows = rowRepository.findByTemplateIdOrderBySortOrderAsc(template.getId());

        return GridDumpResponse.builder()
                .entryId(entry.getId())
                .entryOrgCode(entry.getOrgCode())
                .entryYearVal(entry.getYear())
                .entryMonthVal(entry.getMonth())
                .templateId(template.getId())
                .template(toTemplateInfo(template))
                .rows(rows.stream().map(this::toRowInfo).toList())
                .entry(toEntryInfo(entry))
                .build();
    }

    /**
     * Dump theo templateId — chỉ trả config (template + rows). Các trường liên quan
     * đến entry sẽ null vì không có entry để query.
     */
    public GridDumpResponse dumpByTemplateId(Long templateId) {
        GridTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() -> new NotFoundException("Grid template not found: " + templateId));
        List<GridRow> rows = rowRepository.findByTemplateIdOrderBySortOrderAsc(template.getId());

        return GridDumpResponse.builder()
                .templateId(template.getId())
                .template(toTemplateInfo(template))
                .rows(rows.stream().map(this::toRowInfo).toList())
                .build();
    }

    private GridDumpResponse.TemplateInfo toTemplateInfo(GridTemplate t) {
        return GridDumpResponse.TemplateInfo.builder()
                .id(t.getId())
                .code(t.getCode())
                .name(t.getName())
                .columnConfigs(parseJson(t.getColumnConfigs(), "GRID_TEMPLATE.COLUMN_CONFIGS#" + t.getId()))
                .columnGroups(parseJson(t.getColumnGroups(), "GRID_TEMPLATE.COLUMN_GROUPS#" + t.getId()))
                .build();
    }

    private GridDumpResponse.RowInfo toRowInfo(GridRow r) {
        return GridDumpResponse.RowInfo.builder()
                .id(r.getId())
                .rowCode(r.getRowCode())
                .rowName(r.getRowName())
                .sortOrder(r.getSortOrder())
                .isTypeHeader(r.getIsTypeHeader())
                .catalogField(r.getCatalogField())
                .rowData(parseJson(r.getRowData(), "GRID_ROW.ROW_DATA#" + r.getId()))
                .cellConfig(parseJson(r.getCellConfig(), "GRID_ROW.CELL_CONFIG#" + r.getId()))
                .build();
    }

    private GridDumpResponse.EntryInfo toEntryInfo(GridDataEntry e) {
        return GridDumpResponse.EntryInfo.builder()
                .id(e.getId())
                .entryCode(e.getEntryCode())
                .entryName(e.getEntryName())
                .orgCode(e.getOrgCode())
                .year(e.getYear())
                .month(e.getMonth())
                .status(e.getStatus())
                .rowData(parseJson(e.getRowData(), "GRID_DATA_ENTRY.ROW_DATA#" + e.getId()))
                .build();
    }

    /**
     * Parse CLOB JSON string → Object (Map/List/primitive). Trả nguyên string nếu parse fail
     * để dev vẫn nhìn được payload thô khi data corrupt.
     */
    private Object parseJson(String json, String label) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, Object.class);
        } catch (Exception ex) {
            log.warn("Dump: invalid JSON at {} — return raw string. Error: {}", label, ex.getMessage());
            return json;
        }
    }
}
