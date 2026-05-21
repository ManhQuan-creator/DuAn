package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.TemplateAccess;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TemplateAccessRepository extends JpaRepository<TemplateAccess, Long>, JpaSpecificationExecutor<TemplateAccess> {

    List<TemplateAccess> findAllByActiveTrue();

    List<TemplateAccess> findByTemplateIdAndActiveTrue(Long templateId);

    void deleteByTemplateId(Long templateId);

    /**
     * Kiểm tra user có quyền thực hiện actionKey trên template không.
     *
     * Logic: cả hai điều kiện là wildcard nếu null.
     *   (subject_org_code IS NULL OR subject_org_code = user.deptCode)
     *   AND (subject_position_code IS NULL OR subject_position_code = user.positionCode)
     */
    @Query("""
        SELECT COUNT(ta) > 0 FROM TemplateAccess ta
        WHERE ta.templateId = :templateId
          AND ta.active = true
          AND ta.actionKey = :actionKey
          AND (ta.subjectOrgCode IS NULL OR ta.subjectOrgCode = :deptCode)
          AND (ta.subjectPositionCode IS NULL OR ta.subjectPositionCode = :positionCode)
    """)
    boolean hasActionAccess(
            @Param("templateId")   Long   templateId,
            @Param("actionKey")    String actionKey,
            @Param("deptCode")     String deptCode,
            @Param("positionCode") String positionCode
    );

    /**
     * Lấy danh sách templateId mà user có quyền với actionKey chỉ định.
     */
    @Query("""
        SELECT DISTINCT ta.templateId FROM TemplateAccess ta
        WHERE ta.active = true
          AND ta.actionKey = :actionKey
          AND (ta.subjectOrgCode IS NULL OR ta.subjectOrgCode = :deptCode)
          AND (ta.subjectPositionCode IS NULL OR ta.subjectPositionCode = :positionCode)
    """)
    List<Long> findAccessibleTemplateIds(
            @Param("actionKey")    String actionKey,
            @Param("deptCode")     String deptCode,
            @Param("positionCode") String positionCode
    );

    /**
     * Kiểm tra có tồn tại rule phân quyền nào cho actionKey trên template không.
     * Nếu không có rule nào → mặc định tất cả user được phép (no rules = allowed).
     */
    @Query("""
        SELECT COUNT(ta) > 0 FROM TemplateAccess ta
        WHERE ta.templateId = :templateId
          AND ta.active = true
          AND ta.actionKey = :actionKey
    """)
    boolean existsAnyRule(
            @Param("templateId") Long   templateId,
            @Param("actionKey")  String actionKey
    );

    /**
     * Tìm tất cả username có quyền actionKey với templateId.
     * Dùng để resolve candidate users cho Camunda task.
     */
    @Query("""
        SELECT DISTINCT u.username FROM AppUser u
        WHERE u.active = true
          AND EXISTS (
              SELECT 1 FROM TemplateAccess ta
              WHERE ta.templateId = :templateId
                AND ta.active = true
                AND ta.actionKey = :actionKey
                AND (ta.subjectOrgCode IS NULL OR ta.subjectOrgCode = u.deptCode)
                AND (ta.subjectPositionCode IS NULL OR ta.subjectPositionCode = u.positionCode)
          )
    """)
    List<String> findEligibleUsernames(
            @Param("templateId") Long   templateId,
            @Param("actionKey")  String actionKey
    );
}
