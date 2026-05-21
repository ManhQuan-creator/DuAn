package org.example.oracleconnectionpool.model.response;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TemplateAccessResponse {
    private Long id;
    private Long templateId;
    private String actionKey;
    /** ORGANIZATION.orgCode — null = tất cả ban/phòng */
    private String subjectOrgCode;
    /** POSITION.positionCode — null = tất cả chức danh */
    private String subjectPositionCode;
    private Boolean active;
    private String createdBy;
    private LocalDateTime createdAt;
}
