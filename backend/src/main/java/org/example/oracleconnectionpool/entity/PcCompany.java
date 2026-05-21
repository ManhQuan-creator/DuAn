package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Công ty Điện lực thành viên trực thuộc EVNNPC.
 *
 * Tách riêng khỏi ORGANIZATION vì PC_COMPANY là "tenant" của hệ thống
 * (thực thể nộp dữ liệu), không phải đơn vị trong sơ đồ tổ chức nội bộ TCT.
 *
 * Được tham chiếu bởi:
 *   APP_USER.companyCode    → PC user thuộc công ty nào
 *   GRID_DATA_ENTRY.orgCode → entry được nộp bởi công ty nào
 */
@Entity
@Table(name = "PC_COMPANY")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PcCompany {

    /** Mã điện lực: PCND, PCBN, PCQN, ... */
    @Id
    @Column(name = "COMPANY_CODE", length = 50)
    private String companyCode;

    @Column(name = "COMPANY_NAME", nullable = false, length = 200)
    private String companyName;

    @Column(name = "ACTIVE", nullable = false)
    @Builder.Default
    private Boolean active = true;
}
