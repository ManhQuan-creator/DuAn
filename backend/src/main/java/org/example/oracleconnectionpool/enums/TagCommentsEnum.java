package org.example.oracleconnectionpool.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public enum TagCommentsEnum implements BaseEnum<String> {
    SUCCESS("SUCCESS", "Thành công"),
    WARNING("WARNING", "Cảnh báo"),
    ERROR("ERROR", "Lỗi");

    private final String key;
    private final String value;

    public static TagCommentsEnum fromKey(String key) {
        for (TagCommentsEnum e : values()) {
            if (e.key.equals(key)) {
                return e;
            }
        }
        return null;
    }
}
