package org.example.oracleconnectionpool.buttonaction.handler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.buttonaction.ButtonActionContext;
import org.example.oracleconnectionpool.buttonaction.ButtonActionHandler;
import org.example.oracleconnectionpool.buttonaction.ButtonActionResult;
import org.springframework.stereotype.Component;

/**
 * Handler mẫu cho nút EXPORT.
 *
 * <p>Khai báo nút với buttonKey = "EXPORT" trong Quản lý nút chức năng,
 * handler này sẽ được tự động gọi khi user bấm nút.
 *
 * <p>Để tạo handler mới cho buttonKey khác, copy file này, đổi KEY và viết logic trong handle().
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExportButtonHandler implements ButtonActionHandler {

    public static final String KEY = "EXPORT";

    @Override
    public String getKey() {
        return KEY;
    }

    @Override
    public String getLabel() {
        return "Xuất Excel";
    }

    @Override
    public String getDescription() {
        return "Xuất dữ liệu phiên nhập liệu ra file Excel.";
    }

    @Override
    public ButtonActionResult handle(ButtonActionContext ctx) {
        log.info("[{}] Xuất Excel cho template={}, entry={}, user={}",
                KEY, ctx.getTemplateId(), ctx.getEntryId(),
                ctx.getUser() != null ? ctx.getUser().getUsername() : "anonymous");

        // TODO: Implement logic xuất Excel thực tế
        // Ví dụ: gọi service tạo file → trả URL download

        return ButtonActionResult.info("Chức năng xuất Excel đang được phát triển.");
    }
}
