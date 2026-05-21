package org.example.oracleconnectionpool.model.response.comment;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class UserCommentDTO {
    private Long id;
    private String username;
    private String fullName;
    private String orgGroupCode;
    private String companyCode;
    private String deptCode;
    private String positionCode;
}
