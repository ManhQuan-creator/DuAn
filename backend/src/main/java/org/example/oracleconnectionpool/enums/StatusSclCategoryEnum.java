package org.example.oracleconnectionpool.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public enum StatusSclCategoryEnum implements BaseEnum<String> {
    CHUA_GUI_THAM_DINH("CHUA_GUI_THAM_DINH", "Chưa gửi thẩm định"),
    DA_GUI_TD("DA_GUI_TD", "Đã gửi thẩm định"),
    DA_DUYET_TD("DA_DUYET_TD", "Đã duyệt thẩm định"),
    GUI_LD_DUYET("GUI_LD_DUYET", "Gửi LĐ duyệt"),
    LD_DA_THONG_QUA("LD_DA_THONG_QUA", "LĐ đã thông qua"),
    TU_CHOI_DUYET_TD("TU_CHOI_DUYET_TD", "Đã từ chối duyệt thẩm định"),
    DIEU_CHINH_TD("DIEU_CHINH_TD", "Điều chỉnh thẩm định"),

    DA_THAM_DINH("DA_THAM_DINH", "Đã được thẩm định"),
    CAN_HIEU_CHINH("CAN_HIEU_CHINH", "Cần hiệu chỉnh");

    private final String key;
    private final String value;

    public static StatusSclCategoryEnum fromKey(String key) {
        for (StatusSclCategoryEnum e : values()) {
            if (e.key.equals(key)) {
                return e;
            }
        }
        return null;
    }
}
