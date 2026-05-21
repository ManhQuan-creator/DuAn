package org.example.oracleconnectionpool.utils;

import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFRow;
import org.apache.poi.xssf.usermodel.XSSFSheet;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Generic writer cho báo cáo Excel có dạng <b>group + STT reset + aggregate row + TỔNG CỘNG row</b>.
 *
 * <p>Tách khỏi domain SCL — dùng được cho mọi báo cáo cùng pattern: group items theo 1 key,
 * mỗi group có 1 dòng tên (merge + bold) chứa sum + count, sau đó là data rows STT 1..N reset.
 * Trên cùng (sau header template) là 1 dòng TỔNG CỘNG global.
 *
 * <p>Layout (vị trí cột) tách khỏi spec (cách rút giá trị từ item):
 * <ul>
 *   <li>{@link SheetLayout} — totalCols, vùng merge tên, col ghi chú (vị trí cố định trong template)</li>
 *   <li>{@link GroupingSpec} — cách rút groupKey, row values, sum extractors (tùy DTO)</li>
 * </ul>
 *
 * <p>Style: clone từ data row mẫu trong template tại {@code skipRows} (border / màu /
 * dataformat / alignment). Aggregate rows (TỔNG CỘNG + tên group) thêm bold qua
 * {@link ExcelUtils#cloneStyleWithBold}, riêng cột Ghi chú trên aggregate row có dataFormat
 * integer ({@code "0"}) để ghi numeric (count items). Cột nào trong template thiếu style sẽ
 * fallback về style border-only để mọi cell vẫn có ngăn cách như bảng. STT col luôn ở col 0.
 */
@Slf4j
public class GroupedReportExcelWriter {

    private GroupedReportExcelWriter() {}

    /** DataFormat integer dùng cho cột Ghi chú trên aggregate row. */
    private static final String INTEGER_FORMAT = "0";

    /**
     * Vị trí cột trong sheet — phụ thuộc template, KHÔNG phụ thuộc DTO.
     *
     * @param totalCols      số cột tổng (kể cả STT col 0)
     * @param nameMergeStart col bắt đầu merge ở aggregate rows (KHÔNG bao gồm STT)
     * @param nameMergeEnd   col cuối merge ({@code = nameMergeStart} nếu không merge)
     * @param noteCol        col ghi chú nhận count items (-1 nếu sheet không có)
     */
    public record SheetLayout(int totalCols, int nameMergeStart, int nameMergeEnd, int noteCol) {}

    /**
     * Cột sum: vị trí cột + cách rút giá trị từ item. Caller liệt kê N sum cols tùy ý
     * (sheet không có cột sum nào → list empty).
     */
    public record SumColumn<T>(int colIndex, Function<T, BigDecimal> extractor) {}

    /**
     * Cấu hình data extraction — gắn với DTO.
     *
     * @param groupKey         rút key group từ item (vd {@code dto -> dto.getPc()})
     * @param rowValues        rút mảng giá trị data row (index 0 là placeholder cho STT, ignored)
     * @param sumColumns       danh sách cột sum (rỗng nếu sheet không cần sum)
     * @param groupKeyFallback fallback khi groupKey trả null/blank (vd {@code "(Chưa xác định)"})
     * @param totalRowLabel    label dòng TỔNG CỘNG (vd {@code "TỔNG CỘNG"})
     */
    public record GroupingSpec<T>(
            Function<T, String> groupKey,
            Function<T, String[]> rowValues,
            List<SumColumn<T>> sumColumns,
            String groupKeyFallback,
            String totalRowLabel
    ) {}

    /**
     * Bundle context render cho 1 sheet — gói sheet + layout + spec + 2 maps style cho các
     * helper internal, tránh signature method có quá nhiều params.
     */
    private record RenderContext<T>(XSSFSheet sheet, SheetLayout layout, GroupingSpec<T> spec,
                                    Map<Integer, CellStyle> dataStyles,
                                    Map<Integer, CellStyle> boldStyles) {}

    /**
     * Entry point. No-op nếu sheet null.
     */
    public static <T> void write(XSSFSheet sheet, List<T> items, int skipRows,
                                 SheetLayout layout, GroupingSpec<T> spec) {
        if (sheet == null) return;
        Workbook wb = sheet.getWorkbook();

        XSSFRow templateRow = sheet.getRow(skipRows);
        Map<Integer, CellStyle> dataStyles = ExcelUtils.snapshotColumnStyles(templateRow, layout.totalCols);
        fillMissingBorderedStyles(dataStyles, layout.totalCols, wb);

        Map<Integer, CellStyle> boldStyles = new HashMap<>();
        for (int c = 0; c < layout.totalCols; c++) {
            boldStyles.put(c, ExcelUtils.cloneStyleWithBold(wb, dataStyles.get(c)));
        }
        // Cột Ghi chú trên aggregate row ghi numeric (count items) — override dataFormat sang
        // integer để hiển thị "1" thay vì "1.0" hoặc inherit format "@" text từ data row.
        if (layout.noteCol >= 0) {
            boldStyles.put(layout.noteCol, withIntegerFormat(wb, boldStyles.get(layout.noteCol)));
        }

        RenderContext<T> ctx = new RenderContext<>(sheet, layout, spec, dataStyles, boldStyles);
        Map<String, List<T>> groups = groupBy(items, spec);

        int rowIdx = skipRows;

        // 1) TỔNG CỘNG row đầu tiên — sums global + tổng số items.
        BigDecimal[] globalSums = computeSums(items, spec);
        int totalCount = items != null ? items.size() : 0;
        writeAggregateRow(ctx, rowIdx, spec.totalRowLabel, globalSums, totalCount);
        rowIdx++;

        // 2) Per group: header row (sums + count items group) + data rows STT 1..N reset.
        for (Map.Entry<String, List<T>> entry : groups.entrySet()) {
            List<T> groupItems = entry.getValue();
            BigDecimal[] groupSums = computeSums(groupItems, spec);

            writeAggregateRow(ctx, rowIdx, entry.getKey(), groupSums, groupItems.size());
            rowIdx++;

            int sttIdx = 1;
            for (T it : groupItems) {
                writeDataRow(ctx, rowIdx, sttIdx, spec.rowValues.apply(it));
                sttIdx++;
                rowIdx++;
            }
        }
    }

    private static <T> Map<String, List<T>> groupBy(List<T> items, GroupingSpec<T> spec) {
        if (items == null || items.isEmpty()) return new LinkedHashMap<>();
        return items.stream().collect(Collectors.groupingBy(
                it -> Optional.ofNullable(spec.groupKey.apply(it))
                        .filter(k -> !k.isBlank())
                        .orElse(spec.groupKeyFallback),
                LinkedHashMap::new,
                Collectors.toList()));
    }

    /** Trả mảng sum theo thứ tự {@code spec.sumColumns}. Items null → mảng zero cùng độ dài. */
    private static <T> BigDecimal[] computeSums(List<T> items, GroupingSpec<T> spec) {
        BigDecimal[] sums = new BigDecimal[spec.sumColumns.size()];
        for (int i = 0; i < sums.length; i++) sums[i] = BigDecimal.ZERO;
        if (items == null) return sums;
        for (T it : items) {
            for (int i = 0; i < spec.sumColumns.size(); i++) {
                BigDecimal v = spec.sumColumns.get(i).extractor.apply(it);
                if (v != null) sums[i] = sums[i].add(v);
            }
        }
        return sums;
    }

    private static <T> void writeAggregateRow(RenderContext<T> ctx, int rowIdx, String name,
                                              BigDecimal[] sums, int itemCount) {
        SheetLayout layout = ctx.layout;
        XSSFRow row = ensureRow(ctx.sheet, rowIdx);

        // Apply bold style + tạo cell tất cả các col (giữ border đều như bảng). Cột STT (col 0)
        // cố tình để trống — không tính STT ở dòng aggregate.
        for (int c = 0; c < layout.totalCols; c++) {
            Cell cell = row.getCell(c);
            if (cell == null) cell = row.createCell(c);
            CellStyle s = ctx.boldStyles.get(c);
            if (s != null) cell.setCellStyle(s);
        }

        row.getCell(layout.nameMergeStart).setCellValue(name);

        // Sum cols (numeric — kế thừa dataFormat từ data row trong template).
        for (int i = 0; i < ctx.spec.sumColumns.size(); i++) {
            int col = ctx.spec.sumColumns.get(i).colIndex;
            row.getCell(col).setCellValue(sums[i].doubleValue());
        }

        // Note col: ghi numeric (double) — dataFormat "0" đã set ở boldStyles[noteCol] phía trên,
        // Excel hiển thị thành integer + cho phép tổng SUM/format số như cell tiền.
        if (layout.noteCol >= 0) {
            row.getCell(layout.noteCol).setCellValue((double) itemCount);
        }

        if (layout.nameMergeEnd > layout.nameMergeStart) {
            ctx.sheet.addMergedRegion(new CellRangeAddress(
                    rowIdx, rowIdx, layout.nameMergeStart, layout.nameMergeEnd));
        }
    }

    private static <T> void writeDataRow(RenderContext<T> ctx, int rowIdx, int sttIdx, String[] values) {
        XSSFRow row = ensureRow(ctx.sheet, rowIdx);
        int totalCols = ctx.layout.totalCols;
        for (int c = 0; c < totalCols; c++) {
            Cell cell = row.getCell(c);
            if (cell == null) cell = row.createCell(c);
            CellStyle s = ctx.dataStyles.get(c);
            if (s != null) cell.setCellStyle(s);

            if (c == 0) {
                cell.setCellValue(sttIdx);
            } else if (c < values.length && values[c] != null) {
                cell.setCellValue(values[c]);
            } else {
                cell.setBlank();
            }
        }
    }

    private static XSSFRow ensureRow(XSSFSheet sheet, int idx) {
        XSSFRow r = sheet.getRow(idx);
        return r != null ? r : sheet.createRow(idx);
    }

    /**
     * Đảm bảo mọi col 0..totalCols-1 đều có style: cột nào template thiếu cell mẫu thì fallback
     * về style đầu tiên không null trong map (giữ font/dataFormat/alignment); nếu cả map trống
     * (template không có data row mẫu) thì fallback default border-only.
     */
    private static void fillMissingBorderedStyles(Map<Integer, CellStyle> styles, int totalCols, Workbook wb) {
        CellStyle fallback = null;
        for (int c = 0; c < totalCols; c++) {
            CellStyle s = styles.get(c);
            if (s != null) { fallback = s; break; }
        }
        if (fallback == null) fallback = defaultBorderedStyle(wb);
        for (int c = 0; c < totalCols; c++) {
            styles.putIfAbsent(c, fallback);
        }
    }

    private static CellStyle defaultBorderedStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        s.setBorderTop(BorderStyle.THIN);
        s.setBorderBottom(BorderStyle.THIN);
        s.setBorderLeft(BorderStyle.THIN);
        s.setBorderRight(BorderStyle.THIN);
        return s;
    }

    private static CellStyle withIntegerFormat(Workbook wb, CellStyle base) {
        CellStyle s = wb.createCellStyle();
        if (base != null) s.cloneStyleFrom(base);
        s.setDataFormat(wb.createDataFormat().getFormat(INTEGER_FORMAT));
        return s;
    }
}
