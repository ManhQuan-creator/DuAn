package org.example.oracleconnectionpool.model.request.templateaccess;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.example.oracleconnectionpool.model.base.PageAndOrderRequest;

@Data
@EqualsAndHashCode(callSuper = true)
@AllArgsConstructor
@NoArgsConstructor
public class SearchTemplateAccessRequest extends PageAndOrderRequest {
    /** null = tất cả templates */
    private Long templateId;
    /** tìm trong actionKey, subjectOrgCode, subjectPositionCode */
    private String keyword;
}
