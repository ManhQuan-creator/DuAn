package org.example.oracleconnectionpool.workflow.action.handler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.constant.EntryStatus;
import org.example.oracleconnectionpool.entity.GridDataEntry;
import org.example.oracleconnectionpool.entity.GridTemplate;
import org.example.oracleconnectionpool.exceptions.NotFoundException;
import org.example.oracleconnectionpool.repository.GridDataEntryRepository;
import org.example.oracleconnectionpool.repository.GridTemplateRepository;
import org.example.oracleconnectionpool.service.GridDataEntryService;
import org.example.oracleconnectionpool.workflow.action.WorkflowActionContext;
import org.example.oracleconnectionpool.workflow.action.WorkflowActionHandler;
import org.example.oracleconnectionpool.workflow.action.WorkflowActionResult;
import org.springframework.stereotype.Component;

/**
 * Handler khi Trưởng phòng KH phê duyệt phiên "Đơn vị lập kế hoạch" (template 72).
 *
 * <p>Tự động tạo 2 phiên nhập liệu:
 * <ul>
 *   <li>Template 82 — Tổng hợp kế hoạch tất cả đơn vị</li>
 *   <li>Template 62 — Tổng hợp kế hoạch danh mục từng đơn vị</li>
 * </ul>
 *
 * <p>Các phiên mới kế thừa orgCode + year + month từ entry nguồn.
 * Nếu phiên đích đã tồn tại (cùng templateId + orgCode + year + month) → bỏ qua, không tạo trùng.
 *
 * <p>Chạy trong cùng @Transactional của WorkflowService.completeTask — throw
 * RuntimeException sẽ rollback việc phê duyệt.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DonViLapKeHoachApproveHandler implements WorkflowActionHandler {

    public static final String KEY = "DVLKH_APPROVE_CREATE_ENTRIES";

    /** Template nguồn — Đơn vị lập kế hoạch */
    private static final long SOURCE_TEMPLATE_ID = 72L;

    /** Template đích 1 — Tổng hợp kế hoạch tất cả đơn vị (chỉ Tổng công ty xem) */
    private static final long TARGET_TEMPLATE_1 = 82L;

    /** Template đích 2 — Tổng hợp kế hoạch danh mục từng đơn vị (theo đơn vị) */
    private static final long TARGET_TEMPLATE_2 = 62L;

    /** orgCode mặc định cho báo cáo cấp Tổng công ty */
    private static final String TCT_ORG_CODE = "TCT";

    private final GridDataEntryRepository entryRepository;
    private final GridTemplateRepository templateRepository;
    private final GridDataEntryService gridDataEntryService;

    @Override
    public String getKey() {
        return KEY;
    }

    @Override
    public String getLabel() {
        return "[SCL] Đơn vị lập KH — Phê duyệt (sinh phiên Tổng hợp KH)";
    }

    @Override
    public String getDescription() {
        return "Khi Trưởng phòng KH duyệt phiên Đơn vị lập kế hoạch (template 72), "
                + "tự động tạo 2 phiên: Tổng hợp KH tất cả ĐV (82) + Tổng hợp KH danh mục từng ĐV (62).";
    }

    @Override
    public WorkflowActionResult handle(WorkflowActionContext ctx) {
        Long entryId = ctx.getEntryId();
        if (entryId == null) {
            log.warn("[{}] Bỏ qua: không có entryId trong context", KEY);
            return null;
        }

        GridDataEntry source = entryRepository.findById(entryId).orElse(null);
        if (source == null) {
            log.warn("[{}] Bỏ qua: không tìm thấy entry nguồn id={}", KEY, entryId);
            return null;
        }

        // Safety check — chỉ chạy cho đúng template nguồn
        if (!Long.valueOf(SOURCE_TEMPLATE_ID).equals(source.getTemplateId())) {
            log.warn("[{}] Bỏ qua: entry templateId={} không khớp SOURCE_TEMPLATE_ID={}",
                    KEY, source.getTemplateId(), SOURCE_TEMPLATE_ID);
            return null;
        }

        String username = ctx.getUser() != null ? ctx.getUser().getUsername() : null;

        // Template 82 (Tổng hợp tất cả ĐV) — orgCode cố định = TCT (chỉ Tổng công ty xem)
        createTargetEntry(TARGET_TEMPLATE_1, source, TCT_ORG_CODE, username);
        // Template 62 (Tổng hợp danh mục từng ĐV) — giữ orgCode theo đơn vị nguồn
        // → Redirect user sang phiên này sau khi duyệt, để tiếp tục nhập tổng hợp danh mục theo ĐV.
        Long t62EntryId = createTargetEntry(TARGET_TEMPLATE_2, source, source.getOrgCode(), username);

        if (t62EntryId == null) return null;
        return WorkflowActionResult.redirect(
                "/report/tong-hop-ke-hoach-danh-muc-tung-don-vi?templateId=" + TARGET_TEMPLATE_2 + "&entryId=" + t62EntryId);
    }

    /** Trả ID entry vừa tạo, hoặc null nếu đã tồn tại / bỏ qua. */
    private Long createTargetEntry(long targetTemplateId, GridDataEntry source, String targetOrgCode, String username) {
        // Kiểm tra trùng
        boolean existed = entryRepository.existsByTemplateIdAndOrgCodeAndYearAndMonth(
                targetTemplateId, targetOrgCode, source.getYear(), source.getMonth());
        if (existed) {
            log.info("[{}] Đã tồn tại phiên template={} org={} year={} month={} — bỏ qua",
                    KEY, targetTemplateId, targetOrgCode, source.getYear(), source.getMonth());
            return null;
        }

        GridTemplate targetTemplate = templateRepository.findById(targetTemplateId).orElseThrow(() ->
                new NotFoundException("Không tìm thấy biểu mẫu đích (id=" + targetTemplateId
                        + "). Vui lòng báo admin kiểm tra cấu hình."));

        String monthPart = source.getMonth() == null ? "null" : String.valueOf(source.getMonth());
        String orgPart = targetOrgCode != null ? targetOrgCode : "ALL";
        String entryCode = targetTemplate.getCode() + "_" + orgPart + "_" + source.getYear() + "_" + monthPart;
        String entryName = source.getYear() + "_" + monthPart;

        try {
            // Snapshot template rows ngay lúc tạo — entry là source of truth (snapshot
            // model). KHÔNG được dùng "[]" rỗng vì FE đã bỏ legacy fallback merge với
            // template lúc render từ V10 (xem ButtonActionEntryUtil.createTargetEntry).
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
                    .build();

            GridDataEntry saved = entryRepository.save(newEntry);
            log.info("[{}] Đã tạo phiên id={} template={} code='{}' org={} year={} month={} — trigger bởi entry nguồn id={}, user={}",
                    KEY, saved.getId(), targetTemplateId, entryCode,
                    targetOrgCode, source.getYear(), source.getMonth(),
                    source.getId(), username);
            return saved.getId();
        } catch (Exception ex) {
            log.error("[{}] LỖI khi tạo phiên cho template={} org={} year={} month={}: {}",
                    KEY, targetTemplateId, targetOrgCode, source.getYear(), source.getMonth(),
                    ex.getMessage(), ex);
            throw new RuntimeException("Không thể tạo phiên tổng hợp (template " + targetTemplateId + "): "
                    + ex.getMessage(), ex);
        }
    }
}
