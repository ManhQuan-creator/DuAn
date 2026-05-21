package org.example.oracleconnectionpool.buttonaction.handler.scl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.buttonaction.ButtonActionContext;
import org.example.oracleconnectionpool.buttonaction.ButtonActionHandler;
import org.example.oracleconnectionpool.buttonaction.ButtonActionResult;
import org.example.oracleconnectionpool.buttonaction.util.ButtonActionEntryUtil;
import org.example.oracleconnectionpool.entity.GridDataEntry;
import org.example.oracleconnectionpool.repository.GridDataEntryRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class SCLTaoBieuMauPhanBoCPSCLChoDV implements ButtonActionHandler {

    private final GridDataEntryRepository entryRepository;
    private final ButtonActionEntryUtil entryUtil;

    /** Template nguồn — Phương án tạm tính chi phí SCL năm N */
    private static final long SOURCE_TEMPLATE_ID = 141;
    /** Template đích — Biểu mẫu phân bổ chi phí SCL cho đơn vị */
    private static final long TARGET_TEMPLATE_ID = 304L;
    /** orgCode mặc định cho báo cáo cấp Tổng công ty */
    private static final String TCT_ORG_CODE = "TCT";
    private static final String REDIRECT_BASE = "/report/phan-bo-chi-phi-scl";

    @Override
    public String getKey() {
        return "SCL_PHAN_BO_CHI_PHI_SCL_CHO_DON_VI";
    }

    @Override
    public String getLabel() {
        return "SCL: Phân bổ chi phí SCL cho đơn vị";
    }

    @Override
    public String getDescription() {
        return "Tạo phiên dữ liệu biểu Phân bổ chi phí SCL cho đơn vị";
    }

    @Override
    @Transactional
    public ButtonActionResult handle(ButtonActionContext ctx) {
        Long entryId = ctx.getEntryId();
        if (entryId == null) {
            log.warn("[{}] Bỏ qua: không có entryId trong context", getKey());
            return null;
        }

        GridDataEntry source = entryRepository.findById(entryId).orElse(null);
        if (source == null) {
            log.warn("[{}] Bỏ qua: không tìm thấy entry nguồn id={}", getKey(), entryId);
            return null;
        }

        // Safety check — chỉ chạy cho đúng template nguồn
        if (!Long.valueOf(SOURCE_TEMPLATE_ID).equals(source.getTemplateId())) {
            log.warn("[{}] Bỏ qua: entry templateId={} không khớp SOURCE_TEMPLATE_ID={}",
                    getKey(), source.getTemplateId(), SOURCE_TEMPLATE_ID);
            return null;
        }

        // Check duplicate theo unique constraint UQ_ENTRY_PERIOD
        Optional<GridDataEntry> existed = entryUtil.findExisting(
                TARGET_TEMPLATE_ID, TCT_ORG_CODE, source.getYear(), source.getMonth());
        if (existed.isPresent()) {
            return ButtonActionResult.error("Đã tồn tại biểu mẫu phân bổ chi phí SCL cho đơn vị")
                    .withRedirect(buildRedirect(existed.get().getId()));
        }

        String username = ctx.getUser() != null ? ctx.getUser().getUsername() : null;

        Long targetEntryId = entryUtil
                .createTargetEntry(TARGET_TEMPLATE_ID, source, TCT_ORG_CODE, username, getKey())
                .orElseThrow(() -> new IllegalStateException(
                        "Không tạo được entry đích dù findExisting trả về empty — race condition?"));
        
        entryUtil.markDistributed(source, username, getKey());

        return ButtonActionResult.success("Đã lập biểu mẫu phân bổ chi phí SCL cho đơn vị thành công")
                .withRedirect(buildRedirect(targetEntryId));
    }

    private static String buildRedirect(Long entryId) {
        String redirect = REDIRECT_BASE + "?templateId=" + TARGET_TEMPLATE_ID + "&entryId=" + entryId;
        log.info("[{}] Redirect to: {}", "SCL_PHAN_BO_CHI_PHI_SCL_CHO_DON_VI", redirect);
        return redirect;
    }
}
