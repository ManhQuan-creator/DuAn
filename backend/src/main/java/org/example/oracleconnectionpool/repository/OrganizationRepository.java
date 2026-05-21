package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.Organization;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrganizationRepository extends JpaRepository<Organization, Long> {

    Optional<Organization> findByOrgCode(String orgCode);

    List<Organization> findByOrgLevel(String orgLevel);

    List<Organization> findByActiveTrue();

    boolean existsByOrgCode(String orgCode);

    List<Organization> findAllByOrderByOrgCodeAsc();

    @Query("SELECT o FROM Organization o WHERE " +
           "(:keyword IS NULL OR LOWER(o.orgCode) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(o.orgName) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "AND (:active IS NULL OR o.active = :active) " +
           "ORDER BY o.orgCode ASC")
    Page<Organization> searchOrganizations(@Param("keyword") String keyword,
                                           @Param("active") Boolean active,
                                           Pageable pageable);
}
