package org.example.oracleconnectionpool.utils;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.NotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.example.oracleconnectionpool.constant.Constant;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.util.StringUtils;

import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Export Excel theo template có sẵn (resources/template/*.xlsx).
 *
 * <p>Workflow: load template → fill data vào từng sheet theo {@link ExcelUtils.SheetBinding}
 * (key = sheet name) → ghi ra response. Style/font/màu/border/dataformat của từng cột bám
 * theo row mẫu trong template (xem {@link ExcelUtils#bindParamToSheet}).
 */
@Slf4j
public class ExcelExportHandler {

    private ExcelExportHandler() {}

    /**
     * Export template với data fill vào nhiều sheet.
     *
     * @param templateName tên file template — chỉ basename, chống path traversal.
     * @param bindings     map {sheet name → SheetBinding(data, skipRows)}. Sheet không có trong map giữ nguyên template.
     * @param response     HttpServletResponse để stream file về client.
     */
    public static void exportTemplateWithData(String templateName,
                                              Map<String, ExcelUtils.SheetBinding> bindings,
                                              HttpServletResponse response) {
        exportTemplate(templateName, wb -> {
            if (bindings != null) {
                String safeName = Paths.get(templateName).getFileName().toString();
                bindings.forEach((sheetName, binding) -> applyBinding(wb, safeName, sheetName, binding));
            }
        }, response);
    }

    /**
     * Export template với custom workbook filler — dùng khi layout phức tạp hơn việc fill 1 list
     * vào sheet (vd grouping, merge cells, multiple aggregate rows). Caller nhận
     * {@link Workbook} đã load từ template, tự manipulate, không cần lo file IO / response header.
     *
     * @param templateName tên file template trong resources/template/
     * @param filler       callback nhận Workbook đã load — caller fill data trước khi method ghi ra response
     * @param response     HttpServletResponse để stream file về client
     */
    public static void exportTemplate(String templateName,
                                      Consumer<Workbook> filler,
                                      HttpServletResponse response) {
        if (!StringUtils.hasText(templateName)) {
            throw new IllegalArgumentException("templateName rỗng");
        }
        String safeName = Paths.get(templateName).getFileName().toString();
        String contentType = resolveContentType(safeName);

        ClassPathResource resource = new ClassPathResource("template/" + safeName);
        if (!resource.exists()) {
            throw new NotFoundException("Không tìm thấy template: " + safeName + " trong resources/template");
        }

        response.setContentType(contentType);
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                .filename(safeName, StandardCharsets.UTF_8)
                .build()
                .toString()
        );

        try (InputStream in = resource.getInputStream();
             Workbook wb = WorkbookFactory.create(in);
             OutputStream out = response.getOutputStream()) {

            if (filler != null) filler.accept(wb);

            wb.write(out);
            out.flush();
        } catch (Exception e) {
            throw new RuntimeException("Lỗi khi export template: " + safeName, e);
        }
    }

    private static String resolveContentType(String fileName) {
        String lc = fileName.toLowerCase();
        if (lc.endsWith(Constant.ExtensionFile.XLSX)) return Constant.ContentType.XLSX;
        if (lc.endsWith(Constant.ExtensionFile.XLS)) return Constant.ContentType.XLS;
        return Constant.ContentType.OCTET_STREAM;
    }

    private static void applyBinding(Workbook wb, String templateName, String sheetName, ExcelUtils.SheetBinding binding) {
        if (binding == null || binding.data() == null) return;

        Sheet sheet = wb.getSheet(sheetName);
        if (sheet == null) {
            log.warn("[exportTemplate] Template '{}' không có sheet '{}', bỏ qua", templateName, sheetName);
            return;
        }
        if (!(sheet instanceof XSSFSheet xssf)) {
            log.warn("[exportTemplate] Sheet '{}' không phải XSSF (template phải .xlsx), bỏ qua", sheetName);
            return;
        }
        ExcelUtils.bindParamToSheet(xssf, binding.data(), binding.skipRows());
    }
}
