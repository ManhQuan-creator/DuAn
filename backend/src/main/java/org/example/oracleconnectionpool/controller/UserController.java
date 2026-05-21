package org.example.oracleconnectionpool.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.request.appuser.FilterAppUserRequest;
import org.example.oracleconnectionpool.model.request.auth.CreateUserRequest;
import org.example.oracleconnectionpool.model.request.auth.UpdateUserRequest;
import org.example.oracleconnectionpool.model.response.UserResponse;
import org.example.oracleconnectionpool.service.UserService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping(Api.V1.USERS)
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping("/search")
    public ResponseEntity<ResponseData<Page<UserResponse>>> searchUsers(
            @RequestBody() FilterAppUserRequest request) {
        return ResponseEntity.ok(new ResponseData<Page<UserResponse>>().success(userService.searchUsers(request)));
    }

    @GetMapping
    public ResponseEntity<ResponseData<List<UserResponse>>> getAllUsers() {
        return ResponseEntity.ok(new ResponseData<List<UserResponse>>().success(userService.getAllUsers()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResponseData<UserResponse>> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(new ResponseData<UserResponse>().success(userService.getUserById(id)));
    }

    @PostMapping
    public ResponseEntity<ResponseData<UserResponse>> createUser(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.ok(new ResponseData<UserResponse>().success(userService.createUser(request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ResponseData<UserResponse>> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(new ResponseData<UserResponse>().success(userService.updateUser(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseData<Void>> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(new ResponseData<Void>().success());
    }
}
