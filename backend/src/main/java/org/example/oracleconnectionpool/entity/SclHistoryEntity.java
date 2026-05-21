package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "SCL_HISTORY")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SclHistoryEntity extends AbstractAuditingTimeEntity {
    @Id
    @SequenceGenerator(
            name = "SCL_HISTORY_SEQ",
            sequenceName = "SCL_HISTORY_SEQ",
            allocationSize = 1,
            initialValue = 1000
    )
    @GeneratedValue(
            strategy = GenerationType.SEQUENCE,
            generator = "SCL_HISTORY_SEQ"
    )
    private Long id;

    @Column(name = "SCL_CATEGORY_ID")
    private Long sclCategoryId; // Id hạng mục SCL

    @Column(name = "UNIT")
    private String unit; // Đơn vị

    @Column(name = "CATEGORY_NAME")
    private String categoryName; // Tên hạng mục

    @Column(name = "ASSET_TYPE")
    private String assetType; // Phân loại

    @Column(name = "YEAR_PLAN")
    private String yearPlan; // Năm kế hoạch

    @Column(name = "ACTUAL_VOLUME")
    private String actualVolume; // KL thực hiện

    @Column(name = "PROGRESS")
    private String progress; // Tiến độ

    @Column(name = "NOTE")
    private String note; // Ghi chú

    @Column(name = "MONTH")
    private String month; // Tháng
}
