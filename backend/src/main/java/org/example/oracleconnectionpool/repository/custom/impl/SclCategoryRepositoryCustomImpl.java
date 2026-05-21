package org.example.oracleconnectionpool.repository.custom.impl;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import lombok.RequiredArgsConstructor;
import org.apache.logging.log4j.util.Strings;
import org.example.oracleconnectionpool.constant.Constant;
import org.example.oracleconnectionpool.entity.SclCategoryEntity;
import org.example.oracleconnectionpool.model.request.sclcategory.SclCategoryFilterDTO;
import org.example.oracleconnectionpool.model.response.sclcategory.SclCategoryResponseDTO;
import org.example.oracleconnectionpool.repository.custom.SclCategoryRepositoryCustom;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.example.oracleconnectionpool.utils.ObjectMapperUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

import java.util.*;
import java.util.stream.Collectors;

@Repository
@RequiredArgsConstructor
public class SclCategoryRepositoryCustomImpl implements SclCategoryRepositoryCustom {
    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public Page<SclCategoryResponseDTO> search(SclCategoryFilterDTO req, AppUserDetails user) {

        String orgGroupCode = user.getOrgGroupCode();
        String companyCode = user.getCompanyCode();
        String deptCode = user.getDeptCode();

        StringBuilder baseSql = new StringBuilder();
        List<Object> params = new ArrayList<>();

        // ===== BUILD BASE SQL =====
        if (Constant.OrgGroupCode.PC_COMPANY.equals(orgGroupCode)) {
            baseSql.append("""
            WITH PC_UNIT AS (
                SELECT DISTINCT PC
                FROM PC_ORGANIZATION_UNIT
                WHERE PC = ?
            )
            SELECT s.*
            FROM SCL_CATEGORY s
            JOIN PC_UNIT u ON s.PC = u.PC
        """);
            params.add(companyCode);
        } else if (Constant.OrgGroupCode.EVNNPC.equals(orgGroupCode)
                && (Constant.DeptCode.BAN_KH.equals(deptCode) || deptCode == null)) {
            baseSql.append("""
            SELECT s.*
            FROM SCL_CATEGORY s
        """);

        } else {
            return new PageImpl<>(
                    Collections.emptyList(),
                    PageRequest.of(req.getPageNum(), req.getPageSize()),
                    0
            );
        }

        // ===== WHERE =====
        StringBuilder whereSql = new StringBuilder(" WHERE 1=1 ");

        applyPermission(whereSql, params, orgGroupCode, companyCode);
        applyFilter(whereSql, params, req, orgGroupCode, deptCode);

        // ===== COPY PARAMS FOR COUNT (QUAN TRỌNG) =====
        List<Object> countParams = new ArrayList<>(params);

        // ===== PAGINATION =====
        String finalSql = baseSql.toString()
                + whereSql
                + " ORDER BY s.UPDATED_AT DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";

        int offset = req.getPageNum() * req.getPageSize();
        params.add(offset);

        // ===== COUNT =====
        String countSql = "SELECT COUNT(*) FROM (" + baseSql + whereSql + ")";

        Query countQuery = entityManager.createNativeQuery(countSql);
        setParams(countQuery, countParams); // dùng params riêng

        long total = ((Number) countQuery.getSingleResult()).longValue();

        // ===== FETCH NEXT =====
        int fetchNext = Math.min(req.getPageSize(), (int) (total - offset));
        fetchNext = Math.max(fetchNext, 0);

        params.add(fetchNext);

        // ===== MAIN QUERY =====
        Query query = entityManager.createNativeQuery(finalSql, SclCategoryEntity.class);
        setParams(query, params);

        List<SclCategoryEntity> entities = query.getResultList();

        List<SclCategoryResponseDTO> content = entities.stream()
                .map(e -> ObjectMapperUtils.map(e, SclCategoryResponseDTO.class))
                .toList();

        return new PageImpl<>(
                content,
                PageRequest.of(req.getPageNum(), req.getPageSize()),
                total
        );
    }

    private void setParams(Query query, List<Object> params) {
        for (int i = 0; i < params.size(); i++) {
            query.setParameter(i + 1, params.get(i));
        }
    }

    private void applyPermission(StringBuilder whereSql,
                                 List<Object> params,
                                 String orgGroupCode,
                                 String companyCode) {
        if (Constant.OrgGroupCode.PC_COMPANY.equals(orgGroupCode)) {
            // chỉ xem dữ liệu của chính company
            whereSql.append(" AND s.PC = ? ");
            params.add(companyCode);
        }
    }

    private void applyFilter(StringBuilder whereSql,
                             List<Object> params,
                             SclCategoryFilterDTO req,
                             String orgGroupCode,
                             String deptCode) {

        if (req.getCategoryCode() != null) {
            whereSql.append(" AND LOWER(s.CATEGORY_CODE) LIKE ? ");
            params.add("%" + req.getCategoryCode().toLowerCase() + "%");
        }

        if (req.getCategoryName() != null) {
            whereSql.append(" AND LOWER(s.CATEGORY_NAME) LIKE ? ");
            params.add("%" + req.getCategoryName().toLowerCase() + "%");
        }

        if (req.getYearPlan() != null) {
            whereSql.append(" AND s.YEAR_PLAN = ? ");
            params.add(req.getYearPlan());
        }

        // ===== UNIT (phân biệt cực quan trọng) =====
        if (Strings.isNotBlank(req.getUnit())) {

            Set<String> set = Arrays.stream(req.getUnit().split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toSet());

            if (!set.isEmpty()) {
                String inClause = set.stream().map(s -> "?").collect(Collectors.joining(","));

                if (Constant.OrgGroupCode.PC_COMPANY.equals(orgGroupCode)) {
                    // dùng bảng PC_UNIT
                    whereSql.append(" AND u.UNIT IN (").append(inClause).append(")");
                    params.addAll(set);
                } else if (Constant.OrgGroupCode.EVNNPC.equals(orgGroupCode)
                        && (Constant.DeptCode.BAN_KH.equals(deptCode) || deptCode == null)) {
                    // EVNNPC
                    whereSql.append(" AND s.PC IN (").append(inClause).append(")");
                    params.addAll(set);
                }
            }
        }

        if (Strings.isNotBlank(req.getStatus())) {
            Set<String> set = Arrays.stream(req.getStatus().split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toSet());

            if (!set.isEmpty()) {
                String inClause = set.stream().map(s -> "?").collect(Collectors.joining(","));

                whereSql.append(" AND s.STATUS IN (").append(inClause).append(")");
                params.addAll(set);
            }
        }

        if (Strings.isNotBlank(req.getProgress())) {
            Set<String> set = Arrays.stream(req.getProgress().split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toSet());

            if (!set.isEmpty()) {
                String inClause = set.stream().map(s -> "?").collect(Collectors.joining(","));

                whereSql.append(" AND s.PROGRESS IN (").append(inClause).append(")");
                params.addAll(set);
            }
        }

        if (Strings.isNotBlank(req.getAssetType())) {
            Set<String> set = Arrays.stream(req.getAssetType().split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toSet());

            if (!set.isEmpty()) {
                String inClause = set.stream().map(s -> "?").collect(Collectors.joining(","));

                whereSql.append(" AND s.ASSET_TYPE IN (").append(inClause).append(")");
                params.addAll(set);
            }
        }

        if (Strings.isNotBlank(req.getPlanType())) {
            Set<String> set = Arrays.stream(req.getPlanType().split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toSet());

            if (!set.isEmpty()) {
                String inClause = set.stream().map(s -> "?").collect(Collectors.joining(","));

                whereSql.append(" AND s.PLAN_TYPE IN (").append(inClause).append(")");
                params.addAll(set);
            }
        }

        if (Strings.isNotBlank(req.getRegisterType())) {
            Set<String> set = Arrays.stream(req.getRegisterType().split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toSet());

            if (!set.isEmpty()) {
                String inClause = set.stream().map(s -> "?").collect(Collectors.joining(","));

                whereSql.append(" AND s.REGISTER_TYPE IN (").append(inClause).append(")");
                params.addAll(set);
            }
        }
    }

    @Override
    public List<SclCategoryResponseDTO> searchForExport(SclCategoryFilterDTO req, AppUserDetails user) {

        String orgGroupCode = user.getOrgGroupCode();
        String companyCode = user.getCompanyCode();
        String deptCode = user.getDeptCode();

        StringBuilder baseSql = new StringBuilder();
        List<Object> params = new ArrayList<>();

        // ===== BUILD BASE SQL =====
        if (Constant.OrgGroupCode.PC_COMPANY.equals(orgGroupCode)) {
            baseSql.append("""
            WITH PC_UNIT AS (
                SELECT *
                FROM PC_ORGANIZATION_UNIT
                WHERE PC = ?
            )
            SELECT s.*
            FROM SCL_CATEGORY s
            JOIN PC_UNIT u ON s.PC = u.PC
        """);
            params.add(companyCode);

        } else if (Constant.OrgGroupCode.EVNNPC.equals(orgGroupCode)
                && (Constant.DeptCode.BAN_KH.equals(deptCode) || deptCode == null)) {

            baseSql.append("""
            SELECT s.*
            FROM SCL_CATEGORY s
        """);

        } else {
            return Collections.emptyList();
        }

        // ===== WHERE =====
        StringBuilder whereSql = new StringBuilder(" WHERE 1=1 ");

        applyPermission(whereSql, params, orgGroupCode, companyCode);
        applyFilter(whereSql, params, req, orgGroupCode, deptCode);

        // ===== FINAL SQL (KHÔNG PAGING) =====
        String finalSql = baseSql.toString()
                + whereSql
                + " ORDER BY s.UPDATED_AT DESC";

        Query query = entityManager.createNativeQuery(finalSql, SclCategoryEntity.class);
        setParams(query, params);

        List<SclCategoryEntity> entities = query.getResultList();

        return entities.stream()
                .map(e -> ObjectMapperUtils.map(e, SclCategoryResponseDTO.class))
                .toList();
    }
}
