package org.example.oracleconnectionpool.constant;

import java.util.Arrays;

/**
 * Kỳ báo cáo của biểu mẫu — quyết định trường nào hiển thị trong form tạo phiên nhập liệu.
 *
 * <p>Dữ liệu lưu trong GRID_DATA_ENTRY giữ nguyên cột year + month, không cần migration:
 * <ul>
 *   <li>{@link #YEAR}      — month = null</li>
 *   <li>{@link #HALF_YEAR} — month = 6 (H1) hoặc 12 (H2)</li>
 *   <li>{@link #QUARTER}   — month = 3 (Q1), 6 (Q2), 9 (Q3), 12 (Q4)</li>
 *   <li>{@link #MONTH}     — month = 1..12</li>
 * </ul>
 */
public enum PeriodType {
    YEAR("Năm"),
    HALF_YEAR("6 tháng"),
    QUARTER("Quý"),
    MONTH("Tháng");

    public static final PeriodType DEFAULT = MONTH;

    private final String label;

    PeriodType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    /**
     * Chuẩn hoá string → PeriodType. Trả {@link #DEFAULT} nếu null/blank/invalid.
     * Dùng khi nhận dữ liệu từ request hoặc khi đọc DB legacy không có giá trị.
     */
    public static PeriodType fromCodeOrDefault(String code) {
        if (code == null || code.isBlank()) return DEFAULT;
        String upper = code.trim().toUpperCase();
        return Arrays.stream(values())
                .filter(p -> p.name().equals(upper))
                .findFirst()
                .orElse(DEFAULT);
    }

    /** Trả tên enum dưới dạng String — tiện cho field VARCHAR trên DB. */
    public static String resolveCode(String code) {
        return fromCodeOrDefault(code).name();
    }
}
