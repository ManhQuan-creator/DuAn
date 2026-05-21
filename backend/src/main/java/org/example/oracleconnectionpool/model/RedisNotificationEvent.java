package org.example.oracleconnectionpool.model;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class RedisNotificationEvent implements Serializable {
    
    // ID của người nhận thông báo
    private String userId;
    
    // Dữ liệu thông báo thực tế (DTO mà ta đã viết ở bước trước)
    private NotificationDTO data;
    
    // SerialVersionUID giúp đảm bảo tính tương thích khi đóng gói/giải nén
    private static final long serialVersionUID = 1L;
}