package org.example.oracleconnectionpool.utils;

import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFRow;
import org.apache.poi.xssf.streaming.SXSSFSheet;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.apache.poi.xssf.usermodel.XSSFRow;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.example.oracleconnectionpool.annotation.ExcelColumn;
import org.example.oracleconnectionpool.constant.Constant;
import org.example.oracleconnectionpool.constant.DateFormatEnum;
import org.example.oracleconnectionpool.enums.BaseEnum;
import org.springframework.format.annotation.DateTimeFormat;

import java.io.IOException;
import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
public class ExcelUtils {
    /** Pattern cho placeholder dạng {@code ${key}} trong cell text. */
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\$\\{([^}]+)}");

    /**
     * Spec fill data cho 1 sheet trong template.
     * @param data     danh sách item — mỗi item map sang 1 row, dùng @ExcelColumn ở field DTO làm thứ tự cột.
     * @param skipRows số dòng từ đầu sheet bỏ qua (header/title trong template), data fill bắt đầu từ row index này.
     */
    public record SheetBinding(List<?> data, int skipRows) {}

    // hàm export
    public static <T> void export(HttpServletResponse response, Class<T> clazz, List<T> data, String fileName) {
        try {
            export(response, clazz, data, fileName, fileName);
        } catch (IOException e) {
            log.error(e.getMessage());
            throw new RuntimeException(e);
        }
    }

    public static <T> void export(HttpServletResponse response, Class<T> clazz, List<T> data, String fileName,
                                  String paramName) throws IOException {
        Workbook workbook = getWorkBox(clazz, data, paramName);
        writeXlsx(response, workbook, fileName + Constant.ExtensionFile.XLSX);
    }

    public static <T> Workbook getWorkBox(Class<T> clazz, List<T> data, String paramName) {
        SXSSFWorkbook workbook = new SXSSFWorkbook();
        SXSSFSheet sheet = workbook.createSheet("Sheet1");

        // Tính lastCol
        List<String> alias = new ArrayList<>();
        List<String> column = new ArrayList<>();
        extractFiled(clazz, alias, column);

        // 2) Viết header và data như bình thường
        int rowIndex = writeHeader(sheet, 0, alias, paramName);
        CellStyle sttStyle = styleForSttCell(sheet);
        CellStyle dataStyle = styleForDataCell(sheet);
        int index = 1;
        try {
            for (T item : data) {
                Row row = sheet.createRow(rowIndex++);
                writeValue(column, row, item, index++, sheet, dataStyle, sttStyle);
            }
        } catch (Exception e) {
            log.error(e.getMessage());
            throw new RuntimeException("error when export to excel");
        }

        return workbook;
    }

    private static <T> void writeValue(List<String> fields, Row row, T item, int index, SXSSFSheet sheet,
                                       CellStyle dataStyle, CellStyle sttStyle)
            throws NoSuchFieldException, IllegalAccessException {
        // Chuẩn bị style reuse
        // 1) Ghi STT và căn giữa
        Cell cell = row.createCell(0);
        cell.setCellValue(index);
        cell.setCellStyle(sttStyle); // <-- áp styleForSttCell

        // 2) Ghi các cột dữ liệu còn lại
        for (int i = 0; i < fields.size(); i++) {
            cell = row.createCell(i + 1);
            String fieldName = fields.get(i);

            // Lấy field từ class hoặc superclass
            Field field = getFieldRecursive(item.getClass(), fieldName);

            // Ghi giá trị vào cell
            setRowValue(cell, field, item, sheet);

            // Áp style cho dữ liệu
            cell.setCellStyle(dataStyle);
        }
    }

    // Chuyển dữ liệu từ java -> excel
    public static <T> void setRowValue(Cell cell, Field field, T clazz, SXSSFSheet sheet) throws IllegalAccessException {
        field.setAccessible(true);
        Object value = field.get(clazz);
        if (value == null) {
            cell.setCellValue("");
            return;
        }
        if (value instanceof String) {
            cell.setCellValue((String) value);
        } else if (value instanceof Number) {
            cell.setCellValue(((Number) value).doubleValue());
        } else if (value instanceof Boolean) {
            cell.setCellValue((Boolean) value);
        } else if (value instanceof Date) {
            String dateFormat = DateFormatEnum.DD_MM_YYYY_HH_MM_SS.getValue();
            if(field.isAnnotationPresent(DateTimeFormat.class)) {
                dateFormat = field.getAnnotation(DateTimeFormat.class).pattern();
            }
            String text = new SimpleDateFormat(dateFormat).format((Date) value);
            cell.setCellValue(text);
        } else if (value instanceof Calendar) {
            String dateFormat = DateFormatEnum.DD_MM_YYYY_HH_MM_SS.getValue();
            if(field.isAnnotationPresent(DateTimeFormat.class)) {
                dateFormat = field.getAnnotation(DateTimeFormat.class).pattern();
            }
            String text = new SimpleDateFormat(dateFormat).format(((Calendar) value).getTime());
            cell.setCellValue(text);
        } else if (value instanceof LocalDateTime) {
            String dateFormat = DateFormatEnum.DD_MM_YYYY_HH_MM_SS.getValue();
            if(field.isAnnotationPresent(DateTimeFormat.class)) {
                dateFormat = field.getAnnotation(DateTimeFormat.class).pattern();
            }
            String text = ((LocalDateTime) value)
                    .format(DateTimeFormatter.ofPattern(dateFormat));
            cell.setCellValue(text);
        } else if (value instanceof LocalDate) {
            String dateFormat = DateFormatEnum.DD_MM_YYYY_HH_MM_SS.getValue();
            if(field.isAnnotationPresent(DateTimeFormat.class)) {
                dateFormat = field.getAnnotation(DateTimeFormat.class).pattern();
            }

            String text;
            if(dateFormat.equals(DateFormatEnum.DD_MM_YYYY_HH_MM_SS.getValue())) {
                text = ((LocalDate) value).format(DateTimeFormatter.ofPattern(DateFormatEnum.DD_MM_YYYY.getValue())) + " 00:00:00";
            } else {
                text = ((LocalDate) value).format(DateTimeFormatter.ofPattern(DateFormatEnum.DD_MM_YYYY.getValue()));
            }
            cell.setCellValue(text);
        } else if (value instanceof BaseEnum) {
            Object text = ((BaseEnum<?>) value).getValue();
            cell.setCellValue(text != null ? text.toString() : "");
        } else {
            cell.setCellValue(String.valueOf(value));
        }
    }

    // lấy annotation từ thằng cha
    private static Field getFieldRecursive(Class<?> clazz, String fieldName) throws NoSuchFieldException {
        while (clazz != null && clazz != Object.class) {
            try {
                return clazz.getDeclaredField(fieldName);
            } catch (NoSuchFieldException e) {
                clazz = clazz.getSuperclass(); // tiếp tục tìm ở class cha
            }
        }
        throw new NoSuchFieldException("Field not found: " + fieldName);
    }

    public static CellStyle styleForDataCell(SXSSFSheet sheet) {
        DataFormat df = sheet.getWorkbook().createDataFormat();
        CellStyle cellStyle = sheet.getWorkbook().createCellStyle();
        cellStyle.setDataFormat(df.getFormat("@"));
        setAllBorder(cellStyle, BorderStyle.THIN);
        cellStyle.setAlignment(HorizontalAlignment.LEFT);
        cellStyle.setVerticalAlignment(VerticalAlignment.TOP);
        cellStyle.setWrapText(true);
        return cellStyle;
    }

    public static CellStyle styleForSttCell(SXSSFSheet sheet) {
        DataFormat df = sheet.getWorkbook().createDataFormat();
        CellStyle cellStyle = sheet.getWorkbook().createCellStyle();
        cellStyle.setDataFormat(df.getFormat("@"));
        setAllBorder(cellStyle, BorderStyle.THIN);
        cellStyle.setAlignment(HorizontalAlignment.CENTER); // căn giữa ngang
        cellStyle.setVerticalAlignment(VerticalAlignment.CENTER); // căn giữa dọc
        return cellStyle;
    }

    public static int writeHeader(SXSSFSheet sheet, int rowIndex, List<String> columnHeader, String paramName) {
        Workbook wb = sheet.getWorkbook();

        // Số cột của bảng: STT + columnHeader.size()
        int totalCols = columnHeader.size() + 1;
        int lastCol = totalCols - 1;

        // Tạo các Style
        CellStyle titleStyle = createTextStyle(wb, (short) 11, true,
                HorizontalAlignment.LEFT,
                VerticalAlignment.CENTER);
        CellStyle dateStyle = createTextStyle(wb, (short) 11, true,
                HorizontalAlignment.LEFT,
                VerticalAlignment.CENTER);
        CellStyle paramStyle = createTextStyle(wb, (short) 14, true,
                HorizontalAlignment.CENTER,
                VerticalAlignment.CENTER);
        CellStyle headerStyle = styleForHeader(sheet); // styleForHeader đã có border + center

        // 1) Dòng Title: merge toàn vùng, font12, căn trái
        {
            SXSSFRow row = sheet.createRow(rowIndex);
            row.setHeightInPoints(22);
            Cell cell = row.createCell(0);
            cell.setCellStyle(titleStyle);
            cell.setCellValue("TỔNG CÔNG TY ĐIỆN LỰC MIỀN BẮC");
            sheet.addMergedRegion(new CellRangeAddress(
                    rowIndex, rowIndex, // từ hàng này
                    0, lastCol // merge từ cột 0 tới cột cuối
            ));
            rowIndex++;
        }

        // 2) Dòng Ngày tạo: font10, căn trái, tại cột 0
        {
            SXSSFRow row = sheet.createRow(rowIndex);
            row.setHeightInPoints(18);
            String formattedDate = LocalDate.now()
                    .format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
            Cell cell = row.createCell(0);
            cell.setCellStyle(dateStyle);
            cell.setCellValue("Ngày tạo: " + formattedDate);
            rowIndex++;
        }

        // 3) Dòng ParamName: merge toàn vùng, font14 bold, căn giữa, tăng row height
        {
            SXSSFRow row = sheet.createRow(rowIndex);
            row.setHeightInPoints(25);
            Cell cell = row.createCell(0);
            cell.setCellStyle(paramStyle);
            cell.setCellValue(paramName.toUpperCase());
            sheet.addMergedRegion(new CellRangeAddress(
                    rowIndex, rowIndex,
                    0, lastCol));
            rowIndex += 2; // để trống 1 dòng trước khi vào header bảng
        }

        // 4) Dòng header của bảng: STT + UPPERCASE các columnHeader
        {
            SXSSFRow row = sheet.createRow(rowIndex);
            // STT
            Cell cell = row.createCell(0);
            row.setHeightInPoints(20);
            cell.setCellStyle(headerStyle);
            cell.setCellValue("STT");
            // Các column còn lại
            for (int i = 0; i < columnHeader.size(); i++) {
                cell = row.createCell(i + 1);
                cell.setCellStyle(headerStyle);
                cell.setCellValue(columnHeader.get(i).toUpperCase());
            }
            setWidthColumn(sheet, columnHeader);
            rowIndex++;
        }

        return rowIndex;
    }

    private static void setWidthColumn(SXSSFSheet sheet, List<String> columnHeader) {
        for (int i = 0; i < columnHeader.size(); i++) {
            int width = columnHeader.get(i).length();
            sheet.setColumnWidth(i + 1, Math.max((width * 400), 3000)); // i + 1 vì cột đầu tiên là STT
        }
    }

    // style cho header excel
    public static CellStyle styleForHeader(SXSSFSheet sheet) {
        Workbook wb = sheet.getWorkbook();
        Font font = wb.createFont();
        font.setFontName("Times New Roman");
        font.setBold(true);

        CellStyle cellStyle = wb.createCellStyle();
        cellStyle.setFont(font);
        // cellStyle.setFillForegroundColor(IndexedColors.SEA_GREEN.getIndex());
        // cellStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

        // border 4 cạnh
        setAllBorder(cellStyle, BorderStyle.THIN);

        cellStyle.setAlignment(HorizontalAlignment.CENTER);
        cellStyle.setVerticalAlignment(VerticalAlignment.CENTER);
        return cellStyle;
    }

    public static void setAllBorder(CellStyle cellStyle, BorderStyle borderStyle) {
        cellStyle.setBorderTop(borderStyle);
        cellStyle.setBorderBottom(borderStyle);
        cellStyle.setBorderLeft(borderStyle);
        cellStyle.setBorderRight(borderStyle);
    }

    public static CellStyle createTextStyle(Workbook wb, short fontSize, boolean bold, HorizontalAlignment halign,
                                            VerticalAlignment valign) {
        Font font = wb.createFont();
        font.setFontName("Times New Roman");
        font.setFontHeightInPoints(fontSize);
        font.setBold(bold);

        CellStyle style = wb.createCellStyle();
        style.setFont(font);
        style.setAlignment(halign);
        style.setVerticalAlignment(valign);
        return style;
    }

    private static <T> void extractFiled(Class<?> clazz, List<String> anFiled, List<String> nameFiled) {
        // Class<?> clazz = object.getClass();
        while (clazz != null && clazz != Object.class) {
            Field[] fields = clazz.getDeclaredFields();

            for (Field field : fields) {
                ExcelColumn annotation = field.getAnnotation(ExcelColumn.class);
                if (annotation != null) {
                    field.setAccessible(true); // Cho phép truy cập cả field private
                    nameFiled.add(field.getName());
                    anFiled.add(annotation.value());
                }
            }

            // Di chuyển lên class cha để tiếp tục duyệt
            clazz = clazz.getSuperclass();
        }

    }

    private static void writeXlsx(HttpServletResponse resp, Workbook wb, String filename) throws IOException {
        resp.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        resp.setHeader("Content-Disposition",
                buildContentDisposition(filename.endsWith(Constant.ExtensionFile.XLSX) ? filename : filename + Constant.ExtensionFile.XLSX));

        try (ServletOutputStream out = resp.getOutputStream()) {
            wb.write(out);
            out.flush();
        } finally {
            // Với SXSSFWorkbook, close() cũng xóa toàn bộ file tạm.
            wb.close();
        }
    }

    private static String trimChar(String s, char ch) {
        if (s == null || s.isEmpty()) return s;
        int start = 0;
        int end = s.length();

        while (start < end && s.charAt(start) == ch) start++;
        while (end > start && s.charAt(end - 1) == ch) end--;

        return (start == 0 && end == s.length()) ? s : s.substring(start, end);
    }

    private static String buildContentDisposition(String rawFileName) {
        // Tách extension (giữ nguyên .xlsx/.xlsm/... nếu có)
        String name = rawFileName;
        String ext = "";
        int dot = rawFileName.lastIndexOf('.');
        if (dot > 0 && dot < rawFileName.length() - 1) {
            name = rawFileName.substring(0, dot);
            ext  = rawFileName.substring(dot); // gồm cả dấu chấm
        }

        // 1) ASCII fallback: map Đ/đ, bỏ dấu, lọc ký tự
        String asciiBase = java.text.Normalizer.normalize(
                        name.replace('Đ','D').replace('đ','d'),
                        java.text.Normalizer.Form.NFD
                )
                .replaceAll("\\p{M}", "")                 // bỏ diacritics
                .replaceAll("[^A-Za-z0-9_.-]", "_")      // chỉ giữ ASCII an toàn
                .replaceAll("_+", "_");                    // gọn bớt _

        asciiBase = trimChar(asciiBase, '_');

        if (asciiBase.isEmpty()) asciiBase = "download";
        String asciiFallback = asciiBase + (ext.isBlank() ? "" : ext);

        // 2) UTF-8 filename* theo RFC 5987
        String encoded = java.net.URLEncoder
                .encode(rawFileName, java.nio.charset.StandardCharsets.UTF_8)
                .replace("+", "%20");

        return "attachment; " +
                "filename=\"" + asciiFallback + "\"; " +
                "filename*=UTF-8''" + encoded;
    }

    /**
     * Fill {@code data} vào {@link XSSFSheet} bắt đầu từ row index = {@code skipRows}.
     *
     * <p>Mapping cột: theo thứ tự khai báo field có {@link ExcelColumn @ExcelColumn} trong DTO
     * (field đầu tiên → col A = 0, field thứ 2 → col B = 1, ...). Field không annotation → bỏ qua.
     *
     * <p>Style copy từ template: snapshot {@link CellStyle} của từng cell trong row mẫu tại
     * {@code skipRows} (font / màu nền / border / dataFormat / alignment / wrap đều bám theo
     * style POI trong workbook gốc) rồi apply cho mọi row data ghi mới. Row height cũng được
     * copy. Style là shared reference — không clone, an toàn vì chỉ đọc.
     *
     * <p>Nếu row mẫu trống (template không có dòng dữ liệu mẫu) → cell ghi mới sẽ dùng default
     * style của workbook. Khuyến nghị template để 1 dòng mẫu format sẵn ở row {@code skipRows}.
     *
     * @param sheet    sheet đích (phải là XSSF — đọc style template cần XSSFRow)
     * @param data     list item (null/empty → no-op)
     * @param skipRows số dòng bỏ qua từ đầu sheet (header/title); data row đầu tiên = skipRows
     */
    public static void bindParamToSheet(XSSFSheet sheet, List<?> data, int skipRows) {
        if (sheet == null || data == null || data.isEmpty()) return;
        if (skipRows < 0) throw new IllegalArgumentException("skipRows < 0");

        Class<?> clazz = data.get(0).getClass();
        List<String> alias = new ArrayList<>();
        List<String> fieldNames = new ArrayList<>();
        extractFiled(clazz, alias, fieldNames);

        if (fieldNames.isEmpty()) {
            log.warn("[bindParamToSheet] DTO {} không có @ExcelColumn nào — skip sheet '{}'",
                    clazz.getName(), sheet.getSheetName());
            return;
        }

        XSSFRow templateRow = sheet.getRow(skipRows);
        Map<Integer, CellStyle> colStyles = snapshotColumnStyles(templateRow, fieldNames.size());
        short templateHeight = templateRow != null ? templateRow.getHeight() : -1;

        int rowIndex = skipRows;
        for (Object item : data) {
            writeDataRow(sheet, rowIndex++, item, clazz, fieldNames, colStyles, templateHeight);
        }
    }

    /** Snapshot CellStyle của row mẫu theo từng cột (col 0..colCount-1). */
    public static Map<Integer, CellStyle> snapshotColumnStyles(XSSFRow templateRow, int colCount) {
        Map<Integer, CellStyle> map = new HashMap<>();
        if (templateRow == null) return map;
        for (int c = 0; c < colCount; c++) {
            Cell tc = templateRow.getCell(c);
            if (tc != null) map.put(c, tc.getCellStyle());
        }
        return map;
    }

    /**
     * Clone {@link CellStyle} gốc và ép font BOLD. Dùng cho aggregate rows (TỔNG CỘNG, group
     * header) — kế thừa nguyên border / màu nền / dataFormat / alignment / wrap của data row
     * trong template, chỉ thay font sang đậm.
     *
     * <p>Workbook quirk: POI không expose `setBold` trực tiếp trên CellStyle — phải tạo Font
     * mới copy thuộc tính font gốc + bật bold + assign vào style clone.
     */
    public static CellStyle cloneStyleWithBold(Workbook wb, CellStyle base) {
        CellStyle clone = wb.createCellStyle();
        if (base != null) clone.cloneStyleFrom(base);

        Font boldFont = wb.createFont();
        if (base != null) {
            Font baseFont = wb.getFontAt(base.getFontIndexAsInt());
            if (baseFont != null) {
                boldFont.setFontName(baseFont.getFontName());
                boldFont.setFontHeightInPoints(baseFont.getFontHeightInPoints());
                boldFont.setColor(baseFont.getColor());
                boldFont.setItalic(baseFont.getItalic());
                boldFont.setUnderline(baseFont.getUnderline());
                boldFont.setStrikeout(baseFont.getStrikeout());
            }
        } else {
            boldFont.setFontName("Times New Roman");
            boldFont.setFontHeightInPoints((short) 11);
        }
        boldFont.setBold(true);
        clone.setFont(boldFont);
        return clone;
    }

    private static void writeDataRow(XSSFSheet sheet, int rowIndex, Object item, Class<?> clazz,
                                     List<String> fieldNames, Map<Integer, CellStyle> colStyles, short rowHeight) {
        XSSFRow row = sheet.getRow(rowIndex);
        if (row == null) row = sheet.createRow(rowIndex);
        if (rowHeight > 0) row.setHeight(rowHeight);

        for (int c = 0; c < fieldNames.size(); c++) {
            Cell cell = row.getCell(c);
            if (cell == null) cell = row.createCell(c);

            CellStyle style = colStyles.get(c);
            if (style != null) cell.setCellStyle(style);

            try {
                Field field = getFieldRecursive(clazz, fieldNames.get(c));
                setCellValue(cell, field, item);
            } catch (NoSuchFieldException | IllegalAccessException e) {
                log.warn("[bindParamToSheet] Sheet '{}' row {} field '{}' lỗi set value: {}",
                        sheet.getSheetName(), rowIndex, fieldNames.get(c), e.getMessage());
                cell.setBlank();
            }
        }
    }

    /**
     * Set value từ field-of-item vào cell — sheet-type agnostic (XSSF/SXSSF dùng chung).
     * Tách từ {@link #setRowValue} để tái sử dụng cho {@link #bindParamToSheet}.
     */
    @SuppressWarnings("java:S3011") // reflection access cần thiết để đọc field private của DTO
    private static void setCellValue(Cell cell, Field field, Object item) throws IllegalAccessException {
        field.setAccessible(true);
        Object value = field.get(item);
        if (value == null) {
            cell.setBlank();
            return;
        }
        switch (value) {
            case String s -> cell.setCellValue(s);
            case Number n -> cell.setCellValue(n.doubleValue());
            case Boolean b -> cell.setCellValue(b);
            case Date d ->
                    cell.setCellValue(new SimpleDateFormat(datePattern(field, DateFormatEnum.DD_MM_YYYY_HH_MM_SS)).format(d));
            case Calendar cal ->
                    cell.setCellValue(new SimpleDateFormat(datePattern(field, DateFormatEnum.DD_MM_YYYY_HH_MM_SS)).format(cal.getTime()));
            case LocalDateTime ldt ->
                    cell.setCellValue(ldt.format(DateTimeFormatter.ofPattern(datePattern(field, DateFormatEnum.DD_MM_YYYY_HH_MM_SS))));
            case LocalDate ld ->
                    cell.setCellValue(ld.format(DateTimeFormatter.ofPattern(datePattern(field, DateFormatEnum.DD_MM_YYYY))));
            case BaseEnum<?> be -> {
                String text = be.getValue();
                cell.setCellValue(text != null ? text : "");
            }
            default -> cell.setCellValue(String.valueOf(value));
        }
    }

    /** Lấy date pattern từ {@link DateTimeFormat} trên field, fallback về enum mặc định. */
    private static String datePattern(Field field, DateFormatEnum fallback) {
        return field.isAnnotationPresent(DateTimeFormat.class)
                ? field.getAnnotation(DateTimeFormat.class).pattern()
                : fallback.getValue();
    }

    /**
     * Ghi value numeric vào cell ({@code row.col}); KHÔNG đụng cell type FORMULA. Tạo cell nếu
     * chưa có. Dùng cho template export có công thức sẵn — chỉ điền input cells, để Excel tự
     * recalc các cell formula khi mở file.
     */
    public static void setNumericPreservingFormula(Row row, int col, double value) {
        if (row == null) return;
        Cell cell = row.getCell(col);
        if (cell == null) cell = row.createCell(col);
        if (cell.getCellType() == CellType.FORMULA) return;
        cell.setCellValue(value);
    }

    /**
     * Set cell ({@code row.col}) về blank; KHÔNG đụng cell type FORMULA. Cell chưa tồn tại trong
     * template → no-op (đã blank sẵn). Dùng để xóa giá trị input cũ khi không có data, thay vì
     * fill 0 — giúp báo cáo phân biệt "đơn vị không có data" vs "data = 0".
     */
    public static void setBlankPreservingFormula(Row row, int col) {
        if (row == null) return;
        Cell cell = row.getCell(col);
        if (cell == null) return;
        if (cell.getCellType() == CellType.FORMULA) return;
        cell.setBlank();
    }

    /**
     * Đảm bảo mọi col từ {@code firstCol}..{@code lastCol} có column width >= {@code minWidth}
     * (đơn vị POI: 1/256 char width, vd 256 = 1 ký tự). Cột đã rộng hơn minWidth giữ nguyên.
     *
     * <p>Dùng để tránh hiển thị "#####" khi cell chứa số lớn vượt độ rộng template. Excel mặc
     * định ~2925 unit (~11 ký tự); số tiền tỷ (12-15 ký tự + thousand separator) cần >= 4500.
     */
    public static void ensureMinColumnWidth(Sheet sheet, int firstCol, int lastCol, int minWidth) {
        if (sheet == null || firstCol > lastCol) return;
        for (int c = firstCol; c <= lastCol; c++) {
            if (sheet.getColumnWidth(c) < minWidth) {
                sheet.setColumnWidth(c, minWidth);
            }
        }
    }

    /**
     * Parse chuỗi tiền (có thể chứa "," thousand separator hoặc whitespace) thành
     * {@link BigDecimal}. Null / blank / lỗi format → trả {@code BigDecimal.ZERO},
     * KHÔNG throw — phù hợp cho dùng trong stream sum mà không phải try/catch riêng.
     */
    public static BigDecimal parseDecimalSafe(String s) {
        if (s == null || s.isBlank()) return BigDecimal.ZERO;
        try {
            return new BigDecimal(s.replace(",", "").replace(" ", "").trim());
        } catch (NumberFormatException e) {
            log.debug("[ExcelUtils] parseDecimalSafe — không parse được '{}', dùng 0", s);
            return BigDecimal.ZERO;
        }
    }

    /**
     * Quét toàn bộ workbook (mọi sheet, mọi cell có CellType = STRING) và thay placeholder
     * dạng {@code ${key}} bằng giá trị trong {@code vars}. Key không có trong map → giữ nguyên.
     *
     * <p>Dùng để fill biến template (vd {@code ${year}}, {@code ${reportDate}}). Gọi 1 lần ở
     * đầu workbook callback trước khi writer fill data rows. Cell có công thức / numeric / date
     * không bị đụng tới — chỉ string cells.
     *
     * @param wb   workbook đã load từ template (XSSF / SXSSF đều OK)
     * @param vars map placeholder → giá trị thay thế (toString)
     */
    public static void replacePlaceholders(Workbook wb, Map<String, ?> vars) {
        if (wb == null || vars == null || vars.isEmpty()) return;
        for (int s = 0; s < wb.getNumberOfSheets(); s++) {
            Sheet sheet = wb.getSheetAt(s);
            for (Row row : sheet) {
                for (Cell cell : row) {
                    if (cell.getCellType() != CellType.STRING) continue;
                    String value = cell.getStringCellValue();
                    if (value == null || value.indexOf('$') < 0) continue;
                    String replaced = applyPlaceholders(value, vars);
                    if (!replaced.equals(value)) cell.setCellValue(replaced);
                }
            }
        }
    }

    private static String applyPlaceholders(String value, Map<String, ?> vars) {
        Matcher m = PLACEHOLDER_PATTERN.matcher(value);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            String key = m.group(1).trim();
            Object replacement = vars.containsKey(key) ? vars.get(key) : m.group(0);
            m.appendReplacement(sb, Matcher.quoteReplacement(String.valueOf(replacement)));
        }
        m.appendTail(sb);
        return sb.toString();
    }

}
