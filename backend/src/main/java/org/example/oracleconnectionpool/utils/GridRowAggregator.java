package org.example.oracleconnectionpool.utils;

import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.utils.GridRowExtractor.Cell;
import org.example.oracleconnectionpool.utils.GridRowExtractor.Row;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

/**
 * Aggregation helpers cho list {@link Row} / record bất kỳ chứa giá trị numeric.
 *
 * <p>Tách khỏi {@link GridRowExtractor} (read) và {@link GridRowSerializer} (write) —
 * compute là concern riêng (Single Responsibility).
 *
 * <p>Sử dụng {@link BigDecimal} để giữ precision (sum tiền/khối lượng không sai số float).
 * Mọi method skip silently null + non-numeric — caller không cần pre-clean data.
 */
@Slf4j
public final class GridRowAggregator {

    private GridRowAggregator() {}

    /**
     * Tính tổng 1 cột trong list {@link Row} động (key = column name trong cells map).
     * Skip null + non-numeric. Trả {@link BigDecimal#ZERO} nếu input rỗng / cột không có.
     *
     * <pre>
     *   List&lt;Row&gt; rows = GridRowExtractor.extractRows(json);
     *   BigDecimal totalGtkt = GridRowAggregator.sumColumn(rows, "gtkt");
     * </pre>
     */
    public static BigDecimal sumColumn(List<Row> rows, String column) {
        if (rows == null || rows.isEmpty() || column == null) return BigDecimal.ZERO;

//        BigDecimal sum = BigDecimal.ZERO;
//        int matched = 0, missing = 0, parseFail = 0;
//        for (Row r : rows) {
//            if (r == null) continue;
//            Object raw = r.value(column);
//            if (raw == null) { missing++; continue; }
//            BigDecimal n = toBigDecimal(raw);
//            if (n == null) { parseFail++; continue; }
//            sum = sum.add(n);
//            matched++;
//        }
//
//        // Diagnostic: nếu sum = 0 mà có rows → 99% là column name sai (case mismatch / typo).
//        // Log keys mẫu của row đầu tiên để user check ngay.
//        if (matched == 0) {
//            Set<String> sampleKeys = sampleCellKeys(rows);
//            log.warn("[sumColumn] column='{}' không match cell nào: rows={}, missing={}, parseFail={}. " +
//                            "Cells keys có sẵn (row đầu): {}",
//                    column, rows.size(), missing, parseFail, sampleKeys);
//        }
        return sumBy(rows, r -> r.value(column));
    }

    /** Lấy keys của row đầu tiên có cells để log diagnostic. */
    private static Set<String> sampleCellKeys(List<Row> rows) {
        for (Row r : rows) {
            if (r != null && r.cells() != null && !r.cells().isEmpty()) {
                return r.cells().keySet();
            }
        }
        return Set.of();
    }

    /**
     * Generic sum reusable cho list bất kỳ: cho mỗi item gọi {@code valueExtractor},
     * parse value sang {@link BigDecimal} rồi cộng dồn. Item nào extractor trả null
     * hoặc không convert được sẽ bị skip.
     *
     * <pre>
     *   // Sum trên Pl159RepairItem (typed record với Cell)
     *   BigDecimal totalGtkt = GridRowAggregator.sumBy(items, it -&gt; it.gtkt().value());
     *
     *   // Sum trên Map<String,Object> raw
     *   BigDecimal totalSl  = GridRowAggregator.sumBy(rawRows, m -&gt; m.get("sl"));
     * </pre>
     */
    public static <T> BigDecimal sumBy(List<T> items, Function<T, Object> valueExtractor) {
        if (items == null || items.isEmpty() || valueExtractor == null) return BigDecimal.ZERO;
        BigDecimal sum = BigDecimal.ZERO;
        for (T item : items) {
            BigDecimal v = toBigDecimal(valueExtractor.apply(item));
            if (v != null) sum = sum.add(v);
        }
        return sum;
    }

    /**
     * Convert Object → {@link BigDecimal} an toàn (null + non-numeric → null).
     *
     * <ul>
     *   <li>{@link BigDecimal}: trả nguyên (không copy)</li>
     *   <li>{@link Number}: qua {@code toString()} — TRÁNH {@code new BigDecimal(double)} vì
     *       lỗi binary float ({@code new BigDecimal(0.1)} → {@code 0.10000000000000000555...}).
     *       {@code Double.toString(0.1)} = {@code "0.1"} → {@code BigDecimal} parse exact.</li>
     *   <li>{@link String}: trim + parse; trả null nếu blank hoặc parse fail</li>
     *   <li>Khác (Boolean/Map/...): null → caller skip</li>
     * </ul>
     */
    public static BigDecimal toBigDecimal(Object v) {
        if (v == null) return null;
        if (v instanceof BigDecimal bd) return bd;
        if (v instanceof Number n) return new BigDecimal(n.toString());
        if (v instanceof String s) {
            String trimmed = s.trim();
            if (trimmed.isEmpty()) return null;
            try {
                return new BigDecimal(trimmed);
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        // Cell record (typed) — unwrap rồi recurse
        if (v instanceof Cell c) return toBigDecimal(c.value());
        // Cell-shaped Map từ Jackson: {"column":"...","value":...} — gặp khi JSON
        // input mang dạng Pl159RepairItem thay vì raw rowData. Unwrap "value" key.
        if (v instanceof Map<?, ?> m && m.containsKey("value")) {
            return toBigDecimal(m.get("value"));
        }
        return null;
    }
}
