package org.example.oracleconnectionpool.config;


import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.entity.AbstractAuditingTimeEntity;
import org.example.oracleconnectionpool.entity.AbstractAuditingUserEntity;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component(value = "ldhCustomAuditingEntityListener")
@RequiredArgsConstructor
public class CustomAuditingEntityListener extends AuditingEntityListener {

    @PrePersist
    public void prePersist(Object entity) {
        if (entity instanceof AbstractAuditingTimeEntity auditable) {
            auditable.setCreatedAt(LocalDateTime.now());
            auditable.setUpdatedAt(LocalDateTime.now());
        }
        if (entity instanceof AbstractAuditingUserEntity auditable) {
            String username = getCurrentUsername();
            auditable.setCreatedBy(username);
            auditable.setUpdatedBy(username);
        }
    }

    @PreUpdate
    public void preUpdate(Object entity) {
        if (entity instanceof AbstractAuditingTimeEntity auditable) {
            auditable.setUpdatedAt(LocalDateTime.now());
        }
        if (entity instanceof AbstractAuditingUserEntity auditable) {
            auditable.setUpdatedBy(getCurrentUsername());
        }
    }

    private String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AppUserDetails userDetails) {
            return userDetails.getUsername();
        }
        return "SYSTEM";
    }
}
