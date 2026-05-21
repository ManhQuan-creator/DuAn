package org.example.oracleconnectionpool.model.request.templateaccess;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateTemplateAccessRequest {

    @NotNull
    private Long templateId;

    /** VIEW | EDIT | SUBMIT | APPROVE:1 | APPROVE:2 | ... | <button_key> */
    @NotBlank
    private String actionKey;

    /**
     * Mã ban/phòng từ ORGANIZATION.orgCode.
     * VD: BAN_KH, PHONG_KH — null = tất cả ban/phòng.
     */
    private String subjectOrgCode;

    /**
     * Mã chức danh từ POSITION.positionCode.
     * VD: TGD, CHUYEN_VIEN_PHONG — null = tất cả chức danh.
     */
    private String subjectPositionCode;
}
