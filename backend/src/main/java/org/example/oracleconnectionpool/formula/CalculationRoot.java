package org.example.oracleconnectionpool.formula;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;

public class CalculationRoot {
    private final DataRepository dataRepository;
    private final int currentYear;

    public CalculationRoot(DataRepository dataRepository, int currentYear) {
        this.dataRepository = dataRepository;
        this.currentYear = currentYear;
    }

    // --- CÁC HÀM THEO MÔ TẢ ---

    // CP("xxx"): Current Period
    public BigDecimal CP(String code) {
        return dataRepository.getValue(code, currentYear);
    }

    // PP("xxx"): Previous Period (Năm T-1)
    public BigDecimal PP(String code) {
        return dataRepository.getValue(code, currentYear - 1);
    }

    // PPP("xxx"): Previous Previous Period (Năm T-2)
    public BigDecimal PPP(String code) {
        return dataRepository.getValue(code, currentYear - 2);
    }

    // NVL(x, y): Nếu x null trả về y
    public BigDecimal NVL(BigDecimal value, BigDecimal defaultValue) {
        return value != null ? value : defaultValue;
    }

    // ROUND(x, n): Làm tròn
    public BigDecimal ROUND(BigDecimal value, int scale) {
        if (value == null) return BigDecimal.ZERO;
        return value.setScale(scale, RoundingMode.HALF_UP);
    }

    // TRUNC(x, n): Cắt số
    public BigDecimal TRUNC(BigDecimal value, int scale) {
        if (value == null) return BigDecimal.ZERO;
        return value.setScale(scale, RoundingMode.DOWN);
    }

    // ABS(x): Giá trị tuyệt đối
    public BigDecimal ABS(BigDecimal value) {
        if (value == null) return BigDecimal.ZERO;
        return value.abs();
    }

    // StatementDays(): Số ngày trong năm (365 hoặc 366)
    public int StatementDays() {
        return Year.of(currentYear).isLeap() ? 366 : 365;
    }
}