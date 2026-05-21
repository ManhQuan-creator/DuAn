package org.example.oracleconnectionpool.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.camunda.bpm.engine.IdentityService;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Bridge filter: propagates Spring Security authenticated user to Camunda IdentityService.
 * Must be placed AFTER JwtAuthenticationFilter in the filter chain.
 *
 * Uses @Lazy on IdentityService because the Camunda engine may not be fully
 * initialized when Spring Security filter chain is being constructed.
 */
@Component
public class CamundaAuthenticationFilter extends OncePerRequestFilter {

    private final IdentityService identityService;

    public CamundaAuthenticationFilter(@Lazy IdentityService identityService) {
        this.identityService = identityService;
    }

    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        try {
            if (authentication != null && authentication.isAuthenticated()) {
                identityService.setAuthenticatedUserId(authentication.getName());
            }
            filterChain.doFilter(request, response);
        } finally {
            identityService.clearAuthentication();
        }
    }
}
