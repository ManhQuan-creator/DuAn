package org.example.oracleconnectionpool.service;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.entity.AppRole;
import org.example.oracleconnectionpool.entity.AppUser;
import org.example.oracleconnectionpool.model.request.appuser.FilterAppUserRequest;
import org.example.oracleconnectionpool.model.request.auth.CreateUserRequest;
import org.example.oracleconnectionpool.model.request.auth.UpdateUserRequest;
import org.example.oracleconnectionpool.model.response.UserResponse;
import org.example.oracleconnectionpool.repository.AppRoleRepository;
import org.example.oracleconnectionpool.repository.AppUserRepository;
import org.example.oracleconnectionpool.repository.OrganizationRepository;
import org.example.oracleconnectionpool.repository.PcCompanyRepository;
import org.example.oracleconnectionpool.repository.PositionRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class UserService {

    private final AppUserRepository appUserRepository;
    private final AppRoleRepository appRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final PcCompanyRepository pcCompanyRepository;
    private final OrganizationRepository organizationRepository;
    private final PositionRepository positionRepository;

    public Page<UserResponse> searchUsers(FilterAppUserRequest request) {
        Specification<AppUser> spec = buildSpec(request);
        Pageable pageable = PageRequest.of(request.getPageNum(), request.getPageSize(), Sort.by("updatedAt").descending());
        return appUserRepository.findAll(spec, pageable)
                .map(this::toResponse);
    }
    private Specification<AppUser> buildSpec(FilterAppUserRequest request) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Keyword: LIKE trên tất cả field String
            String keyword = request.getKeyword();
            if (keyword != null && !keyword.isBlank()) {
                String pattern = "%" + keyword.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("username")), pattern),
                        cb.like(cb.lower(root.get("fullName")), pattern),
                        cb.like(cb.lower(root.get("email")), pattern),
                        cb.like(cb.lower(root.get("phone")), pattern),
                        cb.like(cb.lower(root.get("orgGroupCode")), pattern),
                        cb.like(cb.lower(root.get("companyCode")), pattern),
                        cb.like(cb.lower(root.get("deptCode")), pattern),
                        cb.like(cb.lower(root.get("positionCode")), pattern)
                ));
            }

            // Exact filters
            if (request.getActive() != null) {
                predicates.add(cb.equal(root.get("active"), request.getActive()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    public List<UserResponse> getAllUsers() {
        return appUserRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    public UserResponse getUserById(Long id) {
        AppUser user = appUserRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng với ID: " + id));
        return toResponse(user);
    }

    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        if (appUserRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("Tên đăng nhập đã tồn tại: " + request.getUsername());
        }

        AppUser user = AppUser.builder()
                .username(request.getUsername())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .orgGroupCode(request.getOrgGroupCode())
                .companyCode(request.getCompanyCode())
                .deptCode(request.getDeptCode())
                .positionCode(request.getPositionCode())
                .active(true)
                .roles(resolveRoles(request.getRoleCodes()))
                .build();

        return toResponse(appUserRepository.save(user));
    }

    @Transactional
    public UserResponse updateUser(Long id, UpdateUserRequest request) {
        AppUser user = appUserRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng với ID: " + id));

        if (request.getFullName()     != null) user.setFullName(request.getFullName());
        if (request.getEmail()        != null) user.setEmail(request.getEmail());
        if (request.getPhone()        != null) user.setPhone(request.getPhone());
        if (request.getOrgGroupCode() != null) user.setOrgGroupCode(request.getOrgGroupCode());
        if (request.getCompanyCode()  != null) user.setCompanyCode(request.getCompanyCode());
        if (request.getDeptCode()     != null) user.setDeptCode(request.getDeptCode());
        if (request.getPositionCode() != null) user.setPositionCode(request.getPositionCode());
        if (request.getActive()       != null) user.setActive(request.getActive());
        if (StringUtils.hasText(request.getPassword())) {
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }
        if (request.getRoleCodes() != null) {
            user.setRoles(resolveRoles(request.getRoleCodes()));
        }

        return toResponse(appUserRepository.save(user));
    }

    @Transactional
    public void deleteUser(Long id) {
        AppUser user = appUserRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng với ID: " + id));
        user.setActive(false);
        appUserRepository.save(user);
    }

    private Set<AppRole> resolveRoles(List<String> roleCodes) {
        Set<AppRole> roles = new HashSet<>();
        if (roleCodes != null) {
            for (String code : roleCodes) {
                appRoleRepository.findByRoleCode(code).ifPresent(roles::add);
            }
        }
        return roles;
    }

    private UserResponse toResponse(AppUser user) {
        String companyName = user.getCompanyCode() == null ? null :
                pcCompanyRepository.findById(user.getCompanyCode())
                        .map(c -> c.getCompanyName())
                        .orElse(null);

        String deptName = user.getDeptCode() == null ? null :
                organizationRepository.findByOrgCode(user.getDeptCode())
                        .map(o -> o.getOrgName())
                        .orElse(null);

        String positionName = user.getPositionCode() == null ? null :
                positionRepository.findByPositionCode(user.getPositionCode())
                        .map(p -> p.getPositionName())
                        .orElse(null);

        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .orgGroupCode(user.getOrgGroupCode())
                .companyCode(user.getCompanyCode())
                .companyName(companyName)
                .deptCode(user.getDeptCode())
                .deptName(deptName)
                .positionCode(user.getPositionCode())
                .positionName(positionName)
                .active(user.getActive())
                .roles(user.getRoles().stream()
                        .map(AppRole::getRoleCode)
                        .toList())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
