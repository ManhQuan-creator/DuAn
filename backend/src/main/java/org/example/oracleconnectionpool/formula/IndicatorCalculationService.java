package org.example.oracleconnectionpool.formula;

import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;

@Service
public class IndicatorCalculationService {

    private final ExpressionParser parser = new SpelExpressionParser();

    // Giả sử DataRepository được Inject vào
    private final DataRepository dataRepository; 

    public IndicatorCalculationService() {
        // Mock data cho ví dụ này
        this.dataRepository = (code, year) -> {
            // Giả lập dữ liệu trả về từ DB
            if ("2190000".equals(code) && year == 2024) return new BigDecimal("1000");
            if ("1446500".equals(code) && year == 2024) return new BigDecimal("500");
            if ("1446500".equals(code) && year == 2023) return new BigDecimal("400"); // PP
            return null; // Không có dữ liệu
        };
    }

    public BigDecimal calculate(String rawFormula, int currentYear) {
        try {
            // 1. Chuẩn hóa công thức
            String spelFormula = FormulaTransformer.normalizeFormula(rawFormula);
            System.out.println("Original: " + rawFormula);
            System.out.println("SpEL:     " + spelFormula);

            // 2. Tạo Context
            CalculationRoot rootObject = new CalculationRoot(dataRepository, currentYear);
            StandardEvaluationContext context = new StandardEvaluationContext(rootObject);

            // 3. Parse và Tính toán
            Expression exp = parser.parseExpression(spelFormula);
            
            // Tự động ép kiểu về BigDecimal để chính xác tiền tệ
            BigDecimal result = exp.getValue(context, BigDecimal.class);
            
            return result;

        } catch (Exception e) {
            System.err.println("Lỗi tính toán công thức: " + rawFormula);
            e.printStackTrace();
            return null; // Hoặc throw custom exception
        }
    }

    
}