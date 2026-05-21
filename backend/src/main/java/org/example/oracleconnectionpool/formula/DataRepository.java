package org.example.oracleconnectionpool.formula;

import java.math.BigDecimal;

public interface DataRepository {
    // Lấy giá trị chỉ tiêu theo Mã và Năm
    BigDecimal getValue(String indicatorCode, int year);
}