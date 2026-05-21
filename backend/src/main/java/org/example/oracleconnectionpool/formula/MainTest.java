package org.example.oracleconnectionpool.formula;

public class MainTest {
    public static void main(String[] args) {
        IndicatorCalculationService service = new IndicatorCalculationService();
        int namHienTai = 2024;

        // --- TEST CASE 1: Công thức đơn giản ---
        // (CP("2190000") * (365/StatementDays()))
        // Giả sử CP(2190000) = 1000, StatementDays = 366 (năm 2024 nhuận)
        // 1000 * (365/366) ~= 997.26
        String formula1 = "ABS(CP('2190000') * (365.0 / StatementDays()))";
        System.out.println("Kết quả 1: " + service.calculate(formula1, namHienTai));
        
        System.out.println("------------------------------------------------");

        // --- TEST CASE 2: Công thức phức tạp với NVL và PP ---
        // CP("1446500") + NVL(PP("1446500"), 0)
        // 500 + 400 = 900
        String formula2 = "CP('1446500') + NVL(PP('1446500'), 0)";
        System.out.println("Kết quả 2: " + service.calculate(formula2, namHienTai));

        System.out.println("------------------------------------------------");

        // --- TEST CASE 3: CASE WHEN ---
        // Nếu CP(1446500) > 400 thì lấy 100, ngược lại lấy 0
        String formula3 = "CASE WHEN (CASE WHEN CP('1446500') > 400 THEN 100 ELSE 0 END) > 50 THEN 1 ELSE 0 END";
        System.out.println("Kết quả 3: " + service.calculate(formula3, namHienTai));
    }
}