package org.example.oracleconnectionpool.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public enum StatusSclAssessmentEnum implements BaseEnum<String> {
    DONG_Y_TD("DONG_Y_TD", "Đồng ý hạng mục thẩm định"),
    TU_CHOI_TD("TU_CHOI_TD", "Từ chối hạng mục thẩm định"),
    CAN_HIEU_CHINH("CAN_HIEU_CHINH", "Cần hiệu chỉnh"),

//    DA_THAM_DINH("DA_THAM_DINH","Đã thẩm định"),
//    CHUA_THAM_DINH("CHUA_THAM_DINH","Chưa thẩm định"),

    DA_GUI_TD("DA_GUI_TD", "Đã gửi thẩm định");

    private final String key;
    private final String value;

    public static StatusSclAssessmentEnum fromKey(String key) {
        for (StatusSclAssessmentEnum e : values()) {
            if (e.key.equals(key)) {
                return e;
            }
        }
        return null;
    }
}
