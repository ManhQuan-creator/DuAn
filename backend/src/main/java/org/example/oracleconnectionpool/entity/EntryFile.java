package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * File đính kèm của một GridDataEntry.
 *
 * - filePath: RELATIVE path từ share-root tới file (vd: "entry-266/uuid.pdf").
 *   Runtime sẽ join với app.file.share-path để ra absolute path. Lưu relative để
 *   khi đổi storage giữa các môi trường không phải migrate DB.
 * - fileName: tên file đã lưu trên disk (uuid + ext) — duy nhất.
 * - originalFileName: tên gốc do user upload, hiển thị ở UI.
 */
@Entity
@Table(name = "ENTRY_FILES", indexes = {
        @Index(name = "IDX_ENTRY_FILES_ENTRY_ID", columnList = "ENTRY_ID")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EntryFile extends AbstractAuditingUserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Long id;

    @Column(name = "ENTRY_ID", nullable = false)
    private Long entryId;

    @Column(name = "FILE_NAME", nullable = false, length = 255)
    private String fileName;

    @Column(name = "ORIGINAL_FILE_NAME", nullable = false, length = 500)
    private String originalFileName;

    @Column(name = "FILE_PATH", nullable = false, length = 1000)
    private String filePath;

    @Column(name = "FILE_SIZE", nullable = false)
    private Long fileSize;

    @Column(name = "FILE_TYPE", length = 200)
    private String fileType;
}
