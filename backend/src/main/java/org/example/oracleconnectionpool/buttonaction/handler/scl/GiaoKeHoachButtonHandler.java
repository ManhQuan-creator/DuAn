package org.example.oracleconnectionpool.buttonaction.handler.scl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.buttonaction.ButtonActionContext;
import org.example.oracleconnectionpool.buttonaction.ButtonActionHandler;
import org.example.oracleconnectionpool.buttonaction.ButtonActionResult;
import org.example.oracleconnectionpool.buttonaction.util.ButtonActionEntryUtil;
import org.example.oracleconnectionpool.buttonaction.util.PcCompanyNotificationUtil;
import org.example.oracleconnectionpool.entity.GridDataEntry;
import org.example.oracleconnectionpool.entity.GridTemplate;
import org.example.oracleconnectionpool.repository.GridDataEntryRepository;
import org.example.oracleconnectionpool.repository.GridTemplateRepository;
import org.springframework.stereotype.Component;

/**
 * Khi Tổng công ty bấm "Giao kế hoạch tạm tính":
 * - Đổi status entry → DISTRIBUTED
 * - Tất cả đơn vị (PCBN, PCHP, ...) sẽ xem được entry này
 *   (logic visibility trong GridDataEntryService cho phép status DISTRIBUTED bypass orgCode filter)
 * - Gửi thông báo đến toàn bộ user thuộc PC_COMPANY đang active.
 *
 * <p><b>Lưu ý:</b> Hiện tại broadcast cho toàn bộ PC_COMPANY users. Sau này có thể refactor
 * để gửi theo chức danh cụ thể (vd: TRUONG_PHONG_KH) bằng cách thêm filter theo positionCode.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GiaoKeHoachButtonHandler implements ButtonActionHandler {

    private final GridDataEntryRepository entryRepository;
    private final GridTemplateRepository templateRepository;
    private final ButtonActionEntryUtil entryUtil;
    private final PcCompanyNotificationUtil pcNotifyUtil;

    @Override
    public String getKey() {
        return "SCL_GIAO_KH_TT";
    }

    @Override
    public String getLabel() {
        return "SCL: Giao kế hoạch tạm tính";
    }

    @Override
    public String getDescription() {
        return "Đổi trạng thái entry thành DISTRIBUTED — tất cả đơn vị sẽ xem được entry này + gửi noti cho PC_COMPANY.";
    }

    @Override
    public ButtonActionResult handle(ButtonActionContext ctx) {
        if (ctx.getEntryId() == null) {
            return ButtonActionResult.info("Chưa có phiên nhập liệu để giao.");
        }

        GridDataEntry entry = entryRepository.findById(ctx.getEntryId()).orElse(null);
        if (entry == null) {
            return ButtonActionResult.info("Không tìm thấy phiên nhập liệu.");
        }

        String username = ctx.getUser() != null ? ctx.getUser().getUsername() : null;
        boolean changed = entryUtil.markDistributed(entry, username, getKey());
        if (!changed) {
            return ButtonActionResult.info("Kế hoạch đã được giao trước đó.");
        }

        // Gửi notification cho toàn bộ PC_COMPANY
        int sentCount = notifyPcCompanyUsers(entry);

        return ButtonActionResult.success(
                "Đã giao kế hoạch tạm tính thành công. Đã gửi thông báo đến " + sentCount + " user."
        );
    }

    /** Gửi notification đến toàn bộ user thuộc PC_COMPANY đang active (delegate sang util). */
    private int notifyPcCompanyUsers(GridDataEntry entry) {
        String templateName = templateRepository.findById(entry.getTemplateId())
                .map(GridTemplate::getName)
                .orElse("Kế hoạch tạm tính");
        String title = "Giao kế hoạch: " + templateName;
        String content = "Tổng công ty đã giao kế hoạch tạm tính. Vui lòng vào hệ thống để xem chi tiết.";
        String targetUrl = "/report/giao-ke-hoach-tam-tinh?templateId=" + entry.getTemplateId()
                + "&entryId=" + entry.getId();
        return pcNotifyUtil.notifyAllPcUsers(title, content, targetUrl, getKey());
    }
}
