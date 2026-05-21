package org.example.oracleconnectionpool.constant;

/**
 * Status hợp lệ cho {@code GRID_DATA_ENTRY.status}.
 *
 * <p>Vòng đời chuẩn:
 * <pre>
 *   DRAFT ──submit──► SUBMITTED ──approve N steps──► APPROVED
 *                          │
 *                          ├──reject──► REJECTED
 *                          └──return──► RETURNED ──submit lại──► SUBMITTED
 * </pre>
 *
 * <p>Riêng status {@link #DISTRIBUTED} dùng cho flow Tổng công ty giao chi phí xuống đơn
 * vị (vd biểu phân bổ chi phí SCL cho đơn vị) — entry sau khi DISTRIBUTED thì các đơn vị
 * mới thấy được trong danh sách.
 *
 * <p>Workflow-step intermediate status (vd {@code BKH_REVIEWED}, {@code BKT_VERIFIED},
 * {@code TGD_APPROVED}, {@code HDTV_APPROVED}) được set động từ
 * {@code WorkflowStep.statusAfterApprove} (config trong DB qua BPMN/seed) — KHÔNG khai
 * báo hằng số ở đây vì chúng là dữ liệu cấu hình, không phải enum cố định.
 */
public final class EntryStatus {

    public static final String DRAFT = "DRAFT";
    public static final String SUBMITTED = "SUBMITTED";
    public static final String RETURNED = "RETURNED";
    public static final String APPROVED = "APPROVED";
    public static final String REJECTED = "REJECTED";
    public static final String DISTRIBUTED = "DISTRIBUTED";

    private EntryStatus() {}
}
