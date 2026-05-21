package org.example.oracleconnectionpool.controller;

import lombok.RequiredArgsConstructor;

import org.example.oracleconnectionpool.constant.NotificationType;
import org.example.oracleconnectionpool.entity.Notification;
import org.example.oracleconnectionpool.model.NotificationDTO;
import org.example.oracleconnectionpool.repository.NotificationRepository;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.example.oracleconnectionpool.service.NotificationService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import jakarta.servlet.http.HttpServletResponse;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;

    /**
     * 1. Mở luồng SSE để nhận thông báo real-time
     * Token truyền qua query param ?token=xxx (EventSource không set header được)
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamNotifications(
            @AuthenticationPrincipal AppUserDetails userDetails,
            @RequestParam(value = "lastEventId", required = false) String lastEventId,
            HttpServletResponse response) {

        response.addHeader("X-Accel-Buffering", "no");

        return notificationService.createEmitter(userDetails.getUsername(), lastEventId);
    }

    /**
     * 2. Lấy số lượng thông báo chưa đọc (Badge Count)
     */
    @GetMapping("/unread-count")
    public ResponseEntity<Long> getUnreadCount(@AuthenticationPrincipal AppUserDetails userDetails) {
        LocalDateTime limitDate = LocalDateTime.now().minusDays(45);
        long count = notificationRepository.countByUserIdAndIsReadFalseAndCreatedAtAfter(
                userDetails.getUsername(), limitDate);
        return ResponseEntity.ok(count);
    }

    /**
     * 3. Lấy danh sách thông báo theo bộ lọc (Tab)
     */
    @GetMapping("/list")
    public ResponseEntity<List<NotificationDTO>> getNotifications(
            @AuthenticationPrincipal AppUserDetails userDetails,
            @RequestParam(required = false) String type) {

        String userId = userDetails.getUsername();
        LocalDateTime limitDate = LocalDateTime.now().minusDays(45);
        List<Notification> list;

        if (type == null || type.isEmpty() || "ALL".equalsIgnoreCase(type)) {
            list = notificationRepository.findByUserIdAndCreatedAtAfterOrderByIdDesc(userId, limitDate);
        } else {
            list = notificationRepository.findByUserIdAndTypeAndCreatedAtAfterOrderByIdDesc(
                    userId,
                    NotificationType.valueOf(type),
                    limitDate);
        }

        List<NotificationDTO> dtos = list.stream()
                .map(notificationService::mapToDto)
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    /**
     * 4. Đánh dấu một thông báo là đã đọc
     */
    @PatchMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable String id) {
        notificationRepository.findById(Long.valueOf(id)).ifPresent(n -> {
            n.setRead(true);
            notificationRepository.save(n);
        });
        return ResponseEntity.ok().build();
    }

    /**
     * 5. Đánh dấu tất cả là đã đọc
     */
    @PostMapping("/mark-all-read")
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal AppUserDetails userDetails) {
        notificationService.markAllAsRead(userDetails.getUsername());
        return ResponseEntity.ok().build();
    }

    /**
     * 6. Test API: Gửi thông báo thủ công
     */
    @PostMapping("/test-send")
    public ResponseEntity<Void> testSend(@RequestBody Notification notification) {
        notificationService.sendNotification(notification);
        return ResponseEntity.ok().build();
    }
}
