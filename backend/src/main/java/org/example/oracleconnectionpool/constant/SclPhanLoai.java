package org.example.oracleconnectionpool.constant;

/**
 * Phân loại SCL dùng cho extractor entry 344 (PL159 — Đăng ký kế hoạch danh mục SCL).
 *
 * <p>Mapping theo Roman section header trong rowData entry 344:
 * <ul>
 *   <li>I "Lưới điện 110kV" → {@link #SCL_110KV}</li>
 *   <li>II "Lưới điện trung thế" → {@link #SCL_TT}</li>
 *   <li>III "Lưới điện hạ thế" → {@link #SCL_HT}</li>
 *   <li>IV "Khác (Kiến trúc, Phương tiện, Viễn thông, thiết bị …)" → {@link #SCL_KHAC}</li>
 * </ul>
 *
 * <p>Latin sub-section (A/B/C/D) trong Roman IV (Kiến trúc/Phương tiện/Viễn thông/Thiết bị)
 * KHÔNG override — tất cả hạng mục dưới Roman IV đều {@code SCL_KHAC}.
 *
 * <p>Các ID khác trong MASTER_CATALOG type=SCL_PHANLOAI ({@code SCL_PT}, {@code SCL_KT},
 * {@code SCL_CNTT}, {@code SCL_TB}) tồn tại cho UI form khác nhưng KHÔNG dùng cho extractor.
 */
public final class SclPhanLoai {

    public static final String SCL_110KV = "SCL_110KV";
    public static final String SCL_TT = "SCL_TT";
    public static final String SCL_HT = "SCL_HT";
    public static final String SCL_KHAC = "SCL_KHAC";

    private SclPhanLoai() {}
}
