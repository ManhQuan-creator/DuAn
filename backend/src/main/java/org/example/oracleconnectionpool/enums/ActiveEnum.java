package org.example.oracleconnectionpool.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public enum ActiveEnum {
    NO_ACTIVE("0", "Không hoạt động"),
    ACTIVE("1", "Hoạt động");

    private final String key;
    private final String value;
}
