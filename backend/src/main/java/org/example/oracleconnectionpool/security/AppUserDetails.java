package org.example.oracleconnectionpool.security;

import lombok.Getter;
import org.example.oracleconnectionpool.entity.AppUser;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.stream.Collectors;

@Getter
public class AppUserDetails implements UserDetails {

    private final Long id;
    private final String username;
    private final String password;
    private final String fullName;
    /** EVNNPC | PC_COMPANY — dùng cho phân quyền template */
    private final String orgGroupCode;
    /** PCND | PCBN | ... — dùng để auto-fill GridDataEntry.orgCode khi tạo entry */
    private final String companyCode;
    /** BAN_KH | PHONG_KH | null — ban/phòng trực thuộc */
    private final String deptCode;
    /** TGD | CHUYEN_VIEN_PHONG | ... — chức danh */
    private final String positionCode;
    private final boolean active;
    private final Collection<? extends GrantedAuthority> authorities;

    public AppUserDetails(AppUser user) {
        this.id            = user.getId();
        this.username      = user.getUsername();
        this.password      = user.getPassword();
        this.fullName      = user.getFullName();
        this.orgGroupCode  = user.getOrgGroupCode();
        this.companyCode   = user.getCompanyCode();
        this.deptCode      = user.getDeptCode();
        this.positionCode  = user.getPositionCode();
        this.active        = Boolean.TRUE.equals(user.getActive());
        this.authorities   = user.getRoles().stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.getRoleCode()))
                .collect(Collectors.toList());
    }

    @Override public boolean isAccountNonExpired()     { return true; }
    @Override public boolean isAccountNonLocked()      { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled()               { return active; }
}
