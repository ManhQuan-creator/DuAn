package org.example.oracleconnectionpool.config;

import org.example.oracleconnectionpool.model.RedisNotificationEvent;
import org.example.oracleconnectionpool.service.NotificationService;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class RedisReceiver {
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;

    // Redis gửi message dạng String JSON
    public void receiveMessage(String message) {
        try {
            // Parse message và gọi handle
            RedisNotificationEvent event = objectMapper.readValue(message, RedisNotificationEvent.class);
            notificationService.handleRedisEvent(event);
        } catch (Exception e) {
            log.error("Lỗi parse message từ Redis: {}", message, e);
        }
    }
}