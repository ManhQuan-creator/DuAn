package org.example.oracleconnectionpool.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.entity.GridDataEntry;
import org.example.oracleconnectionpool.entity.GridTemplate;
import org.example.oracleconnectionpool.model.request.gridtemplate.LookupRequest;
import org.example.oracleconnectionpool.model.response.LookupResponse;
import org.example.oracleconnectionpool.repository.GridDataEntryRepository;
import org.example.oracleconnectionpool.repository.GridTemplateRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DataLookupService {

    private final GridDataEntryRepository entryRepository;
    private final GridTemplateRepository templateRepository;
    private final ObjectMapper objectMapper;

    private static final TypeReference<List<Map<String, Object>>> ROW_DATA_TYPE =
            new TypeReference<>() {};

    public LookupResponse lookup(LookupRequest request) {
        // Check template existence trước — phân biệt "mã sai" với "chưa có entry" cho FE.
        Optional<GridTemplate> templateOpt = templateRepository.findByCode(request.getTemplateCode());

        if (templateOpt.isEmpty()) {
            return LookupResponse.builder()
                    .templateCode(request.getTemplateCode())
                    .year(request.getYear())
                    .month(request.getMonth())
                    .orgCode(request.getOrgCode())
                    .rows(Collections.emptyList())
                    .templateExists(false)
                    .build();
        }

        // Parse template's columnConfigs để biết schema thật của template. Nếu column nằm
        // trong schema → luôn project (null nếu rowData JSON cũ chưa có key đó). Nếu không
        // có trong schema → skip (FE trả `#NOCOL!`). Tránh trường hợp column được thêm sau
        // khi rowData đã save → key thiếu trong JSON cũ → FE báo `#NOCOL!` nhầm.
        Set<String> templateFields = parseTemplateFields(templateOpt.get());

        Optional<GridDataEntry> entryOpt = entryRepository.findByTemplateCodeAndPeriod(
                request.getTemplateCode(),
                request.getYear(),
                request.getMonth(),
                request.getOrgCode());

        if (entryOpt.isEmpty()) {
            return LookupResponse.builder()
                    .templateCode(request.getTemplateCode())
                    .year(request.getYear())
                    .month(request.getMonth())
                    .orgCode(request.getOrgCode())
                    .rows(Collections.emptyList())
                    .templateExists(true)
                    .build();
        }

        List<Map<String, Object>> rows = parseAndProject(
                entryOpt.get().getRowData(),
                request.getRowCode(),
                request.getColumns(),
                templateFields);

        return LookupResponse.builder()
                .templateCode(request.getTemplateCode())
                .year(request.getYear())
                .month(request.getMonth())
                .orgCode(request.getOrgCode())
                .rows(rows)
                .templateExists(true)
                .build();
    }

    public List<LookupResponse> batchLookup(List<LookupRequest> requests) {
        return requests.stream()
                .map(this::lookup)
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> parseAndProject(String rowDataJson,
                                                       String rowCode,
                                                       List<String> columns,
                                                       Set<String> templateFields) {
        if (rowDataJson == null || rowDataJson.isBlank()) {
            return Collections.emptyList();
        }

        try {
            List<Map<String, Object>> allRows = objectMapper.readValue(rowDataJson, ROW_DATA_TYPE);

            return allRows.stream()
                    .filter(row -> rowCode == null || rowCode.equals(row.get("row_code")))
                    .map(row -> projectColumns(row, columns, templateFields))
                    .collect(Collectors.toList());

        } catch (Exception e) {
            log.error("Failed to parse rowData JSON for lookup", e);
            return Collections.emptyList();
        }
    }

    private Map<String, Object> projectColumns(Map<String, Object> row,
                                                List<String> columns,
                                                Set<String> templateFields) {
        Map<String, Object> projected = new LinkedHashMap<>();
        projected.put("row_code", row.get("row_code"));
        for (String col : columns) {
            // Column trong schema → project kể cả khi row JSON không có key (đặt null).
            // FE chỉ raise `#NOCOL!` khi key vắng mặt → cần present để eval ra số 0.
            // templateFields rỗng (parse fail) → permissive: project hết (giữ behavior hiện tại
            // không tệ hơn pre-fix; tránh false `#NOCOL!` khi template config corrupt).
            boolean inSchema = templateFields.isEmpty() || templateFields.contains(col);
            if (inSchema) {
                projected.put(col, row.get(col));
            }
        }
        return projected;
    }

    /**
     * Parse `columnConfigs` JSON của template thành Set field names. Trả empty Set nếu config
     * null/blank/parse fail — caller phải interpret empty là "permissive mode" (project hết).
     */
    private Set<String> parseTemplateFields(GridTemplate template) {
        String json = template.getColumnConfigs();
        if (json == null || json.isBlank()) return Collections.emptySet();
        try {
            List<Map<String, Object>> configs = objectMapper.readValue(json, ROW_DATA_TYPE);
            Set<String> fields = new HashSet<>();
            for (Map<String, Object> c : configs) {
                Object f = c.get("field");
                if (f instanceof String s && !s.isBlank()) fields.add(s);
            }
            return fields;
        } catch (Exception e) {
            log.warn("Failed to parse columnConfigs for template {} — fallback permissive mode",
                    template.getCode(), e);
            return Collections.emptySet();
        }
    }
}
