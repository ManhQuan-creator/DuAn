package org.example.oracleconnectionpool.model.response;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginResponse {
    private String token;
    private String username;
    private String fullName;
    /** EVNNPC | PC_COMPANY — dùng cho phân quyền UI */
    private String orgGroupCode;
    /** PCND | PCBN | ... — dùng để auto-fill form tạo entry */
    private String companyCode;
    private String deptCode;
    private String positionCode;
    private List<String> roles;
}
