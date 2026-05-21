package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AppUserRepository extends JpaRepository<AppUser, Long>, JpaSpecificationExecutor<AppUser> {
    Optional<AppUser> findByUsername(String username);
    boolean existsByUsername(String username);
    List<AppUser> findByRoles_RoleCode(String roleCode);
    /** Tìm user theo orgGroupCode + active (dùng gửi noti broadcast cho PC_COMPANY). */
    List<AppUser> findByOrgGroupCodeAndActiveTrue(String orgGroupCode);

    /** Tìm user theo orgGroupCode + deptCode + active (dùng gửi noti cho các ban) */
    @Query(value = """
        SELECT *
        FROM app_user u
        WHERE u.ORG_GROUP_CODE = :orgGroupCode
          AND u.DEPT_CODE IN (:deptCodes)
          AND u.ACTIVE = '1'
    """, nativeQuery = true)
    List<AppUser> findByOrgGroupCodeAndDeptCode(String orgGroupCode, List<String> deptCodes);

    /**
     * Find active usernames by deptCode/positionCode filters.
     * - If deptCodes is null/empty: ignore deptCode condition.
     * - If positionCodes is null/empty: ignore positionCode condition.
     */
    @Query("""
            select u.username
            from AppUser u
            where u.active = true
              and (:deptCode is null or upper(coalesce(u.deptCode, '')) = upper(:deptCode))
              and (:positionCode is null or upper(coalesce(u.positionCode, '')) = upper(:positionCode))
            """)
    List<String> findActiveUsernamesForNotification(
            @Param("deptCode") String deptCode,
            @Param("positionCode") String positionCode
    );
}
