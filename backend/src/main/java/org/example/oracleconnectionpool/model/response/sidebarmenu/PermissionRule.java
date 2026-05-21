package org.example.oracleconnectionpool.model.response.sidebarmenu;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Một quy tắc phân quyền hiển thị menu sidebar.
 *
 * Hai loại rule:
 *  1. {@code deptCode != null} — quy tắc theo Ban/Phòng:
 *     "user thuộc {@code deptCode} VÀ chức danh nằm trong {@code positionCodes}".
 *     Nếu {@code positionCodes} rỗng → áp dụng cho mọi chức danh thuộc dept đó.
 *  2. {@code deptCode == null} — quy tắc cho lãnh đạo cấp cao (HDTV/TGD/PTGD/GD/PGD):
 *     "user có {@code deptCode == null} (lãnh đạo cấp cao) VÀ chức danh nằm trong {@code positionCodes}".
 *     {@code positionCodes} bắt buộc không rỗng cho rule loại này.
 *
 * Một SidebarMenu có thể có nhiều rule (OR-logic):
 *   user thấy menu nếu match ÍT NHẤT một rule (và đã thuộc đúng orgGroupCode).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PermissionRule {
    /** Mã ban/phòng (BAN_KH, PHONG_KH, ...). Null = quy tắc cho lãnh đạo cấp cao (không thuộc dept nào). */
    private String deptCode;

    /** Mã chức danh áp dụng cho dept này. Empty = mọi chức danh. */
    @Builder.Default
    private List<String> positionCodes = new ArrayList<>();
}
