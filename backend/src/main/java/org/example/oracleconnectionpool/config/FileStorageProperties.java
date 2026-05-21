package org.example.oracleconnectionpool.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "app.file")
public class FileStorageProperties {

    public enum StorageMode { LOCAL, SFTP }

    /**
     * Chọn backend lưu file:
     *  - LOCAL: ghi thẳng vào filesystem cùng máy — dùng cho prod/server chính.
     *  - SFTP: ghi qua SSH sang máy khác — dùng cho dev Windows trỏ về Linux share.
     */
    private StorageMode storageMode = StorageMode.LOCAL;

    /**
     * LOCAL mode: absolute path trên máy hiện tại.
     * SFTP mode: absolute path trên máy remote (không phải máy chạy backend).
     */
    private String sharePath;

    /** Giới hạn kích thước mỗi file (byte). Mặc định 10 MB. */
    private long maxFileSize = 10L * 1024 * 1024;

    /** Đuôi file bị cấm (lowercase, không dấu chấm) — nguy cơ mã độc. */
    private List<String> blockedExtensions = List.of(
            "cmd", "bat", "exe", "com", "scr", "pif",
            "js", "vbs", "vbe", "ws", "wsf", "wsh",
            "ps1", "psm1", "psd1",
            "sh", "bash", "zsh",
            "jar", "msi", "dll", "jsp", "php"
    );

    /** Cấu hình SFTP — chỉ dùng khi storage-mode = SFTP. */
    private Sftp sftp = new Sftp();

    @Getter
    @Setter
    public static class Sftp {
        private String host;
        private int port = 22;
        private String username;
        private String password;
        /** true = verify host key trong known_hosts (prod). false = accept mọi host (dev/intranet). */
        private boolean strictHostKeyChecking;
        /** Timeout cho connect (ms). Mặc định 10s — guard khi env set rỗng. */
        private int connectTimeoutMs = 10_000;
        /** Timeout cho session (ms). Mặc định 30s — guard khi env set rỗng. */
        private int sessionTimeoutMs = 30_000;
    }
}
