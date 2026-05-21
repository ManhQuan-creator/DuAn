package org.example.oracleconnectionpool.model.base;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import org.example.oracleconnectionpool.constant.CommonResponseCode;

import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@Builder
public class ResponseData<T> {
    private String              code;
    private String              message;
    private List<ValidateError> errors;
    private String              traceId;
    private String              responseTime;
    private T                   data;

    public ResponseData(String code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public ResponseData(String code, String message) {
        this.code = code;
        this.message = message;
    }

    @JsonIgnore
    public boolean isSuccess() {
        return CommonResponseCode.SUCCESS.getCode().equals(this.code);
    }

    public ResponseData<Void> success() {
        return new ResponseData<>(CommonResponseCode.SUCCESS.getCode(), CommonResponseCode.SUCCESS.getMessageKey());
    }

    public ResponseData<T> success(T data) {
        return new ResponseData<>(CommonResponseCode.SUCCESS.getCode(), CommonResponseCode.SUCCESS.getMessageKey(), data);
    }

    public ResponseData<Void> error() {
        return new ResponseData<>(code, message);
    }
}
