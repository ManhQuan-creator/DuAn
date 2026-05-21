package org.example.oracleconnectionpool.buttonaction.util;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.constant.EntryStatus;
import org.example.oracleconnectionpool.entity.GridDataEntry;
import org.example.oracleconnectionpool.entity.GridTemplate;
import org.example.oracleconnectionpool.exceptions.NotFoundException;
import org.example.oracleconnectionpool.repository.GridDataEntryRepository;
import org.example.oracleconnectionpool.repository.GridTemplateRepository;
import org.example.oracleconnectionpool.service.GridDataEntryService;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Tập hợp các thao tác lặp lại giữa nhiều {@link org.example.oracleconnectionpool.buttonaction.ButtonActionHandler}:
 *
 * <ul>
 *   <li>{@link #findExisting(Long, String, Integer, Integer)} — tra cứu entry đã có theo
 *       (template, orgCode, year, month) để xử lý nhánh "đã tồn tại".</li>
 *   <li>{@link #createTargetEntry(long, GridDataEntry, String, String, String)} — tạo entry
 *       tại template đích copy period từ source entry. Idempotent (trùng → trả về Optional rỗng).</li>
 *   <li>{@link #markDistributed(GridDataEntry, String, String)} — đổi status entry sang
 *       {@code DISTRIBUTED} (no-op nếu đã DISTRIBUTED).</li>
 * </ul>
 *
 * <p>Tham số {@code logTag} dùng làm prefix log để truy ngược về handler đã gọi
 * (thường truyền {@code handler.getKey()}).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ButtonActionEntryUtil {

    private final GridDataEntryRepository entryRepository;
    private final GridTemplateRepository templateRepository;
    private final GridDataEntryService gridDataEntryService;

    /**
     * Tra cứu entry hiện có theo unique key (templateId, orgCode, year, month) — khớp
     * unique constraint {@code UQ_ENTRY_PERIOD}.
     */
    public Optional<GridDataEntry> findExisting(Long targetTemplateId,
                                                String targetOrgCode,
                                                Integer year,
                                                Integer month) {
        return entryRepository.findByTemplateIdAndOrgCodeAndYearAndMonth(
                targetTemplateId, targetOrgCode, year, month);
    }

    /**
     * Tạo entry tại {@code targetTemplateId} copy {@code year}/{@code month} từ {@code source}.
     *
     * <p>Idempotent: nếu đã tồn tại (templateId + orgCode + year + month) → log info và trả
     * về {@link Optional#empty()} (không tạo trùng). Caller nên gọi
     * {@link #findExisting(Long, String, Integer, Integer)} trước nếu muốn redirect tới entry cũ.
     *
     * @param targetTemplateId template đích
     * @param source           entry nguồn (lấy year/month)
     * @param targetOrgCode    orgCode cho entry đích (vd "TCT" — Tổng công ty)
     * @param username         user thao tác (chỉ dùng để log; auditing field do listener tự set)
     * @param logTag           prefix log (thường là handler.getKey())
     * @return id của entry mới tạo, hoặc empty nếu đã tồn tại
     * @throws NotFoundException nếu template đích không tồn tại
     * @throws RuntimeException  nếu save thất bại
     */
    public Optional<Long> createTargetEntry(long targetTemplateId,
                                            GridDataEntry source,
                                            String targetOrgCode,
                                            String username,
                                            String logTag) {
        return createTargetEntry(targetTemplateId, source, targetOrgCode, username, logTag, null);
    }

    /**
     * Overload nhận thêm {@code dueDate} — set hạn xử lý cho entry mới (vd flow
     * "Giao chi phí cho đơn vị" cần cùng deadline cho tất cả PCs).
     *
     * @param dueDate hạn xử lý (LocalDateTime, có thể null = không set)
     */
    public Optional<Long> createTargetEntry(long targetTemplateId,
                                            GridDataEntry source,
                                            String targetOrgCode,
                                            String username,
                                            String logTag,
                                            LocalDateTime dueDate) {
        boolean existed = entryRepository.existsByTemplateIdAndOrgCodeAndYearAndMonth(
                targetTemplateId, targetOrgCode, source.getYear(), source.getMonth());
        if (existed) {
            log.info("[{}] Đã tồn tại phiên template={} org={} year={} month={} — bỏ qua",
                    logTag, targetTemplateId, targetOrgCode, source.getYear(), source.getMonth());
            return Optional.empty();
        }

        GridTemplate targetTemplate = templateRepository.findById(targetTemplateId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy biểu mẫu đích (id="
                        + targetTemplateId + "). Vui lòng báo admin kiểm tra cấu hình."));

        String orgPart = targetOrgCode != null ? targetOrgCode : "ALL";
        String entryCode = targetTemplate.getCode() + "_" + orgPart + "_" + source.getYear();
        if (source.getMonth() != null) {
            entryCode += "_" + source.getMonth();
        }
        String entryName = targetTemplate.getCode() + " " + orgPart + " " + source.getYear();
        if (source.getMonth() != null) {
            entryName += " " + source.getMonth();
        }

        try {
            // Snapshot template rows ngay lúc tạo — entry là source of truth (snapshot
            // model). KHÔNG được dùng "[]" rỗng vì FE đã bỏ legacy fallback merge với
            // template lúc render từ V10.
            String rowDataJson = gridDataEntryService.snapshotTemplateRows(targetTemplateId);

            GridDataEntry newEntry = GridDataEntry.builder()
                    .templateId(targetTemplateId)
                    .entryCode(entryCode)
                    .entryName(entryName)
                    .orgCode(targetOrgCode)
                    .year(source.getYear())
                    .month(source.getMonth())
                    .rowData(rowDataJson)
                    .status(EntryStatus.DRAFT)
                    .dueDate(dueDate)
                    .build();

            GridDataEntry saved = entryRepository.save(newEntry);
            log.info("[{}] Đã tạo phiên id={} template={} code='{}' org={} year={} month={} dueDate={} — trigger bởi entry nguồn id={}, user={}",
                    logTag, saved.getId(), targetTemplateId, entryCode,
                    targetOrgCode, source.getYear(), source.getMonth(), dueDate,
                    source.getId(), username);
            return Optional.of(saved.getId());
        } catch (Exception ex) {
            log.error("[{}] LỖI khi tạo phiên cho template={} org={} year={} month={}: {}",
                    logTag, targetTemplateId, targetOrgCode, source.getYear(), source.getMonth(),
                    ex.getMessage(), ex);
            throw new RuntimeException("Không thể tạo phiên tổng hợp (template " + targetTemplateId
                    + "): " + ex.getMessage(), ex);
        }
    }

    /**
     * Đổi status entry sang {@code DISTRIBUTED} và persist.
     *
     * @param entry    entry cần chuyển (không null)
     * @param username user thao tác (log only)
     * @param logTag   prefix log
     * @return {@code true} nếu vừa chuyển từ status khác sang DISTRIBUTED;
     *         {@code false} nếu entry đã DISTRIBUTED từ trước (no-op).
     */
    public boolean markDistributed(GridDataEntry entry, String username, String logTag) {
        if (EntryStatus.DISTRIBUTED.equals(entry.getStatus())) {
            return false;
        }
        entry.setStatus(EntryStatus.DISTRIBUTED);
        entryRepository.save(entry);
        log.info("[{}] Entry id={} template={} đã chuyển sang DISTRIBUTED bởi user={}",
                logTag, entry.getId(), entry.getTemplateId(),
                username != null ? username : "anonymous");
        return true;
    }
}
