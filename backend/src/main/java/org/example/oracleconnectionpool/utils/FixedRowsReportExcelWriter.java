package org.example.oracleconnectionpool.utils;

import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFSheet;

import java.util.List;
import java.util.Map;

/**
 * Writer cho báo cáo Excel có template với <b>rows + công thức cố định</b>.
 *
 * <p>Pattern: template đã design sẵn N rows (vd 17 đơn vị) + tên row + cell công thức (TỔNG CỘNG,
 * tỷ lệ %, chênh lệch...). Service chỉ cần fill <b>input cells</b> (cell chưa có công thức) cho
 * mỗi row; Excel tự recalc các formula cells khi mở file.
 *
 * <p>Hành vi:
 * <ul>
 *   <li>Cell có {@code CellType.FORMULA} — KHÔNG đụng tới (giữ nguyên công thức).</li>
 *   <li>Row key không có trong {@code dataByKey} — set <b>blank</b> tất cả {@code inputCols}
 *       (phân biệt rõ "đơn vị không có data" vs "data = 0"). Excel SUM coi blank như 0 nên
 *       formula tổng vẫn ra 0; nếu template có công thức chia cell input → chấp nhận
 *       {@code #DIV/0!}, caller cần wrap {@code IFERROR} trong template nếu muốn ẩn.</li>
 *   <li>Col index trong {@code inputCols} mà data thiếu giá trị → set <b>blank</b>.</li>
 *   <li>Row trong template không tồn tại (mismatch số lượng rowKeys vs template) — log warn,
 *       skip row đó.</li>
 *   <li>Cuối cùng gọi {@code wb.setForceFormulaRecalculation(true)} để Excel recalc khi mở.</li>
 * </ul>
 */
@Slf4j
public class FixedRowsReportExcelWriter {

    private FixedRowsReportExcelWriter() {}

    /**
     * @param sheet       sheet đích (template đã có rows + formula)
     * @param rowKeys     key cố định khớp THỨ TỰ row trong template (vd ["PCHP", "PCNB", ...])
     * @param firstRowIdx row index 0-based của rowKeys[0] trong sheet (vd Excel row 5 → idx 4)
     * @param inputCols   col index nhận data; col ngoài list giữ nguyên (kể cả formula)
     * @param dataByKey   rowKey → (colIdx → value); thiếu rowKey/colIdx → set blank
     */
    public static void write(XSSFSheet sheet,
                             List<String> rowKeys,
                             int firstRowIdx,
                             List<Integer> inputCols,
                             Map<String, Map<Integer, ? extends Number>> dataByKey) {
        if (sheet == null || rowKeys == null || rowKeys.isEmpty() || inputCols == null) return;

        for (int i = 0; i < rowKeys.size(); i++) {
            String key = rowKeys.get(i);
            int rowIdx = firstRowIdx + i;
            Row row = sheet.getRow(rowIdx);
            if (row == null) {
                log.warn("[FixedRows] sheet '{}' row {} không tồn tại trong template (key={}) — skip",
                        sheet.getSheetName(), rowIdx, key);
                continue;
            }
            Map<Integer, ? extends Number> data = dataByKey != null
                    ? dataByKey.getOrDefault(key, Map.of())
                    : Map.of();
            for (int col : inputCols) {
                Number v = data.get(col);
                if (v != null) {
                    ExcelUtils.setNumericPreservingFormula(row, col, v.doubleValue());
                } else {
                    ExcelUtils.setBlankPreservingFormula(row, col);
                }
            }
        }

        // Excel sẽ recalc tất cả formula cells khi user mở file. Tránh phải dùng
        // FormulaEvaluator.evaluateAll() (tốn CPU server, formula phức tạp đôi khi POI eval sai).
        sheet.getWorkbook().setForceFormulaRecalculation(true);
    }
}
