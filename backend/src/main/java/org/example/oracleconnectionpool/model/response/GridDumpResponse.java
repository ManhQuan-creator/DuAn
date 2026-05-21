package org.example.oracleconnectionpool.model.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Debug payload phục vụ AI/dev kiểm tra dữ liệu Excel Builder + Render.
 * Tất cả CLOB JSON (columnConfigs, columnGroups, rowData, cellConfig)
 * đã được parse thành Object/Map/List để output là JSON lồng — KHÔNG stringified.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GridDumpResponse {

    private Long entryId;
    private String entryOrgCode;
    private Integer entryYearVal;
    private Integer entryMonthVal;
    private Long templateId;
    private TemplateInfo template;
    private List<RowInfo> rows;
    private EntryInfo entry;

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TemplateInfo {
        private Long id;
        private String code;
        private String name;
        private Object columnConfigs;
        private Object columnGroups;
    }

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RowInfo {
        private Long id;
        private String rowCode;
        private String rowName;
        private Integer sortOrder;
        private Boolean isTypeHeader;
        private String catalogField;
        private Object rowData;
        private Object cellConfig;
    }

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EntryInfo {
        private Long id;
        private String entryCode;
        private String entryName;
        private String orgCode;
        private Integer year;
        private Integer month;
        private String status;
        private Object rowData;
    }
}
