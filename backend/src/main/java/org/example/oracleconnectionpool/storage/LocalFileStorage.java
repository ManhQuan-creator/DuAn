package org.example.oracleconnectionpool.storage;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.config.FileStorageProperties;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

/**
 * Impl FileStorage ghi thẳng vào filesystem cùng máy — dùng cho prod hoặc máy chạy
 * backend ngay tại nơi có storage.
 */
@Slf4j
@RequiredArgsConstructor
public class LocalFileStorage implements FileStorage {

    private final FileStorageProperties properties;

    @Override
    public void write(String relativePath, InputStream in) throws IOException {
        Path target = resolve(relativePath);
        Files.createDirectories(target.getParent());
        Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
    }

    @Override
    public InputStream read(String relativePath) throws IOException {
        Path source = resolve(relativePath);
        if (!Files.exists(source)) {
            throw new IOException("File không tồn tại: " + relativePath);
        }
        return Files.newInputStream(source);
    }

    @Override
    public void delete(String relativePath) throws IOException {
        Files.deleteIfExists(resolve(relativePath));
    }

    @Override
    public void healthCheck() throws IOException {
        Path root = shareRoot();
        Files.createDirectories(root);
        if (!Files.isWritable(root)) {
            throw new IOException("Share folder không ghi được: " + root);
        }
    }

    @Override
    public String describe() {
        return "local:" + shareRoot();
    }

    /** Resolve relative path → absolute + chặn path-traversal. */
    private Path resolve(String relativePath) {
        Path root = shareRoot();
        Path resolved = root.resolve(relativePath).normalize();
        if (!resolved.startsWith(root)) {
            throw new IllegalArgumentException("Path traversal detected: " + relativePath);
        }
        return resolved;
    }

    private Path shareRoot() {
        return Paths.get(properties.getSharePath()).toAbsolutePath().normalize();
    }
}
