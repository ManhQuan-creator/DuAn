package org.example.oracleconnectionpool.model.request.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class CreateUserRequest {
    @NotBlank
    private String username;
    @NotBlank
    private String password;
    private String fullName;
    private String email;
    private String phone;
    /** EVNNPC | PC_COMPANY */
    private String orgGroupCode;
    /** PCND | PCBN | ... (chỉ cần cho PC_COMPANY users) */
    private String companyCode;
    /** BAN_KH | PHONG_KH | null */
    private String deptCode;
    private String positionCode;
    private List<String> roleCodes;
}
