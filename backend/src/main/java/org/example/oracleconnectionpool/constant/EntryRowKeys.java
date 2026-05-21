package org.example.oracleconnectionpool.constant;

/**
 * Keys cho 1 phần tử trong JSON `GRID_DATA_ENTRY.ROW_DATA`.
 *
 * Phải đồng bộ với FE convention ở `excel-render.component.ts`
 * (parse entry rowData) và `excel-builder.component.ts` (serialize template).
 *
 * Khi đổi key ở 1 phía, MUST đổi cả 2 phía cùng lúc — không có schema enforcement.
 */
public final class EntryRowKeys {
    public static final String ROW_CODE      = "row_code";
    public static final String ROW_NAME      = "row_name";
    public static final String SORT_ORDER    = "_sortOrder";
    public static final String TYPE_HEADER   = "_isTypeHeader";
    public static final String CATALOG_FIELD = "_catalogField";
    public static final String CELL_CONFIG   = "_cellConfig";

    private EntryRowKeys() {}
}
