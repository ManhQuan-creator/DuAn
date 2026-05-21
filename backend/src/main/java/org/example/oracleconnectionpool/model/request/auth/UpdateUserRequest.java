package org.example.oracleconnectionpool.model.request.auth;

import lombok.Data;

import java.util.List;

@Data
public class UpdateUserRequest {
    private String fullName;
    private String email;
    private String phone;
    /** EVNNPC | PC_COMPANY */
    private String orgGroupCode;
    /** PCND | PCBN | ... */
    private String companyCode;
    /** BAN_KH | PHONG_KH | null */
    private String deptCode;
    private String positionCode;
    private String password;
    private Boolean active;
    private List<String> roleCodes;
}
