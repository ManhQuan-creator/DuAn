package org.example.oracleconnectionpool.buttonaction.util;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.constant.Constant;
import org.example.oracleconnectionpool.entity.AppUser;
import org.example.oracleconnectionpool.repository.AppUserRepository;
import org.example.oracleconnectionpool.workflow.TaskNotificationDelegate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Sibling của {@link PcCompanyNotificationUtil} — broadcast notification đến chuyên viên
 * Ban Kế hoạch (Tổng công ty). Filter cố định: {@code AppUser.orgGroupCode = "EVNNPC"}
 * AND {@code deptCode = "BAN_KH"} AND {@code active = true}.
 *
 * <p>Dùng cho mọi flow PC → BAN_KH (vd "PC duyệt đăng ký danh mục SCL", "PC gửi báo cáo
 * tiến độ", "PC nộp đăng ký bổ sung", ...). Lỗi gửi 1 user không abort batch — log warn
 * rồi tiếp tục, trả về số gửi thành công.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BanKhNotificationUtil {

    private final AppUserRepository appUserRepository;
    private final TaskNotificationDelegate taskNotificationDelegate;

    /**
     * Broadcast 1 notification đến mọi user Ban KH.
     *
     * @param title     tiêu đề noti
     * @param content   nội dung
     * @param targetUrl link điều hướng khi click noti (vd "/scl-category")
     * @param logTag    prefix log để truy ngược về handler đã gọi
     * @return số notification đã gửi thành công (0 nếu không có user Ban KH active)
     */
    public int notifyAllBanKhUsers(String title, String content, String targetUrl, String logTag) {
        List<AppUser> recipients = appUserRepository.findByOrgGroupCodeAndDeptCode(
                Constant.OrgGroupCode.EVNNPC, List.of(Constant.DeptCode.BAN_KH));
        if (recipients.isEmpty()) {
            log.warn("[{}] Không tìm thấy user Ban KH active để gửi thông báo", logTag);
            return 0;
        }
        int count = 0;
        for (AppUser u : recipients) {
            try {
                taskNotificationDelegate.sendNotification(u.getUsername(), title, content, targetUrl);
                count++;
            } catch (Exception ex) {
                log.warn("[{}] Lỗi gửi noti cho user={}: {}", logTag, u.getUsername(), ex.getMessage());
            }
        }
        log.info("[{}] Đã gửi {}/{} notification đến BAN_KH users", logTag, count, recipients.size());
        return count;
    }
}
