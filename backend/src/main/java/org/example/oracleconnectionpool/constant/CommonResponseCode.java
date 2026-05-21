package org.example.oracleconnectionpool.constant;

import lombok.Generated;

public enum CommonResponseCode implements ICommonResponseCode {
    SUCCESS("0", "common.success"),
    SOA_EXCEPTION("100", "common.soa.exception"),
    SOA_TIMEOUT_OR_NO_RESULT("101", "common.soa.timeout-or-no-result"),
    SOA_CONNECTION_ERROR("102", "common.soa.connection.error"),
    SOA_GEN_MSG_ERROR("103", "common.soa.gen-msg.error"),
    SOA_PARSE_MSG_ERROR("104", "common.soa.parse-msg.error"),
    VALIDATE_ERROR("105", "common.validate.error"),
    USER_NOT_FOUND("106", "common.user.not-found"),
    UNAUTHENTICATED("107", "common.unauthenticated"),
    ACCESS_DENIED("108", "common.access-denied"),
    OPERATION_NOT_SUPPORT("109", "common.operation.not-support"),
    RESOURCE_NOT_FOUND("110", "common.resource.not-found"),
    RESULT_EMPTY("111", "common.result.empty"),
    EXPORT_ERROR("112", "common.export.error"),
    FIELD_TYPE_NOT_SUPPORT("113", "common.field-type.not-support"),
    CASTING_TYPE_NOT_SUPPORT("114", "common.casting-type.not-support"),
    NOT_EXISTED("500", "common.not-existed"),
    INTERNAL_ERROR("500", "common.internal-error");

    private final String code;
    private final String messageKey;

    @Generated
    public String getCode() {
        return this.code;
    }

    @Generated
    public String getMessageKey() {
        return this.messageKey;
    }

    @Generated
    private CommonResponseCode(final String code, final String messageKey) {
        this.code = code;
        this.messageKey = messageKey;
    }
}
