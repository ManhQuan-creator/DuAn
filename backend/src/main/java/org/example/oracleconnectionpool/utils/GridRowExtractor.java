package org.example.oracleconnectionpool.utils;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.apache.logging.log4j.util.Strings;
import org.example.oracleconnectionpool.constant.Constant;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Predicate;

/**
 * Helper parse + filter + map các row từ JSON `GridDataEntry.rowData`.
 *
 * <p>Core ({@link #parseRows}, {@link #extract}, {@link #asString},
 * {@link #isPositiveIntegerStt}) reusable cho mọi biểu mẫu.
 *
 * <p>Phần dưới là extractor chuyên biệt cho từng biểu mẫu (PL159, PL158, ...).
 * Khi thêm biểu mẫu mới: tạo {@code record} + 1 method {@code extractXxx} ở section riêng.
 */
@Slf4j
public final class GridRowExtractor {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<Map<String, Object>>> ROW_LIST_TYPE = new TypeReference<>() {};

    public static final String STT = "STT";
    public static final String ROW_CODE = "row_code";
    public static final String ROW_NAME = "row_name";
    public static final String SORT_ORDER = "_sortOrder";
    public static final String CELL_CONFIG = "_cellConfig";
    public static final String IS_TYPE_HEADER = "_isTypeHeader";

    private GridRowExtractor() {}

    // ============================================================
    // BASE — metadata chung cho mọi row (rowCode/rowName/sortOrder/cellConfig)
    // ============================================================

    /**
     * Metadata chung cho 1 row JSON. Mọi biểu mẫu đều có 4 field này, nên record
     * form-specific compose nó thay vì redeclare từng field.
     */
    public record RowMeta(
            String rowCode,
            String rowName,
            Integer sortOrder,
            Map<String, Object> cellConfig
    ) {
        /** Default — auto sinh "R{idx+1}" + sortOrder = idx, không có cellConfig. */
        public static RowMeta indexed(int idx) {
            String code = "R" + (idx + 1);
            return new RowMeta(code, code, idx, null);
        }

        public static RowMeta of(String rowCode) {
            return new RowMeta(rowCode, rowCode, null, null);
        }
    }

    /** Marker interface — record của form-specific implement nó để serializer biết cách lấy meta. */
    public interface GridRow {
        RowMeta meta();
    }

    /**
     * 1 ô dữ liệu self-describing: biết mình thuộc cột nào (A/B/C/D/...) + value.
     * Dùng làm field type của record form-specific để mỗi biến mang theo column code.
     */
    public record Cell(String column, Object value) {
        public static Cell of(String column, Object value) {
            return new Cell(column, value);
        }
    }

    /**
     * Row "động" — {@link RowMeta} + map cell (column → value) đã loại metadata keys.
     * Dùng khi không biết schema trước (preview/debug) hoặc cần truy cập cell theo
     * column name động. Cells immutable.
     */
    public record Row(RowMeta meta, Map<String, Object> cells) implements GridRow {

        public Object value(String column) {
            return cells == null ? null : cells.get(column);
        }

        public String stringValue(String column) {
            return asString(value(column));
        }

        /** Per-cell config (format/formula/merge). Đọc từ {@code meta.cellConfig}. */
        @SuppressWarnings("unchecked")
        public Map<String, Object> configFor(String column) {
            if (meta == null || meta.cellConfig() == null) return null;
            Object c = meta.cellConfig().get(column);
            return (c instanceof Map<?, ?>) ? (Map<String, Object>) c : null;
        }
    }

    /** Set các key metadata — không thuộc cell data, bị strip khi build {@link Row#cells}. */
    private static final Set<String> METADATA_KEYS = Set.of(
            ROW_CODE, ROW_NAME, SORT_ORDER, CELL_CONFIG, IS_TYPE_HEADER
    );

    /** Đọc metadata (rowCode, rowName, sortOrder, cellConfig) từ 1 row map. */
    @SuppressWarnings("unchecked")
    public static RowMeta extractMeta(Map<String, Object> row) {
        Object cfg = row.get(CELL_CONFIG);
        Map<String, Object> cellConfig =
                (cfg instanceof Map<?, ?>) ? (Map<String, Object>) cfg : null;

        Object so = row.get(SORT_ORDER);
        Integer sortOrder = (so instanceof Number) ? ((Number) so).intValue() : null;

        return new RowMeta(
                asString(row.get(ROW_CODE)),
                asString(row.get(ROW_NAME)),
                sortOrder,
                cellConfig
        );
    }

    // ============================================================
    // CORE — dùng chung cho mọi biểu mẫu
    // ============================================================

    public static List<Map<String, Object>> parseRows(String rowDataJson) {
        if (rowDataJson == null || rowDataJson.isBlank()) return Collections.emptyList();
        try {
            List<Map<String, Object>> rows = MAPPER.readValue(rowDataJson, ROW_LIST_TYPE);
            return rows == null ? Collections.emptyList() : rows;
        } catch (Exception e) {
            log.error("GridRowExtractor: parse rowData JSON failed — {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public static <T> List<T> extract(String rowDataJson,
                                      Predicate<Map<String, Object>> filter,
                                      Function<Map<String, Object>, T> mapper) {
        List<Map<String, Object>> rows = parseRows(rowDataJson);
        if (rows.isEmpty()) return Collections.emptyList();

        List<T> result = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            if (!filter.test(row)) continue;
            result.add(mapper.apply(row));
        }
        return result;
    }

    /**
     * Extract toàn bộ row JSON thành {@link Row}. Mỗi Row chứa {@link RowMeta}
     * (rowCode/rowName/sortOrder/cellConfig) + map cell động (đã strip metadata keys).
     * Không filter — caller tự lọc nếu cần.
     */
    public static List<Row> extractRows(String rowDataJson) {
        return extractRows(rowDataJson, row -> true);
    }

    /** Như {@link #extractRows(String)} nhưng có {@code filter} chọn row nào extract. */
    public static List<Row> extractRows(String rowDataJson,
                                        Predicate<Map<String, Object>> filter) {
        return extract(rowDataJson, filter, GridRowExtractor::toRow);
    }

    /** Map raw row → {@link Row}: tách metadata vào {@link RowMeta}, phần còn lại làm cells. */
    private static Row toRow(Map<String, Object> raw) {
        Map<String, Object> cells = new LinkedHashMap<>(raw);
        cells.keySet().removeAll(METADATA_KEYS);
        return new Row(extractMeta(raw), Collections.unmodifiableMap(cells));
    }

    public static String asString(Object v) {
        if (v == null) return null;
        if (v instanceof String s) return s.isBlank() ? null : s;
        return v.toString();
    }

    /** STT của row (Map raw) là chuỗi số nguyên dương. */
    public static boolean isPositiveIntegerStt(Map<String, Object> row) {
        return row != null && isPositiveInteger(row.get(STT));
    }

    /** STT của {@link Row} là chuỗi số nguyên dương — overload để dùng sau khi extract. */
    public static boolean isPositiveIntegerStt(Row row) {
        return row != null && isPositiveInteger(row.value(STT));
    }

    /**
     * Core check: {@code v} (sau {@code toString().trim()}) là chuỗi 1+ ký tự digit (0-9).
     * Char-by-char để tránh chi phí regex compile/match — quan trọng khi hot loop ngàn rows.
     * Private — public API qua {@link #isPositiveIntegerStt} overload.
     */
    private static boolean isPositiveInteger(Object v) {
        if (v == null) return false;
        String s = v.toString().trim();
        int len = s.length();
        if (len == 0) return false;
        for (int i = 0; i < len; i++) {
            char c = s.charAt(i);
            if (c < '0' || c > '9') return false;
        }
        return true;
    }

    // ============================================================
    // FORM-SPECIFIC EXTRACTORS — thêm biểu mẫu mới ở dưới
    // ============================================================

    // ---------- PL159: Đăng ký kế hoạch danh mục SCL năm ----------

    public record Pl159RepairItem(
            RowMeta meta,
            Cell categoryName,
            Cell assetCode,
            Cell scContent,
            Cell gtkt,
            Cell gtcpsql
    ) implements GridRow {}

    public static List<Pl159RepairItem> extractPl159RepairItems(String rowDataJson) {
        return extract(
                rowDataJson,
                e -> true,
                row -> new Pl159RepairItem(
                        extractMeta(row),
                        Cell.of(Constant.TEMPLATE_CONFIG.PL159.CATEGORY_NAME_COL_CODE,
                                asString(row.get(Constant.TEMPLATE_CONFIG.PL159.CATEGORY_NAME_COL_CODE))),
                        Cell.of(Constant.TEMPLATE_CONFIG.PL159.CATEGORY_CODE_COL_CODE,
                                asString(row.get(Constant.TEMPLATE_CONFIG.PL159.CATEGORY_CODE_COL_CODE))),
                        Cell.of(Constant.TEMPLATE_CONFIG.PL159.CONTENT_COL_CODE,
                                asString(row.get(Constant.TEMPLATE_CONFIG.PL159.CONTENT_COL_CODE))),
                        Cell.of(Constant.TEMPLATE_CONFIG.PL159.GTKT_COL_CODE,
                                asString(row.get(Constant.TEMPLATE_CONFIG.PL159.GTKT_COL_CODE))),
                        Cell.of(Constant.TEMPLATE_CONFIG.PL159.GTCPSQL_COL_CODE,
                                asString(row.get(Constant.TEMPLATE_CONFIG.PL159.GTCPSQL_COL_CODE)))
                )
        );
    }

    // ---------- PL158: Đăng ký bổ sung kế hoạch danh mục SCL năm (TODO) ----------
    // public record Pl158Item(...) {}
    // public static List<Pl158Item> extractPl158Items(String rowDataJson) { ... }
}