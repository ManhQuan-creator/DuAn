package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "SUGGESTED_CATEGORY")
@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
public class SuggestedCategoryEntity extends AbstractAuditingTimeEntity {
    @Id
    @SequenceGenerator(
            name = "SUGGESTED_CATEGORY_SEQ",
            sequenceName = "SUGGESTED_CATEGORY_SEQ",
            allocationSize = 1,
            initialValue = 1000
    )
    @GeneratedValue(
            strategy = GenerationType.SEQUENCE,
            generator = "SUGGESTED_CATEGORY_SEQ"
    )
    private Long id;

    @Column(name = "UNIT_NAME")
    private String unitName;

    @Column(name = "CATEGORY_NAME")
    private String categoryName;

    @Column(name = "CATEGORY_CODE", length = 50)
    private String categoryCode;

    @Column(name = "YEAR_PLAN", length = 10)
    private String yearPlan;

    @Column(name = "ESTIMATED_VALUE")
    private String estimatedValue;

    @Column(name = "STATUS", length = 10)
    private String status;

}
