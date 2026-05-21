package org.example.oracleconnectionpool.model.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class LookupResponse {
    private String templateCode;
    private Integer year;
    private Integer month;
    private String orgCode;
    private List<Map<String, Object>> rows;
    /**
     * True nếu templateCode tồn tại trong DB (`grid_template`). False khi user truyền sai mã
     * báo cáo trong GETDATA/LOOKUP — FE phân biệt `#NOTEMPLATE!` vs `#NODATA!`.
     * `rows` empty + `templateExists=true` → mã đúng nhưng chưa có entry cho year/month/orgCode.
     */
    private Boolean templateExists;
}
