package org.example.oracleconnectionpool.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public enum DeptEnum implements BaseEnum<String> {

    BAN_KH("BAN_KH","Ban kế hoạch");

    private final String key;
    private final String value;

    public static DeptEnum fromKey(String key) {
        for (DeptEnum e : values()) {
            if (e.key.equals(key)) {
                return e;
            }
        }
        return null;
    }
}
