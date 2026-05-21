package org.example.oracleconnectionpool.utils;

import java.util.regex.Pattern;

/**
 * Decision token cho state machine của các extractor — phân loại STT cell:
 * blank → {@link #META}; "I/II/III/IV" → {@link #ROMAN_SECTION}; 1 ký tự A-Z →
 * {@link #LATIN_SUB_SECTION}; chỉ chữ số → {@link #DATA_ITEM}; còn lại →
 * {@link #UNKNOWN}. Pattern STT khác (vd cột LEVEL=0/1/2) → tạo enum riêng,
 * KHÔNG sửa hằng ở đây.
 */
public enum EntryRowKind {

    /** Dòng meta — STT rỗng (vd dòng tổng cộng, ghi chú). Skip khi extract. */
    META,
    /** Header section chính — STT là chữ La Mã (I, II, III, IV). Set context phân loại. */
    ROMAN_SECTION,
    /** Sub-section header — STT là 1 chữ cái Latin viết hoa. Tuỳ extractor decide override hay skip. */
    LATIN_SUB_SECTION,
    /** Hàng dữ liệu thực — STT là số nguyên dương. Build target entity. */
    DATA_ITEM,
    /** Khác (thập phân, ký tự lạ) — extractor tự quyết skip hay log. */
    UNKNOWN;

    private static final Pattern ROMAN_PATTERN = Pattern.compile("^(I|II|III|IV)$");
    private static final Pattern LATIN_PATTERN = Pattern.compile("^[A-Z]$");
    private static final Pattern INTEGER_PATTERN = Pattern.compile("^\\d+$");

    /** Classify từ giá trị raw (Object) — tự trim + null-safe. */
    public static EntryRowKind classify(Object stt) {
        return classify(stt == null ? "" : String.valueOf(stt).trim());
    }

    /** Classify từ chuỗi đã trim. */
    public static EntryRowKind classify(String stt) {
        if (stt == null || stt.isEmpty()) return META;
        if (ROMAN_PATTERN.matcher(stt).matches()) return ROMAN_SECTION;
        if (LATIN_PATTERN.matcher(stt).matches()) return LATIN_SUB_SECTION;
        if (INTEGER_PATTERN.matcher(stt).matches()) return DATA_ITEM;
        return UNKNOWN;
    }
}
