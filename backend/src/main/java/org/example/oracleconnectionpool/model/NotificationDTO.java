package org.example.oracleconnectionpool.model;

import lombok.Builder;
import java.io.Serializable;
import java.time.LocalDateTime;

@Builder
public record NotificationDTO(
    Long id,
    String title,
    String content,
    String type,
    String status,
    String icon,
    String targetUrl,
    boolean isRead,
    LocalDateTime createdAt
) implements Serializable {}