package org.example.oracleconnectionpool.constant;

public enum NotificationType {
    /**
     * Thông báo công việc: Kích hoạt từ hành động người dùng (Phê duyệt, từ chối...)
     * Yêu cầu: Hiển thị badge count, điều hướng đến chi tiết hồ sơ.
     */
    NOTIFICATION("tuiIconFileTextLarge", "info"),

    /**
     * Thông báo chung: Kích hoạt theo lịch Admin (Bảo trì, tính năng mới)
     * Yêu cầu: Hiển thị nhanh (Tooltip), gửi toàn hàng.
     */
    ANNOUNCEMENT("tuiIconInfoLarge", "neutral"),

    /**
     * Cảnh báo: Kích hoạt từ Job rà soát (Quá hạn SLA, tài sản hết hạn...)
     * Yêu cầu: Mức độ ưu tiên cao, thường có màu cảnh báo.
     */
    ALERT("tuiIconAlertCircleLarge", "error");

    private final String icon;   // Tên icon trong Taiga-ui
    private final String status; // Trạng thái màu sắc (info, error, neutral)

    NotificationType(String icon, String status) {
        this.icon = icon;
        this.status = status;
    }

    public String getIcon() { return icon; }
    public String getStatus() { return status; }
}