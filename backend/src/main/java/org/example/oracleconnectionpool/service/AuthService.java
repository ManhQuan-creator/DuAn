package org.example.oracleconnectionpool.service;

import lombok.RequiredArgsConstructor;

import org.example.oracleconnectionpool.model.request.auth.LoginRequest;
import org.example.oracleconnectionpool.model.response.LoginResponse;
import org.example.oracleconnectionpool.model.response.UserResponse;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.example.oracleconnectionpool.security.JwtTokenProvider;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;

    public LoginResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );

        AppUserDetails userDetails = (AppUserDetails) authentication.getPrincipal();
        String token = jwtTokenProvider.generateToken(userDetails);

        List<String> roles = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();

        return LoginResponse.builder()
                .token(token)
                .username(userDetails.getUsername())
                .fullName(userDetails.getFullName())
                .orgGroupCode(userDetails.getOrgGroupCode())
                .companyCode(userDetails.getCompanyCode())
                .deptCode(userDetails.getDeptCode())
                .positionCode(userDetails.getPositionCode())
                .roles(roles)
                .build();
    }

    public UserResponse getCurrentUser(AppUserDetails userDetails) {
        return UserResponse.builder()
                .id(userDetails.getId())
                .username(userDetails.getUsername())
                .fullName(userDetails.getFullName())
                .orgGroupCode(userDetails.getOrgGroupCode())
                .companyCode(userDetails.getCompanyCode())
                .deptCode(userDetails.getDeptCode())
                .positionCode(userDetails.getPositionCode())
                .roles(userDetails.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .toList())
                .build();
    }
}
