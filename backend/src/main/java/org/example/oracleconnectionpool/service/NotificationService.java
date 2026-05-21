package org.example.oracleconnectionpool.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.entity.Notification;
import org.example.oracleconnectionpool.model.NotificationDTO;
import org.example.oracleconnectionpool.model.RedisNotificationEvent;
import org.example.oracleconnectionpool.repository.NotificationRepository;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository repository;
    private final RedisTemplate<String, Object> redisTemplate;
    
    // Tạo NODE_ID duy nhất cho mỗi instance khi khởi động
    public static final String NODE_ID = "NODE_" + java.util.UUID.randomUUID().toString().substring(0, 8);
    private static final String USER_LOCATION_KEY = "lending-hub:user-locations";
    public static final String NODE_TOPIC_PREFIX = "lending-hub:notifications:";

    // Quản lý các kết nối SSE tại Node này
    private final Map<String, SseEmitter> localEmitters = new ConcurrentHashMap<>();
    
    // Thread pool riêng để đẩy tin nhắn, tránh block thread chính khi tải cao (5.000 user)
    private final ExecutorService sseExecutor = Executors.newFixedThreadPool(20);

    /**
     * 1. Khởi tạo kết nối SSE cho người dùng
     */
    public SseEmitter createEmitter(String userId, String lastEventId) {
        SseEmitter emitter = new SseEmitter(300000L);

        // Đóng emitter cũ nếu có (tránh resource leak)
        SseEmitter oldEmitter = localEmitters.put(userId, emitter);
        if (oldEmitter != null) {
            try { oldEmitter.complete(); } catch (Exception ignored) {}
        }

        // Lưu vị trí User đang ở Node này vào Redis (Hết hạn sau 1 giờ theo timeout SSE)
        redisTemplate.opsForHash().put(USER_LOCATION_KEY, userId, NODE_ID);

        // Callbacks chỉ cleanup khi emitter HIỆN TẠI vẫn là emitter này
        // → tránh race: old emitter onCompletion xóa location của new emitter
        emitter.onCompletion(() -> removeIfCurrent(userId, emitter));
        emitter.onTimeout(() -> removeIfCurrent(userId, emitter));
        emitter.onError((e) -> removeIfCurrent(userId, emitter));

        // Gửi INIT...
        // Bắt cả IllegalStateException vì emitter có thể đã bị complete() bởi request reconnect
        // đến trước (race condition: put() trả về oldEmitter = emitter hiện tại, rồi complete nó).
        try {
            emitter.send(SseEmitter.event().name("INIT").data("CONNECTED", MediaType.APPLICATION_JSON));
        } catch (IOException | IllegalStateException e) {
            log.warn("Không gửi được INIT cho user {}: {}", userId, e.getMessage());
            removeIfCurrent(userId, emitter);
            return emitter;
        }

        if (lastEventId != null && !lastEventId.isEmpty()) {
            sendMissedNotifications(userId, lastEventId, emitter);
        }
        return emitter;
    }

    /**
     * 2. Truy vấn Database để gửi các thông báo bị lỡ trong lúc mất kết nối
     */
    private void sendMissedNotifications(String userId, String lastEventId, SseEmitter emitter) {
        try {
            Long lastId = Long.valueOf(lastEventId);
            List<Notification> missed = repository.findByUserIdAndIdGreaterThanOrderByIdAsc(userId, lastId);

            int sent = 0;
            for (Notification n : missed) {
                try {
                    emitter.send(SseEmitter.event()
                        .id(n.getId().toString())
                        .name("NEW_NOTIFICATION")
                        .data(mapToDto(n), MediaType.APPLICATION_JSON));
                    sent++;
                } catch (IOException | IllegalStateException e) {
                    log.warn("Dừng gửi bù cho user {} - emitter đã đóng: {}", userId, e.getMessage());
                    removeIfCurrent(userId, emitter);
                    return;
                }
            }
            log.info("Sent {}/{} missed notifications to user: {}", sent, missed.size(), userId);
        } catch (Exception e) {
            log.error("Lỗi gửi bù thông báo cho user: {}", userId, e);
        }
    }

    /**
     * Chỉ xóa location nếu emitter hiện tại vẫn là emitter đang cleanup.
     * Tránh race condition khi user reconnect nhanh: old emitter callback xóa nhầm new emitter.
     */
    private void removeIfCurrent(String userId, SseEmitter emitter) {
        if (localEmitters.remove(userId, emitter)) {
            redisTemplate.opsForHash().delete(USER_LOCATION_KEY, userId);
        }
    }

    private void removeUserLocation(String userId) {
        localEmitters.remove(userId);
        redisTemplate.opsForHash().delete(USER_LOCATION_KEY, userId);
    }

    /**
     * 3. Gửi thông báo mới (Lưu DB -> Đẩy lên Redis Cluster SAU KHI commit)
     *
     * FIX: Redis publish được defer sang afterCommit() để đảm bảo:
     * - DB đã commit trước khi SSE client nhận notification
     * - Frontend query lại DB sẽ thấy notification mới
     */
    @Transactional
    public void sendNotification(Notification notification) {
        repository.save(notification);
        NotificationDTO dto = mapToDto(notification);
        RedisNotificationEvent event = new RedisNotificationEvent(notification.getUserId(), dto);

        // Defer Redis publish đến SAU KHI transaction commit thành công
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    String targetNodeId = (String) redisTemplate.opsForHash()
                            .get(USER_LOCATION_KEY, notification.getUserId());
                    if (targetNodeId != null) {
                        String targetTopic = NODE_TOPIC_PREFIX + targetNodeId;
                        redisTemplate.convertAndSend(targetTopic, event);
                        log.info("Sent notification to target topic: {} (after commit)", targetTopic);
                    } else {
                        log.warn("User {} is offline, notification saved to DB only", notification.getUserId());
                    }
                } catch (Exception e) {
                    log.error("Lỗi gửi Redis notification cho user {} sau commit", notification.getUserId(), e);
                }
            }
        });
    }

    /**
     * 4. Xử lý sự kiện từ Redis để đẩy xuống Client tại Node này
     */
    public void handleRedisEvent(RedisNotificationEvent event) {
        String userId = event.getUserId(); 
        SseEmitter emitter = localEmitters.get(userId);
        
        if (emitter != null) {
            sseExecutor.execute(() -> {
                try {
                    emitter.send(SseEmitter.event()
                        .id(event.getData().id().toString())
                        .name("NEW_NOTIFICATION")
                        .data(event.getData(), MediaType.APPLICATION_JSON));
                } catch (IOException | IllegalStateException e) {
                    // Lỗi này là bình thường khi user offline hoặc Gateway ngắt kết nối
                    log.warn("Gửi tin thất bại cho user {}, xóa emitter. Lý do: {}", userId, e.getMessage());
                    removeUserLocation(userId); // Dọn dẹp cả local map và Redis location
                } catch (Exception e) {
                    log.error("Lỗi không xác định khi gửi SSE cho user {}", userId, e);
                }
            });
        }
    }

    /**
     * 5. Duy trì kết nối: Gửi ping mỗi 30s tránh Kong/Nginx timeout
     *
     * FIX: Thu thập dead emitters vào list riêng, xóa sau khi iterate xong.
     * Tránh ConcurrentModificationException khi remove() trong parallelStream().
     */
    @Scheduled(fixedRate = 30000)
    public void sendHeartbeat() {
        List<String> deadUsers = new ArrayList<>();
        for (Map.Entry<String, SseEmitter> entry : localEmitters.entrySet()) {
            try {
                entry.getValue().send(SseEmitter.event().name("ping").data("heartbeat"));
            } catch (Exception e) {
                deadUsers.add(entry.getKey());
            }
        }
        deadUsers.forEach(this::removeUserLocation);
    }

    /**
     * 6. Dọn dẹp thông báo cũ quá 45 ngày theo quy trình CAS
     */
    @Scheduled(cron = "0 0 2 * * ?") 
    @Transactional
    public void cleanupOldNotifications() {
        LocalDateTime limitDate = LocalDateTime.now().minusDays(45);
        repository.deleteOldNotifications(limitDate);
        log.info("Cleaned up notifications older than 45 days");
    }

    @Transactional
    public void markAllAsRead(String userId) {
        repository.markAllAsRead(userId);
    }

    public NotificationDTO mapToDto(Notification n) {
        return new NotificationDTO(
            n.getId(),
            n.getTitle(),
            n.getContent(),
            n.getType().name(),
            n.getType().getStatus(),
            n.getType().getIcon(),
            n.getTargetUrl(),
            n.isRead(),
            n.getCreatedAt()
        );
    }
}