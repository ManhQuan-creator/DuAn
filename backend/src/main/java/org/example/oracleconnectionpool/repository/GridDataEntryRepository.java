package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.GridDataEntry;
import org.example.oracleconnectionpool.model.response.sclcategory.OrgDataEntryProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface GridDataEntryRepository extends JpaRepository<GridDataEntry, Long> {

    List<GridDataEntry> findByTemplateIdOrderByCreatedAtDesc(Long templateId);

    boolean existsByTemplateIdAndEntryCode(Long templateId, String entryCode);

    void deleteByTemplateId(Long templateId);

    // Filter entries by orgCode/year/month (all optional)
    @Query("SELECT e FROM GridDataEntry e WHERE e.templateId = :templateId " +
           "AND (:orgCode IS NULL OR e.orgCode = :orgCode) " +
           "AND (:year IS NULL OR e.year = :year) " +
           "AND (:month IS NULL OR e.month = :month) " +
           "ORDER BY e.createdAt DESC")
    List<GridDataEntry> findByTemplateIdWithFilters(
            @Param("templateId") Long templateId,
            @Param("orgCode") String orgCode,
            @Param("year") Integer year,
            @Param("month") Integer month);

    // Lookup: find entry by template code + org + year + month (for GETDATA)
    @Query("SELECT e FROM GridDataEntry e JOIN GridTemplate t ON e.templateId = t.id " +
           "WHERE t.code = :templateCode " +
           "AND (:orgCode IS NULL OR e.orgCode = :orgCode) " +
           "AND e.year = :year " +
           "AND (:month IS NULL OR e.month = :month)")
    Optional<GridDataEntry> findByTemplateCodeAndPeriod(
            @Param("templateCode") String templateCode,
            @Param("year") Integer year,
            @Param("month") Integer month,
            @Param("orgCode") String orgCode);


    @Query("""
        SELECT 
            gde.orgCode AS orgCode,
            gde.rowData AS rowData
        FROM GridDataEntry gde
        JOIN GridTemplate gt ON gde.templateId = gt.id 
        WHERE gde.year = :yearVal
        AND gt.code = :code
    """)
    List<OrgDataEntryProjection> findRowDataEntryByYearValAndTemplateCode(
            @Param("yearVal") Integer yearVal,
            @Param("code") String code
    );

    // Unique check for period
    Optional<GridDataEntry> findByTemplateIdAndOrgCodeAndYearAndMonth(Long templateId, String orgCode, Integer year, Integer month);
    boolean existsByTemplateIdAndOrgCodeAndYearAndMonth(Long templateId, String orgCode, Integer year, Integer month);

    /** Lookup entry phân bổ chi phí TCT — entryCode dạng "SCL_B21_PB_TCT_{year}" + year. */
    Optional<GridDataEntry> findFirstByEntryCodeAndYear(String entryCode, Integer year);
}
