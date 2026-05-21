package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;
import org.example.oracleconnectionpool.constant.EntryStatus;

import java.time.LocalDateTime;

@Entity
@Table(name = "GRID_DATA_ENTRY", uniqueConstraints = {
    @UniqueConstraint(name = "UQ_ENTRY_PERIOD", columnNames = {"TEMPLATE_ID", "ORG_CODE", "YEAR_VAL", "MONTH_VAL"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GridDataEntry extends AbstractAuditingUserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Long id;

    @Column(name = "TEMPLATE_ID", nullable = false)
    private Long templateId;

    @Column(name = "ENTRY_CODE", nullable = false, length = 50)
    private String entryCode;

    @Column(name = "ENTRY_NAME", length = 200)
    private String entryName;

    @Column(name = "ORG_CODE", length = 50)
    private String orgCode;

    @Column(name = "YEAR_VAL", nullable = false)
    private Integer year;

    @Column(name = "MONTH_VAL")
    private Integer month;

    /**
     * JSON array snapshot of all rows + values + cellConfig at entry creation
     * time (BE clones from template). Custom rows added by NSD during data entry
     * live INSIDE this array with flag {@code _isCustomRow=true} (V10 merged
     * the legacy CUSTOM_ROWS column into this snapshot). Order = visual index.
     */
    @Column(name = "ROW_DATA", columnDefinition = "CLOB")
    private String rowData;

    @Column(name = "STATUS", length = 30)
    @Builder.Default
    private String status = EntryStatus.DRAFT;

    @Column(name = "PROCESS_INSTANCE_ID", length = 64)
    private String processInstanceId;

    @Column(name = "SUBMITTED_BY", length = 50)
    private String submittedBy;

    @Column(name = "SUBMITTED_AT")
    private LocalDateTime submittedAt;

    /**
     * Hạn xử lý phiên nhập liệu — người tạo phiên set khi tạo entry.
     * NSD nhập liệu thấy badge ở header với màu cảnh báo theo còn bao nhiêu ngày tới hạn.
     */
    @Column(name = "DUE_DATE")
    private LocalDateTime dueDate;
}
