package org.example.oracleconnectionpool.formula;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class FormulaTransformer {

    public static String normalizeFormula(String rawFormula) {
        if (rawFormula == null) return "";
        
        String processed = rawFormula.trim();

        // 1. Chuyển đổi CASE WHEN ... THEN ... ELSE ... END
        // Lưu ý: Regex này xử lý case đơn giản. Nếu lồng nhau phức tạp cần Parser riêng.
        // Pattern: CASE WHEN (cond) THEN (val1) ELSE (val2) END -> (cond) ? (val1) : (val2)
        Pattern caseWhenPattern = Pattern.compile("(?i)CASE\\s+WHEN\\s+(.+?)\\s+THEN\\s+(.+?)\\s+ELSE\\s+(.+?)\\s+END");
        Matcher matcher = caseWhenPattern.matcher(processed);
        while (matcher.find()) {
            String replacement = String.format("(%s ? %s : %s)", 
                matcher.group(1), matcher.group(2), matcher.group(3));
            processed = matcher.replaceFirst(replacement);
            matcher = caseWhenPattern.matcher(processed); // Reset để tìm tiếp
        }

        // 2. Xử lý logic so sánh SQL (=) thành Java (==) nếu cần
        // SpEL hỗ trợ cả '==' và 'eq', nhưng người dùng hay nhập '='
        // Cần cẩn thận không replace dấu = trong phép gán (nhưng đây là công thức tính nên ok)
        // processed = processed.replaceAll("(?<![<>!])=(?!=)", "=="); 

        return processed;
    }
}