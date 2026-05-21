package org.example.oracleconnectionpool.service.migration;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * One-shot migration: gộp `GRID_DATA_ENTRY.CUSTOM_ROWS` JSON vào
 * `GRID_DATA_ENTRY.ROW_DATA` JSON, sau đó set `CUSTOM_ROWS = NULL`.
 *
 * Lý do: kiến trúc snapshot — entry độc lập với template ngay lúc tạo. `customRows`
 * tách riêng (với `afterRowCode` + `sortOrder`) là legacy artifact từ thời architecture
 * dự định bám live-template; trong snapshot model order array là đủ.
 *
 * Sau migration:
 *  - Mỗi RX row sống trong `rowData` array với flag `_isCustomRow=true`.
 *  - V10 SQL drop column `CUSTOM_ROWS` (manual run sau khi runner success).
 *
 * Idempotent: chỉ scan `WHERE CUSTOM_ROWS IS NOT NULL`. Sau migration successful,
 * customRows = NULL → next startup skip silently. Khi V10 drop column, query
 * sẽ throw → caught + log INFO + skip.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CustomRowsMergeMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!customRowsColumnExists()) {
            log.info("Migration: CUSTOM_ROWS column already dropped — nothing to do.");
            return;
        }

        List<Map<String, Object>> rows;
        try {
            rows = jdbcTemplate.queryForList(
                    "SELECT ID, ROW_DATA, CUSTOM_ROWS FROM GRID_DATA_ENTRY " +
                    "WHERE CUSTOM_ROWS IS NOT NULL AND DBMS_LOB.GETLENGTH(CUSTOM_ROWS) > 2"
            );
        } catch (DataAccessException ex) {
            log.warn("Migration: failed to query GRID_DATA_ENTRY — {}. Skip.", ex.getMessage());
            return;
        }

        if (rows.isEmpty()) {
            log.info("Migration: no entry has non-empty CUSTOM_ROWS — nothing to merge.");
            return;
        }

        log.info("Migration: found {} entries with CUSTOM_ROWS to merge into ROW_DATA.", rows.size());
        int success = 0;
        int skipped = 0;
        for (Map<String, Object> row : rows) {
            Long id = ((Number) row.get("ID")).longValue();
            String rowDataJson = readClob(row.get("ROW_DATA"));
            String customRowsJson = readClob(row.get("CUSTOM_ROWS"));
            try {
                String mergedJson = mergeCustomRowsIntoRowData(rowDataJson, customRowsJson);
                jdbcTemplate.update(
                        "UPDATE GRID_DATA_ENTRY SET ROW_DATA = ?, CUSTOM_ROWS = NULL WHERE ID = ?",
                        mergedJson, id
                );
                success++;
            } catch (Exception ex) {
                log.warn("Migration: skip entry id={} — corrupt JSON or merge failure: {}",
                        id, ex.getMessage());
                skipped++;
            }
        }
        log.info("Migration done: merged {} entries, skipped {} (corrupt). " +
                "Run V10__grid_data_entry_drop_custom_rows.sql manually to drop column.",
                success, skipped);
    }

    /**
     * Check column `CUSTOM_ROWS` còn tồn tại trong `GRID_DATA_ENTRY` (Oracle metadata).
     * Sau V10 drop column, runner skip silently.
     */
    private boolean customRowsColumnExists() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM USER_TAB_COLUMNS " +
                    "WHERE TABLE_NAME = 'GRID_DATA_ENTRY' AND COLUMN_NAME = 'CUSTOM_ROWS'",
                    Integer.class
            );
            return count != null && count > 0;
        } catch (DataAccessException ex) {
            log.warn("Migration: failed to check column existence — {}. Skip.", ex.getMessage());
            return false;
        }
    }

    /** Read CLOB cell value an toàn — Oracle JDBC driver có thể trả String hoặc java.sql.Clob. */
    private String readClob(Object value) {
        if (value == null) return null;
        if (value instanceof String s) return s;
        try {
            java.sql.Clob clob = (java.sql.Clob) value;
            return clob.getSubString(1, (int) clob.length());
        } catch (Exception ex) {
            return null;
        }
    }

    /**
     * Logic merge — mirror `CustomRowsService.injectInto` cũ:
     *  1. Parse rowData → List rows. Custom rows đã trong rowData (snapshot thời cũ)
     *     → giữ nguyên, KHÔNG re-splice (tránh duplicate).
     *  2. Parse customRows → List defs. Bucket theo afterRowCode, sort siblings ASC theo sortOrder.
     *  3. Walk rowData; nếu row.row_code ∈ buckets AND row chưa có RX nào trong rowData
     *     spliced từ def với cùng rowCode → splice defs ngay sau (recursive: spliced row
     *     có thể là anchor cho def khác).
     *  4. Orphan (afterRowCode null/missing) → append cuối.
     *  5. Re-stamp _sortOrder.
     */
    String mergeCustomRowsIntoRowData(String rowDataJson, String customRowsJson) throws Exception {
        List<Map<String, Object>> rowData = parseRowData(rowDataJson);
        List<Map<String, Object>> defs = parseDefs(customRowsJson);

        // Custom rows đã có trong rowData (cùng rowCode) → skip để tránh duplicate.
        java.util.Set<String> existingCodes = new java.util.HashSet<>();
        for (Map<String, Object> r : rowData) {
            Object code = r.get("row_code");
            if (code != null) existingCodes.add(String.valueOf(code));
        }
        defs.removeIf(d -> existingCodes.contains(String.valueOf(d.get("rowCode"))));

        // Bucket defs theo afterRowCode.
        Map<String, List<Map<String, Object>>> buckets = new HashMap<>();
        java.util.Set<String> validCodes = new java.util.HashSet<>(existingCodes);
        for (Map<String, Object> d : defs) {
            validCodes.add(String.valueOf(d.get("rowCode")));
        }
        for (Map<String, Object> d : defs) {
            Object afterRaw = d.get("afterRowCode");
            String key = (afterRaw != null && validCodes.contains(String.valueOf(afterRaw)))
                    ? String.valueOf(afterRaw)
                    : null;
            buckets.computeIfAbsent(key, k -> new ArrayList<>()).add(d);
        }
        for (List<Map<String, Object>> bucket : buckets.values()) {
            bucket.sort(Comparator.comparingInt(d -> ((Number) d.getOrDefault("sortOrder", 0)).intValue()));
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> r : rowData) {
            pushRowAndChildren(r, buckets, result);
        }
        // Orphans append cuối.
        List<Map<String, Object>> orphans = buckets.get(null);
        if (orphans != null) {
            for (Map<String, Object> def : orphans) {
                pushRowAndChildren(buildCustomRow(def), buckets, result);
            }
        }

        // Re-stamp _sortOrder.
        for (int i = 0; i < result.size(); i++) {
            result.get(i).put("_sortOrder", i);
        }

        return objectMapper.writeValueAsString(result);
    }

    private void pushRowAndChildren(
            Map<String, Object> row,
            Map<String, List<Map<String, Object>>> buckets,
            List<Map<String, Object>> out
    ) {
        out.add(row);
        Object code = row.get("row_code");
        if (code == null) return;
        List<Map<String, Object>> children = buckets.get(String.valueOf(code));
        if (children == null) return;
        for (Map<String, Object> def : children) {
            pushRowAndChildren(buildCustomRow(def), buckets, out);
        }
    }

    /** Tạo row object cho 1 def (row_code, row_name, _isCustomRow=true, KHÔNG có cell defaults). */
    private Map<String, Object> buildCustomRow(Map<String, Object> def) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("row_code", def.get("rowCode"));
        Object name = def.getOrDefault("rowName", def.get("rowCode"));
        row.put("row_name", name);
        row.put("_isCustomRow", true);
        return row;
    }

    private List<Map<String, Object>> parseRowData(String json) throws Exception {
        if (json == null || json.isBlank() || "[]".equals(json.trim())) return new ArrayList<>();
        return objectMapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
    }

    private List<Map<String, Object>> parseDefs(String json) throws Exception {
        if (json == null || json.isBlank() || "[]".equals(json.trim())) return new ArrayList<>();
        List<Map<String, Object>> defs = objectMapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
        return defs == null ? Collections.emptyList() : defs;
    }
}
