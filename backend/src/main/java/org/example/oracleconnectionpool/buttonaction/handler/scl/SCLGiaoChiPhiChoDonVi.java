package org.example.oracleconnectionpool.buttonaction.handler.scl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.buttonaction.ButtonActionContext;
import org.example.oracleconnectionpool.buttonaction.ButtonActionHandler;
import org.example.oracleconnectionpool.buttonaction.ButtonActionResult;
import org.example.oracleconnectionpool.buttonaction.util.ButtonActionEntryUtil;
import org.example.oracleconnectionpool.buttonaction.util.PcCompanyNotificationUtil;
import org.example.oracleconnectionpool.constant.EntryStatus;
import org.example.oracleconnectionpool.entity.GridDataEntry;
import org.example.oracleconnectionpool.repository.GridDataEntryRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Khi BAN_KH bấm "Giao chi phí cho đơn vị" tại entry template 304:
 *
 * <ol>
 *   <li>Đọc {@code dueDate} đã được TCT set ở chính entry 304 (validate tương lai).</li>
 *   <li>Đổi status entry 304 → DISTRIBUTED (idempotent — đã DISTRIBUTED → block).</li>
 *   <li>Notify all PC users qua {@link PcCompanyNotificationUtil} với hạn xử lý kèm trong message.</li>
 * </ol>
 *
 * <p>KHÔNG tạo entry con cho 17 PC nữa — mỗi PC tự tạo entry 344 khi bắt đầu lập kế hoạch.
 * Hạn xử lý được TCT set trực tiếp ở entry 304 (FE entry view cho phép edit date picker
 * khi entry còn DRAFT/RETURNED), KHÔNG còn nhập qua dialog popup.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SCLGiaoChiPhiChoDonVi implements ButtonActionHandler {

    private static final long SOURCE_TEMPLATE_ID = 304L;
    private static final String TARGET_REPORT_PATH = "/report/don-vi-lap-ke-hoach";
    private static final DateTimeFormatter DUE_DATE_DISPLAY = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final GridDataEntryRepository entryRepository;
    private final ButtonActionEntryUtil entryUtil;
    private final PcCompanyNotificationUtil pcNotifyUtil;

    @Override public String getKey() { return "SCL_GIAO_CHI_PHI_CHO_DON_VI"; }
    @Override public String getLabel() { return "SCL: Giao chi phí cho đơn vị"; }
    @Override public String getDescription() {
        return "Chuyển entry phân bổ chi phí SCL → DISTRIBUTED và gửi thông báo tới các đơn vị "
                + "kèm hạn xử lý đã được TCT set trên chính entry này.";
    }

    @Override
    @Transactional
    public ButtonActionResult handle(ButtonActionContext ctx) {
        Long entryId = ctx.getEntryId();
        if (entryId == null) {
            return ButtonActionResult.warning("Chưa có phiên nhập liệu để giao.");
        }

        GridDataEntry source = entryRepository.findById(entryId).orElse(null);
        if (source == null) {
            return ButtonActionResult.error("Không tìm thấy phiên nhập liệu (id=" + entryId + ").");
        }

        if (!Long.valueOf(SOURCE_TEMPLATE_ID).equals(source.getTemplateId())) {
            return ButtonActionResult.error("Phiên nhập liệu không thuộc biểu phân bổ chi phí (template "
                    + SOURCE_TEMPLATE_ID + ").");
        }
        if (EntryStatus.DISTRIBUTED.equalsIgnoreCase(source.getStatus())) {
            return ButtonActionResult.warning("Đã giao chi phí trước đó — không thể giao lại.");
        }

        LocalDateTime dueDate = source.getDueDate();
        if (dueDate == null) {
            return ButtonActionResult.warning(
                    "Vui lòng nhập \"Hạn xử lý\" cho phiên trước khi giao chi phí.");
        }
        if (!dueDate.isAfter(LocalDateTime.now())) {
            return ButtonActionResult.warning("Hạn xử lý phải là thời điểm tương lai.");
        }

        String username = ctx.getUser() != null ? ctx.getUser().getUsername() : null;
        entryUtil.markDistributed(source, username, getKey());

        int notified = notifyPcUsers(source, dueDate);

        log.info("[{}] Hoàn tất: source entry={} DISTRIBUTED, notified {} users (dueDate={})",
                getKey(), source.getId(), notified, dueDate);

        return ButtonActionResult.success(
                String.format("Đã giao chi phí SCL (hạn %s), gửi thông báo tới %d người dùng.",
                        DUE_DATE_DISPLAY.format(dueDate), notified));
    }

    private int notifyPcUsers(GridDataEntry source, LocalDateTime dueDate) {
        String title = "Giao chi phí SCL năm " + source.getYear();
        String content = String.format(
                "Tổng công ty đã giao chi phí SCL năm %d. Hạn đăng ký kế hoạch: %s. "
                + "Vui lòng vào hệ thống lập biểu đăng ký kế hoạch danh mục SCL.",
                source.getYear(), DUE_DATE_DISPLAY.format(dueDate));
        return pcNotifyUtil.notifyAllPcUsers(title, content, TARGET_REPORT_PATH, getKey());
    }
}
