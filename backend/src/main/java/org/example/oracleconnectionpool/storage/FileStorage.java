package org.example.oracleconnectionpool.storage;

import java.io.IOException;
import java.io.InputStream;

/**
 * Abstraction cho backend lưu file đính kèm entry.
 *
 * Có 2 impl:
 *  - LocalFileStorage: dùng java.nio.Files — khi backend chạy cùng máy với storage.
 *  - SftpFileStorage: dùng JSch SFTP — khi backend dev Windows trỏ về Linux share.
 *
 * Mọi path truyền vào là RELATIVE tới share-root (vd "entry-266/uuid.pdf").
 * Impl tự normalize + chặn path-traversal.
 */
public interface FileStorage {

    /** Ghi bytes từ input stream vào relativePath. Tạo folder cha nếu chưa có. */
    void write(String relativePath, InputStream in) throws IOException;

    /** Đọc file ra stream. Caller phải close để release resource (session SFTP, handle file). */
    InputStream read(String relativePath) throws IOException;

    /** Xóa file. Không báo lỗi nếu file đã không tồn tại. */
    void delete(String relativePath) throws IOException;

    /** Check storage hoạt động — dùng cho startup log. */
    void healthCheck() throws IOException;

    /** Mô tả ngắn để log (vd "local:<path>" hoặc "sftp://<user>@<host>:<port><path>"). */
    String describe();
}
