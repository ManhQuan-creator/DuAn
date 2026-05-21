package org.example.oracleconnectionpool.service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.config.FileStorageProperties;
import org.example.oracleconnectionpool.constant.EntryStatus;
import org.example.oracleconnectionpool.entity.EntryFile;
import org.example.oracleconnectionpool.entity.GridDataEntry;
import org.example.oracleconnectionpool.exceptions.BadRequestException;
import org.example.oracleconnectionpool.exceptions.ForbiddenException;
import org.example.oracleconnectionpool.exceptions.NotFoundException;
import org.example.oracleconnectionpool.model.response.EntryFileResponse;
import org.example.oracleconnectionpool.repository.EntryFileRepository;
import org.example.oracleconnectionpool.repository.GridDataEntryRepository;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.example.oracleconnectionpool.storage.FileStorage;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class EntryFileService {

    private final EntryFileRepository entryFileRepository;
    private final GridDataEntryRepository entryRepository;
    private final FileStorageProperties properties;
    private final FileStorage fileStorage;

    /** Fail-fast nếu share-path chưa cấu hình; check storage backend thực sự sẵn sàng. */
    @PostConstruct
    void validateStorage() {
        if (properties.getSharePath() == null || properties.getSharePath().isBlank()) {
            throw new IllegalStateException(
                    "app.file.share-path chưa cấu hình. Đặt env APP_FILE_SHARE_PATH hoặc sửa application.yml.");
        }
        try {
            fileStorage.healthCheck();
            log.info("EntryFile storage OK: {}", fileStorage.describe());
        } catch (IOException e) {
            log.warn("EntryFile storage không sẵn sàng ({}): {}", fileStorage.describe(), e.getMessage());
        }
    }

    // --- Public API ---

    public List<EntryFileResponse> listByEntry(Long templateId, Long entryId, AppUserDetails currentUser) {
        checkEntryAccess(templateId, entryId, currentUser);
        return entryFileRepository.findByEntryIdOrderByCreatedAtDesc(entryId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public List<EntryFileResponse> upload(Long templateId, Long entryId,
                                          List<MultipartFile> files,
                                          AppUserDetails currentUser) {
        checkEntryAccess(templateId, entryId, currentUser);
        if (files == null || files.isEmpty()) {
            throw new BadRequestException("Chưa chọn file để upload");
        }

        List<EntryFileResponse> result = new ArrayList<>();
        for (MultipartFile file : files) {
            validateFile(file);

            String originalName = sanitizeFilename(file.getOriginalFilename());
            String ext = extractExtension(originalName);
            String storedName = UUID.randomUUID() + (ext.isEmpty() ? "" : "." + ext);
            String relativePath = "entry-" + entryId + "/" + storedName;

            try (InputStream in = file.getInputStream()) {
                fileStorage.write(relativePath, in);
            } catch (IOException ex) {
                log.error("Không lưu được file {} vào storage", originalName, ex);
                throw new BadRequestException("Không lưu được file '" + originalName + "': " + ex.getMessage());
            }

            EntryFile saved = entryFileRepository.save(EntryFile.builder()
                    .entryId(entryId)
                    .fileName(storedName)
                    .originalFileName(originalName)
                    .filePath(relativePath)
                    .fileSize(file.getSize())
                    .fileType(file.getContentType())
                    .build());
            result.add(toResponse(saved));
        }
        return result;
    }

    @Transactional
    public void delete(Long templateId, Long entryId, Long fileId, AppUserDetails currentUser) {
        checkEntryAccess(templateId, entryId, currentUser);
        EntryFile file = requireFile(entryId, fileId);

        // Xóa DB trước, sau đó xóa storage (best-effort, log nếu lỗi)
        entryFileRepository.delete(file);
        try {
            fileStorage.delete(file.getFilePath());
        } catch (IOException ex) {
            log.warn("Xóa DB thành công nhưng không xóa được file trên storage: {}", file.getFilePath(), ex);
        }
    }

    public EntryFile getForDownload(Long templateId, Long entryId, Long fileId, AppUserDetails currentUser) {
        checkEntryAccess(templateId, entryId, currentUser);
        return requireFile(entryId, fileId);
    }

    /** Mở input stream đọc file từ storage. Caller phải close. */
    public InputStream openStream(EntryFile file) throws IOException {
        return fileStorage.read(file.getFilePath());
    }


    // Folder File
    @Transactional
    public List<EntryFileResponse> uploadFolderFile(Long entryId, String entryFolder,
                                                    List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            throw new BadRequestException("Chưa chọn file để upload");
        }

        List<EntryFileResponse> result = new ArrayList<>();
        for (MultipartFile file : files) {
            validateFile(file);

            String originalName = sanitizeFilename(file.getOriginalFilename());
            String ext = extractExtension(originalName);
            String storedName = UUID.randomUUID() + (ext.isEmpty() ? "" : "." + ext);
            String relativePath = entryFolder + "-" + entryId + "/" + storedName;

            try (InputStream in = file.getInputStream()) {
                fileStorage.write(relativePath, in);
            } catch (IOException ex) {
                log.error("Không lưu được file {} vào storage", originalName, ex);
                throw new BadRequestException("Không lưu được file '" + originalName + "': " + ex.getMessage());
            }

            EntryFile saved = entryFileRepository.save(EntryFile.builder()
                    .entryId(entryId)
                    .fileName(storedName)
                    .originalFileName(originalName)
                    .filePath(relativePath)
                    .fileSize(file.getSize())
                    .fileType(file.getContentType())
                    .build());
            result.add(toResponse(saved));
        }
        return result;
    }

    @Transactional
    public void deleteFolderFile(Long entryId, Long fileId) {
        EntryFile file = requireFile(entryId, fileId);

        // Xóa DB trước, sau đó xóa storage (best-effort, log nếu lỗi)
        entryFileRepository.delete(file);
        try {
            fileStorage.delete(file.getFilePath());
        } catch (IOException ex) {
            log.warn("Xóa DB thành công nhưng không xóa được file trên storage: {}", file.getFilePath(), ex);
        }
    }

    public EntryFile getForDownloadFolderFile(Long entryId, Long fileId) {
        return requireFolderFile(entryId, fileId);
    }

    public List<EntryFileResponse> listByEntryFolder(List<Long> entryId, String type) {
        return entryFileRepository.searchByEntryIdsAndType(entryId, type).stream()
                .map(this::toResponse).toList();
    }

    // --- Helpers ---

    private EntryFile requireFile(Long entryId, Long fileId) {
        EntryFile file = entryFileRepository.findById(fileId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy file: " + fileId));
        if (!file.getEntryId().equals(entryId)) {
            throw new NotFoundException("File không thuộc phiên nhập liệu này");
        }
        return file;
    }

    private EntryFile requireFolderFile(Long entryId, Long fileId) {
        EntryFile file = entryFileRepository.findById(fileId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy file: " + fileId));
        if (!file.getEntryId().equals(entryId)) {
            throw new NotFoundException("File không thuộc phần nội dung này");
        }
        return file;
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File rỗng hoặc không hợp lệ");
        }
        if (file.getSize() > properties.getMaxFileSize()) {
            throw new BadRequestException("File '" + file.getOriginalFilename()
                    + "' vượt quá giới hạn " + (properties.getMaxFileSize() / (1024 * 1024)) + " MB");
        }
        String ext = extractExtension(file.getOriginalFilename());
        if (!ext.isEmpty() && properties.getBlockedExtensions().contains(ext)) {
            throw new BadRequestException("Không cho phép upload file có đuôi ." + ext);
        }
    }

    private String extractExtension(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) return "";
        return filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    /** Loại bỏ path separator và ký tự nguy hiểm khỏi tên file. */
    private String sanitizeFilename(String raw) {
        if (raw == null || raw.isBlank()) return "file";
        String name = raw.replace('\\', '/');
        int slash = name.lastIndexOf('/');
        if (slash >= 0) name = name.substring(slash + 1);
        name = name.replaceAll("[\\x00-\\x1f\"*:<>?|]", "_").trim();
        if (name.isEmpty()) name = "file";
        if (name.length() > 255) name = name.substring(0, 255);
        return name;
    }

    /** Reuse scope rule của GridDataEntryService: SUBSIDIARY chỉ thao tác entry của mình. */
    private void checkEntryAccess(Long templateId, Long entryId, AppUserDetails currentUser) {
        GridDataEntry entry = entryRepository.findById(entryId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phiên nhập liệu: " + entryId));
        if (!entry.getTemplateId().equals(templateId)) {
            throw new NotFoundException("Phiên nhập liệu không thuộc biểu mẫu: " + templateId);
        }
        if (isEvnnpcScope(currentUser)) return;
        if (EntryStatus.DISTRIBUTED.equals(entry.getStatus())) return;
        String companyCode = currentUser.getCompanyCode();
        if (companyCode == null || !companyCode.equals(entry.getOrgCode())) {
            throw new ForbiddenException("Bạn không có quyền thao tác với file của đơn vị khác");
        }
    }

    private boolean isEvnnpcScope(AppUserDetails user) {
        boolean isAdmin = user.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return isAdmin || "EVNNPC".equals(user.getOrgGroupCode());
    }

    private EntryFileResponse toResponse(EntryFile f) {
        return EntryFileResponse.builder()
                .id(f.getId())
                .entryId(f.getEntryId())
                .fileName(f.getFileName())
                .originalFileName(f.getOriginalFileName())
                .fileSize(f.getFileSize())
                .fileType(f.getFileType())
                .createdBy(f.getCreatedBy())
                .createdAt(f.getCreatedAt())
                .build();
    }
}
