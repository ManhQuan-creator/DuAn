package org.example.oracleconnectionpool.storage;

import com.jcraft.jsch.ChannelSftp;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import com.jcraft.jsch.SftpException;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.config.FileStorageProperties;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * Impl FileStorage qua SFTP — dev Windows ghi file sang Linux server.
 *
 * Session được dùng chung (lazy init + reconnect khi dead); mỗi thao tác mở
 * một ChannelSftp riêng. {@link #read} trả stream wrap channel: khi caller
 * close stream thì channel cũng đóng.
 */
@Slf4j
@RequiredArgsConstructor
public class SftpFileStorage implements FileStorage {

    private final FileStorageProperties properties;
    private Session session;

    @PreDestroy
    void shutdown() {
        Session s = this.session;
        if (s != null && s.isConnected()) {
            s.disconnect();
            log.info("SFTP session disconnected");
        }
    }

    @Override
    public void write(String relativePath, InputStream in) throws IOException {
        String remote = remotePath(relativePath);
        withChannel(ch -> {
            ensureParentDir(ch, remote);
            ch.put(in, remote, ChannelSftp.OVERWRITE);
            return null;
        });
    }

    @Override
    public InputStream read(String relativePath) throws IOException {
        String remote = remotePath(relativePath);
        ChannelSftp ch = null;
        try {
            Session s = getSession();
            ch = (ChannelSftp) s.openChannel("sftp");
            ch.connect(properties.getSftp().getConnectTimeoutMs());
            InputStream is = ch.get(remote);
            final ChannelSftp finalCh = ch;
            return new FilterInputStream(is) {
                @Override
                public void close() throws IOException {
                    try { super.close(); } finally { finalCh.disconnect(); }
                }
            };
        } catch (JSchException | SftpException e) {
            if (ch != null) ch.disconnect();
            throw new IOException("SFTP read failed for " + relativePath + ": " + e.getMessage(), e);
        }
    }

    @Override
    public void delete(String relativePath) throws IOException {
        String remote = remotePath(relativePath);
        withChannel(ch -> {
            try {
                ch.rm(remote);
            } catch (SftpException e) {
                if (e.id != ChannelSftp.SSH_FX_NO_SUCH_FILE) throw e;
            }
            return null;
        });
    }

    @Override
    public void healthCheck() throws IOException {
        withChannel(ch -> {
            try {
                ch.stat(properties.getSharePath());
            } catch (SftpException e) {
                throw new IOException("Không stat được share root '" + properties.getSharePath()
                        + "' trên remote: " + e.getMessage(), e);
            }
            return null;
        });
    }

    @Override
    public String describe() {
        FileStorageProperties.Sftp s = properties.getSftp();
        return "sftp://" + s.getUsername() + "@" + s.getHost() + ":" + s.getPort() + properties.getSharePath();
    }

    // --- Internal helpers ---

    @FunctionalInterface
    private interface SftpOp<T> {
        T run(ChannelSftp ch) throws JSchException, SftpException, IOException;
    }

    private <T> T withChannel(SftpOp<T> op) throws IOException {
        ChannelSftp ch = null;
        try {
            Session s = getSession();
            ch = (ChannelSftp) s.openChannel("sftp");
            ch.connect(properties.getSftp().getConnectTimeoutMs());
            return op.run(ch);
        } catch (JSchException | SftpException e) {
            throw new IOException("SFTP operation failed: " + e.getMessage(), e);
        } finally {
            if (ch != null) ch.disconnect();
        }
    }

    private synchronized Session getSession() throws JSchException {
        if (session != null && session.isConnected()) return session;
        session = openSession();
        return session;
    }

    private Session openSession() throws JSchException {
        FileStorageProperties.Sftp cfg = properties.getSftp();
        if (cfg.getHost() == null || cfg.getUsername() == null) {
            throw new JSchException("SFTP host/username chưa cấu hình (app.file.sftp.host/username)");
        }
        if (cfg.getPassword() == null || cfg.getPassword().isEmpty()) {
            throw new JSchException("SFTP password rỗng — đặt env APP_SFTP_PASSWORD hoặc app.file.sftp.password");
        }
        JSch jsch = new JSch();
        Session s = jsch.getSession(cfg.getUsername(), cfg.getHost(), cfg.getPort());
        s.setPassword(cfg.getPassword());
        s.setConfig("StrictHostKeyChecking", cfg.isStrictHostKeyChecking() ? "yes" : "no");
        s.setTimeout(cfg.getSessionTimeoutMs());
        s.setServerAliveInterval(60_000);
        s.setServerAliveCountMax(3);
        s.connect(cfg.getConnectTimeoutMs());
        log.info("SFTP connected to {}@{}:{}", cfg.getUsername(), cfg.getHost(), cfg.getPort());
        return s;
    }

    /** Tạo toàn bộ parent directories của remote file path. */
    private void ensureParentDir(ChannelSftp ch, String remoteFilePath) throws SftpException {
        int lastSlash = remoteFilePath.lastIndexOf('/');
        if (lastSlash <= 0) return;
        String parent = remoteFilePath.substring(0, lastSlash);
        if (exists(ch, parent)) return;

        // Walk từ root xuống, mkdir segment nào chưa tồn tại.
        int idx = parent.indexOf('/', 1);
        while (idx > 0) {
            String segment = parent.substring(0, idx);
            if (!exists(ch, segment)) {
                try { ch.mkdir(segment); } catch (SftpException ignore) { /* race, next check sẽ xử lý */ }
            }
            idx = parent.indexOf('/', idx + 1);
        }
        if (!exists(ch, parent)) {
            ch.mkdir(parent);
        }
    }

    private boolean exists(ChannelSftp ch, String path) {
        try { ch.lstat(path); return true; }
        catch (SftpException e) { return false; }
    }

    /** Join share-root + relative, chặn path-traversal cơ bản. */
    private String remotePath(String relativePath) {
        if (relativePath.contains("..")) {
            throw new IllegalArgumentException("Path traversal detected: " + relativePath);
        }
        String root = properties.getSharePath();
        if (root.endsWith("/")) root = root.substring(0, root.length() - 1);
        return root + "/" + relativePath;
    }
}
