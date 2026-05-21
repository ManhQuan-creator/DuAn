package org.example.oracleconnectionpool.utils;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Helper build + serialize JSON `GridDataEntry.rowData` từ data nguồn (DTO / record / Map).
 *
 * <p>Đối ngẫu của {@link GridRowExtractor}: extract đọc rowData → record, serializer
 * ghi record → rowData.
 *
 * <p>Core ({@link #toJson}, {@link #build}, {@link #row}) reusable cho mọi biểu mẫu.
 * Form-specific extractor ở phần dưới (PL159, PL158, ...).
 */
@Slf4j
public final class GridRowSerializer {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static final String EMPTY_ROW_DATA_JSON = "[]";

    private GridRowSerializer() {}

    // ============================================================
    // CORE — dùng chung cho mọi biểu mẫu
    // ============================================================

    /**
     * Serialize danh sách row → JSON string. Throw {@link IllegalStateException} nếu fail
     * — tránh ghi rỗng vào DB do lỗi serialize.
     */
    public static String toJson(List<Map<String, Object>> rows) {
        if (rows == null || rows.isEmpty()) return EMPTY_ROW_DATA_JSON;
        try {
            return MAPPER.writeValueAsString(rows);
        } catch (JsonProcessingException e) {
            log.error("GridRowSerializer: serialize rows failed — {}", e.getMessage());
            throw new IllegalStateException("Cannot serialize rowData JSON", e);
        }
    }

    /**
     * Generic: cho mỗi item, gọi {@code mapper} trả 1 row map → serialize cả list ra JSON.
     * Item nào mapper trả {@code null} sẽ bị skip.
     */
    public static <T> String build(List<T> items, Function<T, Map<String, Object>> mapper) {
        if (items == null || items.isEmpty()) return EMPTY_ROW_DATA_JSON;
        List<Map<String, Object>> rows = new ArrayList<>(items.size());
        for (T item : items) {
            Map<String, Object> row = mapper.apply(item);
            if (row != null) rows.add(row);
        }
        return toJson(rows);
    }

    /** Tạo {@link RowBuilder} cho 1 row mới với {@code row_code} = code (row_name = code). */
    public static RowBuilder row(String rowCode) {
        return new RowBuilder().rowCode(rowCode);
    }

    /** Tạo RowBuilder rỗng — caller tự set row_code/row_name. */
    public static RowBuilder row() {
        return new RowBuilder();
    }

    /**
     * Tạo RowBuilder từ {@link GridRowExtractor.RowMeta}, fallback {@code idx} cho field nào null.
     * Tiện cho form-specific build khi item carry sẵn meta từ extract trước đó.
     */
    public static RowBuilder rowFor(int idx, GridRowExtractor.RowMeta meta) {
        String code = (meta != null && meta.rowCode() != null) ? meta.rowCode() : "R" + (idx + 1);
        String name = (meta != null && meta.rowName() != null) ? meta.rowName() : code;
        int order = (meta != null && meta.sortOrder() != null) ? meta.sortOrder() : idx;
        Map<String, Object> cfg = (meta != null) ? meta.cellConfig() : null;
        return new RowBuilder()
                .rowCode(code)
                .rowName(name)
                .sortOrder(order)
                .cellConfig(cfg);
    }

    /**
     * Fluent builder cho 1 row. {@link LinkedHashMap} giữ thứ tự key trong JSON output
     * (FE & test diff dễ đọc hơn HashMap).
     */
    public static final class RowBuilder {
        private final Map<String, Object> data = new LinkedHashMap<>();

        public RowBuilder rowCode(String code) {
            data.put(GridRowExtractor.ROW_CODE, code);
            data.putIfAbsent(GridRowExtractor.ROW_NAME, code);
            return this;
        }

        public RowBuilder rowName(String name) {
            data.put(GridRowExtractor.ROW_NAME, name);
            return this;
        }

        public RowBuilder sortOrder(int order) {
            data.put(GridRowExtractor.SORT_ORDER, order);
            return this;
        }

        public RowBuilder typeHeader(boolean isHeader) {
            if (isHeader) data.put(GridRowExtractor.IS_TYPE_HEADER, true);
            return this;
        }

        public RowBuilder cellConfig(Map<String, Object> config) {
            if (config != null && !config.isEmpty()) data.put(GridRowExtractor.CELL_CONFIG, config);
            return this;
        }

        /** Apply {@link GridRowExtractor.RowMeta}: rowCode/rowName/sortOrder/cellConfig. Field nào null sẽ skip. */
        public RowBuilder fromMeta(GridRowExtractor.RowMeta meta) {
            if (meta == null) return this;
            if (meta.rowCode() != null) rowCode(meta.rowCode());
            if (meta.rowName() != null) rowName(meta.rowName());
            if (meta.sortOrder() != null) sortOrder(meta.sortOrder());
            cellConfig(meta.cellConfig());
            return this;
        }

        /** Set 1 cell. Cho phép value = null (FE phân biệt cell trống vs cell missing). */
        public RowBuilder put(String column, Object value) {
            data.put(column, value);
            return this;
        }

        /** Set 1 cell từ {@link GridRowExtractor.Cell} self-describing. Skip nếu cell hoặc column null. */
        public RowBuilder putCell(GridRowExtractor.Cell cell) {
            if (cell != null && cell.column() != null) {
                data.put(cell.column(), cell.value());
            }
            return this;
        }

        /** Set nhiều cell từ vararg. */
        public RowBuilder putCells(GridRowExtractor.Cell... cells) {
            if (cells != null) for (GridRowExtractor.Cell c : cells) putCell(c);
            return this;
        }

        /** Set nhiều cell từ Map. */
        public RowBuilder putAll(Map<String, ?> cells) {
            if (cells != null) data.putAll(cells);
            return this;
        }

        public Map<String, Object> build() {
            return data;
        }
    }

    // ============================================================
    // FORM-SPECIFIC SERIALIZERS — thêm biểu mẫu mới ở dưới
    // ============================================================

    // ---------- PL159: Đăng ký kế hoạch danh mục SCL năm ----------

    /**
     * Build rowData JSON cho PL159 từ list {@link GridRowExtractor.Pl159RepairItem}.
     * Tự sinh {@code row_code = R{i+1}}, {@code _sortOrder = i}, {@code STT = i+1}.
     * Dùng khi muốn tạo mới entry hoặc thay thế toàn bộ rowData.
     */
    public static String buildPl159RowData(List<GridRowExtractor.Pl159RepairItem> items) {
        if (items == null || items.isEmpty()) return EMPTY_ROW_DATA_JSON;
        List<Map<String, Object>> rows = new ArrayList<>(items.size());
        for (int i = 0; i < items.size(); i++) {
            GridRowExtractor.Pl159RepairItem it = items.get(i);
            rows.add(rowFor(i, it.meta())
                    .put(GridRowExtractor.STT, String.valueOf(i + 1))
                    .putCells(
                            it.categoryName(),
                            it.assetCode(),
                            it.scContent(),
                            it.gtkt(),
                            it.gtcpsql()
                    )
                    .build());
        }
        return toJson(rows);
    }

    // ---------- PL158: Đăng ký bổ sung kế hoạch danh mục SCL năm (TODO) ----------
    // public static String buildPl158RowData(List<...> items) { ... }
}
