package org.example.oracleconnectionpool.buttonaction.handler.scl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.buttonaction.ButtonActionContext;
import org.example.oracleconnectionpool.buttonaction.ButtonActionHandler;
import org.example.oracleconnectionpool.buttonaction.ButtonActionResult;
import org.example.oracleconnectionpool.buttonaction.util.BanKhNotificationUtil;
import org.example.oracleconnectionpool.buttonaction.util.ButtonActionEntryUtil;
import org.example.oracleconnectionpool.constant.EntryStatus;
import org.example.oracleconnectionpool.entity.GridDataEntry;
import org.example.oracleconnectionpool.entity.SclCategoryEntity;
import org.example.oracleconnectionpool.repository.GridDataEntryRepository;
import org.example.oracleconnectionpool.repository.SclCategoryRepository;
import org.example.oracleconnectionpool.service.impl.SclCategoryExtractor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Khi PC bấm "Duyệt đăng ký danh mục SCL" tại entry template 344 (PL159):
 *
 * <ol>
 *   <li>Đọc rowData JSON entry → trích xuất {@link SclCategoryEntity} qua
 *       {@link SclCategoryExtractor} (cùng logic với endpoint debug
 *       {@code GET /v1/scl-category/extract-preview/{entryId}}).</li>
 *   <li>{@code saveAll} batch vào bảng {@code SCL_CATEGORY}.</li>
 *   <li>Đổi status entry → {@code DISTRIBUTED} (idempotent — đã DISTRIBUTED → block).</li>
 *   <li>Notify all user Ban KH (TCT) qua {@link BanKhNotificationUtil}.</li>
 * </ol>
 *
 * <p>Idempotency: nếu entry đã DISTRIBUTED → trả warning, KHÔNG re-run. Lý do: pattern
 * {@code categoryCode = <entryCode>_<rowCode>} stable nên chạy lại sẽ duplicate. Nếu cần
 * sửa, admin can thiệp DB.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SCLDuyetDangKyDanhMucPc implements ButtonActionHandler {

    private static final long SOURCE_TEMPLATE_ID = 344L;
    private static final String NOTIFY_TARGET_URL = "/scl-category";

    private final GridDataEntryRepository entryRepository;
    private final SclCategoryRepository sclCategoryRepository;
    private final SclCategoryExtractor sclCategoryExtractor;
    private final ButtonActionEntryUtil entryUtil;
    private final BanKhNotificationUtil banKhNotifier;

    @Override public String getKey() { return "SCL_DUYET_DANG_KY_DANH_MUC_PC"; }
    @Override public String getLabel() { return "SCL: Duyệt đăng ký danh mục SCL"; }
    @Override public String getDescription() {
        return "Trích xuất danh mục SCL từ rowData entry → bảng SCL_CATEGORY, đổi status "
                + "entry sang DISTRIBUTED và gửi thông báo tới Ban KH (TCT).";
    }

    @Override
    @Transactional
    public ButtonActionResult handle(ButtonActionContext ctx) {
        Long entryId = ctx.getEntryId();
        if (entryId == null) {
            return ButtonActionResult.warning("Chưa có phiên nhập liệu để duyệt.");
        }

        GridDataEntry source = entryRepository.findById(entryId).orElse(null);
        if (source == null) {
            return ButtonActionResult.error("Không tìm thấy phiên nhập liệu (id=" + entryId + ").");
        }

        if (!Long.valueOf(SOURCE_TEMPLATE_ID).equals(source.getTemplateId())) {
            return ButtonActionResult.error("Phiên nhập liệu không thuộc biểu đăng ký danh mục SCL "
                    + "(template " + SOURCE_TEMPLATE_ID + ").");
        }
        if (EntryStatus.DISTRIBUTED.equalsIgnoreCase(source.getStatus())) {
            return ButtonActionResult.warning("Đã duyệt đăng ký danh mục trước đó — không thể duyệt lại.");
        }

        List<SclCategoryEntity> extracted = sclCategoryExtractor.extract(entryId);
        if (extracted.isEmpty()) {
            return ButtonActionResult.warning(
                    "Không có hạng mục SCL hợp lệ trong phiên — vui lòng nhập danh mục trước khi duyệt.");
        }

        sclCategoryRepository.saveAll(extracted);
        log.info("[{}] Đã lưu {} hạng mục SCL từ entry id={}", getKey(), extracted.size(), source.getId());

        String username = ctx.getUser() != null ? ctx.getUser().getUsername() : null;
        entryUtil.markDistributed(source, username, getKey());

        String title = "PC " + (source.getOrgCode() != null ? source.getOrgCode() : "?")
                + " đã đăng ký danh mục SCL năm " + source.getYear();
        String content = String.format(
                "Đơn vị %s vừa duyệt đăng ký %d hạng mục SCL năm %d. Vui lòng kiểm tra danh mục.",
                source.getOrgCode(), extracted.size(), source.getYear());
        int notified = banKhNotifier.notifyAllBanKhUsers(title, content, NOTIFY_TARGET_URL, getKey());

        log.info("[{}] Hoàn tất: source entry={} DISTRIBUTED, saved {} categories, notified {} BAN_KH users",
                getKey(), source.getId(), extracted.size(), notified);

        return ButtonActionResult.success(
                String.format("Đã duyệt đăng ký: lưu %d hạng mục SCL, gửi thông báo tới %d người dùng Ban KH.",
                        extracted.size(), notified));
    }
}
