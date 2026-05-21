package org.example.oracleconnectionpool.utils;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Parse {@code GRID_DATA_ENTRY.rowData} JSON → {@code List<Map<String, Object>>} +
 * helper format cell. Stateless, all-static — gọi được từ test thuần Java.
 *
 * <p>BẮT BUỘC dùng cho mọi extractor / handler / migration runner đọc rowData. Lý do:
 * graceful fallback nhất quán (JSON malformed → log warn + empty list, KHÔNG throw).
 */
@Slf4j
public final class EntryRowDataParser {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<Map<String, Object>>> ROW_LIST_TYPE = new TypeReference<>() {};

    private EntryRowDataParser() {}

    /**
     * Parse rowData JSON chuỗi → {@code List<Map<String, Object>>}.
     * Null/blank → empty list. JSON malformed → log warn (kèm {@code logTag} để truy
     * ngược caller) + empty list. KHÔNG throw.
     */
    public static List<Map<String, Object>> parseRows(String json, String logTag) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return MAPPER.readValue(json, ROW_LIST_TYPE);
        } catch (Exception ex) {
            log.warn("[{}] rowData JSON invalid, return empty: {}", logTag, ex.getMessage());
            return List.of();
        }
    }

    /** Null → "". String/Number/Boolean → toString rồi trim. Tránh NPE khi đọc cell. */
    public static String trimToString(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    /** Convenience: lấy cell theo field name + trim luôn. */
    public static String trimCell(Map<String, Object> row, String field) {
        return trimToString(row.get(field));
    }

    /** Empty/blank → null. Hữu ích khi build entity với column nullable. */
    public static String emptyToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    /** Combine: lấy cell, trim, empty → null. */
    public static String cellOrNull(Map<String, Object> row, String field) {
        return emptyToNull(trimCell(row, field));
    }

    /**
     * Number/String/Boolean → toString. Null → null.
     * Dùng khi target field là {@code String} nhưng JSON có thể trả Number (vd column
     * dataType=number trong template).
     */
    public static String numberToString(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    /** True nếu mọi field trong {@code dataFields} đều null/blank ở row. */
    public static boolean allFieldsBlank(Map<String, Object> row, Collection<String> dataFields) {
        for (String f : dataFields) {
            if (!trimCell(row, f).isEmpty()) return false;
        }
        return true;
    }
}
