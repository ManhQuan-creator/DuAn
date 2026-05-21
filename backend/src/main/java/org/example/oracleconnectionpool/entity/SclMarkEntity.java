package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "SCL_MARK_CHI")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SclMarkEntity extends AbstractAuditingTimeEntity {
    @Id
    @SequenceGenerator(
            name = "SCL_MARK_SEQ",
            sequenceName = "SCL_MARK_SEQ",
            allocationSize = 1,
            initialValue = 1000
    )
    @GeneratedValue(
            strategy = GenerationType.SEQUENCE,
            generator = "SCL_MARK_SEQ"
    )
    private Long id;

    @Column(name = "SCL_CATEGORY_ID")
    private Long sclCategoryId; // Id hạng mục SCL

    @Column(name = "ASSET_CODE")
    private String assetCode; // Id tai san

    @Column(name = "ASSET_NAME")
    private Long assetName; // Tên tai san

    @Column(name = "EQUIPMENT_BEFORE_SCL")
    private String equipmentBeforeScl; // Trước SCL

    @Column(name = "EQUIPMENT_AFTER_SCL")
    private String equipmentAfterScl; // Sau SCL
}
