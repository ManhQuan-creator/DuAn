package org.example.oracleconnectionpool.config;

import java.util.List;
import java.util.stream.Collectors;

import org.example.oracleconnectionpool.constant.CommonResponseCode;
import org.example.oracleconnectionpool.exceptions.ForbiddenException;
import org.example.oracleconnectionpool.exceptions.NotFoundException;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.base.ValidateError;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ResponseData<Void>> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ResponseData<>(
                        CommonResponseCode.UNAUTHENTICATED.getCode(),
                        "Sai tên đăng nhập hoặc mật khẩu"
                ));
    }

    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<ResponseData<Void>> handleDisabled(DisabledException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ResponseData<>(
                        CommonResponseCode.ACCESS_DENIED.getCode(),
                        "Tài khoản đã bị vô hiệu hóa"
                ));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ResponseData<Void>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ResponseData<>(
                        CommonResponseCode.ACCESS_DENIED.getCode(),
                        "Bạn không có quyền truy cập"
                ));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ResponseData<Void>> handleAuthentication(AuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ResponseData<>(
                        CommonResponseCode.UNAUTHENTICATED.getCode(),
                        "Chưa xác thực"
                ));
    }

    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<ResponseData<Void>> handleResponseStatus(org.springframework.web.server.ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode())
                .body(new ResponseData<>(
                        String.valueOf(ex.getStatusCode().value()),
                        ex.getReason() != null ? ex.getReason() : ex.getMessage()
                ));
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ResponseData<Void>> handleNotFoundException(NotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ResponseData<>(
                        CommonResponseCode.RESOURCE_NOT_FOUND.getCode(),
                        ex.getMessage()
                ));
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ResponseData<Void>> handleForbiddenException(ForbiddenException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ResponseData<>(
                        CommonResponseCode.ACCESS_DENIED.getCode(),
                        ex.getMessage()
                ));
    }


    @ExceptionHandler(org.springframework.web.bind.MethodArgumentNotValidException.class)
    public ResponseEntity<ResponseData<List<ValidateError>>> handleValidationException(org.springframework.web.bind.MethodArgumentNotValidException ex) {
        List<ValidateError> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> new ValidateError(error.getField(), error.getDefaultMessage()))
                .collect(Collectors.toList());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ResponseData<>(
                        CommonResponseCode.VALIDATE_ERROR.getCode(),
                        errors.stream().map(ValidateError::getFieldError).collect(Collectors.joining("; "))
                ));
    }
    
    @ExceptionHandler(Exception.class)
public ResponseEntity<ResponseData<Void>> handleException(
        Exception ex,
        jakarta.servlet.http.HttpServletResponse response) {

    // Client đã disconnect (SSE / async đã commit response) — không thể ghi tiếp.
    // Log debug + return null để Spring không cố write body.
    if (response.isCommitted()
            || MediaType.TEXT_EVENT_STREAM_VALUE.equals(response.getContentType())) {
        LoggerFactory.getLogger(this.getClass()).debug("Client disconnected during async response: {}", ex.getMessage());
        return null;
    }

    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ResponseData<>("500", ex.getMessage()));
}
}
