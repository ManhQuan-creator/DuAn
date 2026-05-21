package org.example.oracleconnectionpool.constant;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public enum DateFormatEnum {
    DD_MM_YYYY("dd/MM/yyyy"),
    DD_MM_YYYY_HH_MM_SS("dd/MM/yyyy HH:mm:ss");

    private final String value;
}
