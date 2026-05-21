package org.example.oracleconnectionpool.buttonaction;

import java.util.Collections;
import java.util.Map;

import lombok.Builder;
import lombok.Getter;
import org.example.oracleconnectionpool.security.AppUserDetails;

/**
 * Context truyền cho {@link ButtonActionHandler#handle(ButtonActionContext)}.
 * Chứa đầy đủ thông tin để handler xử lý mà không cần query lại.
 */
@Getter
@Builder
public class ButtonActionContext {
    /** ID biểu mẫu. */
    private final Long templateId;
    /** ID phiên nhập liệu (có thể null nếu chưa tạo entry). */
    private final Long entryId;
    /** Button key đang được bấm. */
    private final String buttonKey;
    /** User đang thao tác. */
    private final AppUserDetails user;
    /** Dữ liệu dòng từ frontend (JSON string) — có thể null. */
    private final String rowData;
    /** Payload tùy ý từ frontend (JSON string) — dành cho handler custom. */
    private final String payload;
    /**
     * Tham số runtime do user nhập từ FE dialog (vd: dueDate, comment).
     * Jackson auto-deserialize JSON object → typed Map. Default = empty
     * map → handler cũ không break (chưa đọc field này).
     */
    @Builder.Default
    private final Map<String, Object> params = Collections.emptyMap();
}
