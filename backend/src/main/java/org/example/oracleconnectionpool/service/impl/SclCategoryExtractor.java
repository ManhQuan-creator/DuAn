package org.example.oracleconnectionpool.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.constant.SclPhanLoai;
import org.example.oracleconnectionpool.entity.GridDataEntry;
import org.example.oracleconnectionpool.entity.SclCategoryEntity;
import org.example.oracleconnectionpool.exceptions.NotFoundException;
import org.example.oracleconnectionpool.repository.GridDataEntryRepository;
import org.example.oracleconnectionpool.service.MasterCatalogService;
import org.example.oracleconnectionpool.utils.EntryRowDataParser;
import org.example.oracleconnectionpool.utils.EntryRowKind;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Extract {@link SclCategoryEntity} từ rowData entry template 344 (PL159) — state machine
 * 1-tầng theo Roman section header (I→{@link SclPhanLoai#SCL_110KV}, II→{@link SclPhanLoai#SCL_TT},
 * III→{@link SclPhanLoai#SCL_HT}, IV→{@link SclPhanLoai#SCL_KHAC}). Latin sub-section
 * (A/B/C/D) chỉ là header decorative — KHÔNG override phân loại, kể cả khi nằm trong
 * Roman IV. Hạng mục có Roman parent + ít nhất 1 cột data có giá trị → emit entity.
 *
 * <p>Field defaults: {@code pc=entry.orgCode}; {@code unit=master_catalog.name}
 * (CT_DIEN_LUC, fallback pc); {@code status="0"}; {@code planType="SCL_DN"};
 * {@code categoryCode=<entryCode>_<rowCode>}. KHÔNG persist DB — caller tự quyết.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SclCategoryExtractor {

    private static final String CATALOG_TYPE_PC = "CT_DIEN_LUC";
    private static final String DEFAULT_STATUS = "CHUA_GUI_THAM_DINH";
    private static final String DEFAULT_PLAN_TYPE = "SCL_DN";

    /** Cột data dùng để detect "slot trống" — nếu cả 6 đều blank thì skip row. */
    private static final Set<String> DATA_FIELDS = Set.of("A", "B", "C", "D", "E", "F");

    private final GridDataEntryRepository entryRepository;
    private final MasterCatalogService masterCatalogService;

    public List<SclCategoryEntity> extract(Long entryId) {
        GridDataEntry entry = entryRepository.findById(entryId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy entry " + entryId));

        List<Map<String, Object>> rows = EntryRowDataParser.parseRows(
                entry.getRowData(), "SclCategoryExtractor#" + entryId);
        if (rows.isEmpty()) return List.of();

        // Lookup PC code → tên đầy đủ — fetch 1 lần đầu method.
        Map<String, String> pcNameById = masterCatalogService.getCatalogNameMap(CATALOG_TYPE_PC);

        State state = new State();
        List<SclCategoryEntity> out = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            switch (EntryRowKind.classify(row.get("STT"))) {
                case ROMAN_SECTION -> state.currentPhanLoai = mapRomanToPhanLoai(
                        EntryRowDataParser.trimCell(row, "STT"));
                case DATA_ITEM -> {
                    if (state.currentPhanLoai == null) continue;
                    if (EntryRowDataParser.allFieldsBlank(row, DATA_FIELDS)) continue;
                    out.add(buildEntity(entry, row, state.currentPhanLoai, pcNameById));
                }
                default -> { /* META, LATIN_SUB_SECTION, UNKNOWN → skip */ }
            }
        }
        return out;
    }

    private SclCategoryEntity buildEntity(GridDataEntry entry, Map<String, Object> row, String phanLoai,
                                          Map<String, String> pcNameById) {
        SclCategoryEntity e = new SclCategoryEntity();
        String pc = entry.getOrgCode();
        e.setPc(pc);
        // unit = master_catalog.name (CT_DIEN_LUC) where id = pc. Fallback sang pc nếu
        // không tìm thấy (entry orgCode lạ vd "TCT" hoặc PC chưa có trong catalog).
        e.setUnit(pc != null ? pcNameById.getOrDefault(pc, pc) : null);
        e.setCategoryCode(entry.getEntryCode() + "_" + EntryRowDataParser.trimCell(row, "row_code"));
        e.setCategoryName(EntryRowDataParser.cellOrNull(row, "A"));
        e.setAssetCode(EntryRowDataParser.cellOrNull(row, "B"));
        e.setScContent(EntryRowDataParser.cellOrNull(row, "C"));
        e.setValueVat(EntryRowDataParser.numberToString(row.get("D")));
        e.setAssignedSclCost(EntryRowDataParser.numberToString(row.get("E")));
        e.setNote(EntryRowDataParser.cellOrNull(row, "F"));
        e.setAssetType(phanLoai);
        e.setPlanType(DEFAULT_PLAN_TYPE);
        e.setStatus(DEFAULT_STATUS);
        e.setYearPlan(entry.getYear() != null ? String.valueOf(entry.getYear()) : null);
        e.setCreatedUnit(entry.getCreatedBy());
        return e;
    }

    private String mapRomanToPhanLoai(String roman) {
        return switch (roman) {
            case "I" -> SclPhanLoai.SCL_110KV;
            case "II" -> SclPhanLoai.SCL_TT;
            case "III" -> SclPhanLoai.SCL_HT;
            case "IV" -> SclPhanLoai.SCL_KHAC;
            default -> null;
        };
    }

    private static class State {
        String currentPhanLoai;
    }
}
