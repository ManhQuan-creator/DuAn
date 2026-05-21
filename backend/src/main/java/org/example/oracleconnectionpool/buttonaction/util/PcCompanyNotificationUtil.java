package org.example.oracleconnectionpool.buttonaction.util;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.constant.NotificationType;
import org.example.oracleconnectionpool.entity.AppUser;
import org.example.oracleconnectionpool.entity.Notification;
import org.example.oracleconnectionpool.repository.AppUserRepository;
import org.example.oracleconnectionpool.service.NotificationService;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Gửi notification broadcast đến toàn bộ user thuộc nhóm PC_COMPANY (17 đơn vị PC).
 *
 * <p>Tách khỏi handler riêng lẻ vì nhiều handler SCL/Phân bổ đều cần broadcast
 * pattern này (vd "Giao kế hoạch tạm tính", "Giao chi phí cho đơn vị"). Filter
 * cố định: {@code AppUser.orgGroupCode = "PC_COMPANY"} AND {@code active = true}.
 *
 * <p>Lỗi gửi 1 user không abort batch — log warn rồi tiếp tục, trả về số gửi thành công.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PcCompanyNotificationUtil {

    public static final String ORG_GROUP_PC = "PC_COMPANY";

    private final AppUserRepository appUserRepository;
    private final NotificationService notificationService;

    /**
     * Broadcast 1 notification đến mọi user PC_COMPANY active.
     *
     * @param title     tiêu đề noti
     * @param content   nội dung
     * @param targetUrl link điều hướng khi user click noti (vd "/report/...")
     * @param logTag    prefix log để truy ngược về handler đã gọi
     * @return số notification đã gửi thành công (0 nếu không có user nào)
     */
    public int notifyAllPcUsers(String title, String content, String targetUrl, String logTag) {
        List<AppUser> recipients = appUserRepository.findByOrgGroupCodeAndActiveTrue(ORG_GROUP_PC);
        int count = 0;
        for (AppUser u : recipients) {
            try {
                Notification noti = new Notification();
                noti.setUserId(u.getUsername());
                noti.setTitle(title);
                noti.setContent(content);
                noti.setType(NotificationType.NOTIFICATION);
                noti.setTargetUrl(targetUrl);
                noti.setCreatedAt(LocalDateTime.now());
                notificationService.sendNotification(noti);
                count++;
            } catch (Exception ex) {
                log.warn("[{}] Lỗi gửi noti cho user={}: {}", logTag, u.getUsername(), ex.getMessage());
            }
        }
        log.info("[{}] Đã gửi {}/{} notification đến PC_COMPANY users",
                logTag, count, recipients.size());
        return count;
    }
}
