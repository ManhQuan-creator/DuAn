package org.example.oracleconnectionpool.entity;

import java.time.LocalDateTime;

import org.example.oracleconnectionpool.constant.NotificationType;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import lombok.Data;

@Entity
@Table(name = "LH_NOTIFICATIONS", indexes = {
    @Index(name = "idx_user_created", columnList = "userId, createdAt")
})
@Data
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "notif_seq")
    @SequenceGenerator(name = "notif_seq", sequenceName = "SEQ_LH_NOTIFICATIONS", allocationSize = 1)
    private Long id; // Chuyển sang Long để có thứ tự tăng dần tuyệt đối
    
    private String userId;
    private String title;
    private String content;
    
    @Enumerated(EnumType.STRING)
    private NotificationType type;
    
    private String targetUrl;
    private boolean isRead = false;
    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime expiredAt;
}
