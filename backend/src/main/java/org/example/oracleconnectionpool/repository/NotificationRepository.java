package org.example.oracleconnectionpool.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.example.oracleconnectionpool.constant.NotificationType;
import org.example.oracleconnectionpool.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    /**
     * Đếm số lượng thông báo chưa đọc của người dùng trong vòng 45 ngày.
     * Dùng để hiển thị Badge Count tại icon quả chuông.
     */
    long countByUserIdAndIsReadFalseAndCreatedAtAfter(String userId, LocalDateTime limitDate);

    /**
     * Lấy tất cả thông báo của người dùng trong vòng 45 ngày, sắp xếp mới nhất lên đầu.
     * (Phục vụ Tab "Tất cả")
     */
    List<Notification> findByUserIdAndCreatedAtAfterOrderByIdDesc(String userId, LocalDateTime limitDate);

    /**
     * Lấy danh sách thông báo chưa đọc trong vòng 45 ngày.
     * (Phục vụ Tab "Chưa đọc")
     */
    List<Notification> findByUserIdAndIsReadFalseAndCreatedAtAfterOrderByCreatedAtDesc(String userId, LocalDateTime limitDate);
    /**
     * Lấy các thông báo phát sinh sau một mốc thời gian cụ thể, sắp xếp cũ đến mới để đẩy bù theo thứ tự.
     */
    List<Notification> findByUserIdAndIdGreaterThanOrderByIdAsc(String userId, Long id);

    /**
     * Lấy thông báo theo loại (Type) - Phục vụ chia Tab: Thông báo chung, Công việc, Cảnh báo.
     */
    List<Notification> findByUserIdAndTypeAndCreatedAtAfterOrderByIdDesc(
        String userId, 
        NotificationType type, 
        LocalDateTime limitDate
    );

    /**
     * Đánh dấu tất cả thông báo là đã đọc cho một người dùng.
     */
    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.userId = :userId AND n.isRead = false")
    void markAllAsRead(@Param("userId") String userId);

    /**
     * Xóa các thông báo cũ quá 45 ngày để dọn dẹp DB.
     */
    @Modifying
    @Query("DELETE FROM Notification n WHERE n.createdAt < :limitDate")
    void deleteOldNotifications(@Param("limitDate") LocalDateTime limitDate);
}