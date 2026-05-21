package org.example.oracleconnectionpool.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.request.auth.LoginRequest;
import org.example.oracleconnectionpool.model.response.LoginResponse;
import org.example.oracleconnectionpool.model.response.UserResponse;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.example.oracleconnectionpool.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(Api.V1.AUTH)
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<ResponseData<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request);
        return ResponseEntity.ok(new ResponseData<LoginResponse>().success(
                response));
    }

    @GetMapping("/me")
    public ResponseEntity<ResponseData<UserResponse>> getCurrentUser(
            @AuthenticationPrincipal AppUserDetails userDetails) {
        UserResponse response = authService.getCurrentUser(userDetails);
        return ResponseEntity.ok(new ResponseData<UserResponse>().success(response));
    }
}
