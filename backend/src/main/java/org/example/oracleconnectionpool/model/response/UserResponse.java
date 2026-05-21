package org.example.oracleconnectionpool.model.response;

import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserResponse {
    private Long id;
    private String username;
    private String fullName;
    private String email;
    private String phone;
    /** EVNNPC | PC_COMPANY */
    private String orgGroupCode;
    /** PCND | PCBN | ... */
    private String companyCode;
    /** Tên công ty điện lực thành viên */
    private String companyName;
    /** BAN_KH | PHONG_KH | null */
    private String deptCode;
    /** Tên ban/phòng */
    private String deptName;
    private String positionCode;
    /** Tên chức danh */
    private String positionName;
    private Boolean active;
    private List<String> roles;
    private LocalDateTime createdAt;
}
