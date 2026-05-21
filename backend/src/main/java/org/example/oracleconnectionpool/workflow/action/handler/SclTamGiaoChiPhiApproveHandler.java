package org.example.oracleconnectionpool.workflow.action.handler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.constant.EntryStatus;
import org.example.oracleconnectionpool.entity.GridDataEntry;
import org.example.oracleconnectionpool.entity.GridTemplate;
import org.example.oracleconnectionpool.repository.GridDataEntryRepository;
import org.example.oracleconnectionpool.repository.GridTemplateRepository;
import org.example.oracleconnectionpool.service.GridDataEntryService;
import org.example.oracleconnectionpool.workflow.action.WorkflowActionContext;
import org.example.oracleconnectionpool.workflow.action.WorkflowActionHandler;
import org.example.oracleconnectionpool.workflow.action.WorkflowActionResult;
import org.springframework.stereotype.Component;

/**
 * Handler cho bước "Tạm giao chi phí" của Quy trình sửa chữa lớn (SCL).
 *
 * <p>Khi user phê duyệt một phiên nhập liệu của {@code SOURCE_TEMPLATE_ID} (biểu mẫu
 * "Tạm giao chi phí"), hệ thống tự động sinh một phiên nhập liệu mới ở
 * {@code TARGET_TEMPLATE_ID} (biểu mẫu "Lập kế hoạch tạm tính") với **cùng năm + tháng
 * + đơn vị**. Nếu đã tồn tại phiên cùng 3 khoá đó thì bỏ qua, không tạo trùng.
 *
 * <p>Hiện tại hardcode 2 templateId. Sau này nếu có nhiều cặp tương tự thì refactor
 * sang bảng cấu hình.
 *
 * <p>Chạy trong cùng @Transactional của WorkflowService.completeTask — throw
 * RuntimeException sẽ rollback việc phê duyệt, và message sẽ hiển thị lên UI
 * qua {@code this.dialog.error(err.error?.message)} ở frontend.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SclTamGiaoChiPhiApproveHandler implements WorkflowActionHandler {

    public static final String KEY = "SCL_TAM_GIAO_CHI_PHI_APPROVE";
    public static final String LABEL = "[SCL] Tạm giao chi phí — Phê duyệt (sinh phiên Lập kế hoạch tạm tính)";

    /** ID biểu mẫu "Tạm giao chi phí" — nguồn, trigger handler khi được phê duyệt. */
    private static final long SOURCE_TEMPLATE_ID = 141L;

    /** ID biểu mẫu "Lập kế hoạch tạm tính" — đích, sẽ tự động tạo phiên mới. */
    private static final long TARGET_TEMPLATE_ID = 64L;

    private final GridDataEntryRepository entryRepository;
    private final GridTemplateRepository templateRepository;
    private final GridDataEntryService gridDataEntryService;

    @Override
    public String getKey() {
        return KEY;
    }

    @Override
    public String getLabel() {
        return LABEL;
    }

    @Override
    public String getDescription() {
        return "Khi phê duyệt bước Tạm giao chi phí (SCL), tự động sinh 1 phiên cho biểu mẫu "
                + "Lập kế hoạch tạm tính với cùng năm/tháng/đơn vị (bỏ qua nếu đã có).";
    }

    @Override
    public WorkflowActionResult handle(WorkflowActionContext ctx) {
        methodA(ctx);
        return null;
    }

    /** Trả ID của entry vừa tạo, hoặc null nếu bỏ qua (đã tồn tại / guard fail). */
    private void methodA(WorkflowActionContext ctx) {
        Long entryId = ctx.getEntryId();
        if (entryId == null) {
            log.warn("[{}] Bỏ qua: không có entryId trong context", KEY);
            return;
        }

        GridDataEntry source = entryRepository.findById(entryId).orElse(null);
        if (source == null) {
            log.warn("[{}] Bỏ qua: không tìm thấy entry nguồn id={}", KEY, entryId);
            return;
        }

        // Safety check — handler có thể bị gán nhầm vào workflow khác, không tự kích hoạt
        if (!Long.valueOf(SOURCE_TEMPLATE_ID).equals(source.getTemplateId())) {
            log.warn("[{}] Bỏ qua: entry templateId={} không khớp SOURCE_TEMPLATE_ID={}",
                    KEY, source.getTemplateId(), SOURCE_TEMPLATE_ID);
            return;
        }

        // Check duplicate theo (templateId đích + orgCode + year + month) — unique constraint UQ_ENTRY_PERIOD
        boolean existed = entryRepository.existsByTemplateIdAndOrgCodeAndYearAndMonth(
                TARGET_TEMPLATE_ID, source.getOrgCode(), source.getYear(), source.getMonth());
        if (existed) {
            log.info("[{}] Đã tồn tại phiên template={} org={} year={} month={} — bỏ qua, không tạo trùng",
                    KEY, TARGET_TEMPLATE_ID, source.getOrgCode(), source.getYear(), source.getMonth());
            return;
        }

        GridTemplate targetTemplate = templateRepository.findById(TARGET_TEMPLATE_ID).orElseThrow(() ->
                new RuntimeException("Không tìm thấy biểu mẫu đích (id=" + TARGET_TEMPLATE_ID
                        + ") để sinh phiên tự động. Vui lòng báo admin kiểm tra cấu hình."));

        String monthPart = source.getMonth() == null ? "null" : String.valueOf(source.getMonth());
        String entryCode = targetTemplate.getCode() + "_" + source.getYear() + "_" + monthPart;
        String entryName = source.getYear() + "_" + monthPart;

        try {
            // Snapshot template rows ngay lúc tạo — entry là source of truth (snapshot
            // model). KHÔNG được dùng "[]" rỗng vì FE đã bỏ legacy fallback merge với
            // template lúc render từ V10 (xem ButtonActionEntryUtil.createTargetEntry).
            String rowDataJson = gridDataEntryService.snapshotTemplateRows(TARGET_TEMPLATE_ID);

            GridDataEntry newEntry = GridDataEntry.builder()
                    .templateId(TARGET_TEMPLATE_ID)
                    .entryCode(entryCode)
                    .entryName(entryName)
                    .orgCode(source.getOrgCode())
                    .year(source.getYear())
                    .month(source.getMonth())
                    .rowData(rowDataJson)
                    .status(EntryStatus.DRAFT)
                    // createdBy/createdAt auto-fill bởi CustomAuditingEntityListener từ SecurityContext
                    // → chính là user đang phê duyệt
                    .build();

            GridDataEntry saved = entryRepository.save(newEntry);
            log.info("[{}] Đã tự động tạo phiên id={} template={} code='{}' org={} year={} month={} — trigger bởi entry nguồn id={}, user={}",
                    KEY, saved.getId(), TARGET_TEMPLATE_ID, entryCode,
                    source.getOrgCode(), source.getYear(), source.getMonth(),
                    entryId, ctx.getUser() != null ? ctx.getUser().getUsername() : null);
        } catch (Exception ex) {
            log.error("[{}] LỖI khi tạo phiên tự động cho template={} org={} year={} month={}: {}",
                    KEY, TARGET_TEMPLATE_ID, source.getOrgCode(), source.getYear(), source.getMonth(),
                    ex.getMessage(), ex);
            throw new RuntimeException("Không thể tự động sinh phiên Lập kế hoạch tạm tính: "
                    + ex.getMessage(), ex);
        }
    }
}
