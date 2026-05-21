package org.example.oracleconnectionpool.service;

import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.entity.DeptType;
import org.example.oracleconnectionpool.repository.DeptTypeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DeptTypeService {

    private final DeptTypeRepository deptTypeRepository;

    /** Toàn bộ loại đơn vị (cả vô hiệu hóa) — dùng cho admin manager. */
    public List<DeptType> getAll() {
        return deptTypeRepository.findAllByOrderBySortOrderAscDeptTypeCodeAsc();
    }

    /** Chỉ các loại đơn vị đang hoạt động — dùng cho dropdown phân quyền. */
    public List<DeptType> getAllActive() {
        return deptTypeRepository.findByActiveTrueOrderBySortOrderAscDeptTypeCodeAsc();
    }

    /** Lọc theo cấp tổ chức: HQ_DEPT (Ban TCT) hoặc PC_DEPT (Phòng PC). */
    public List<DeptType> getActiveByScope(String orgLevelScope) {
        return deptTypeRepository.findByOrgLevelScopeAndActiveTrueOrderBySortOrderAscDeptTypeCodeAsc(orgLevelScope);
    }

    public DeptType getByCode(String deptTypeCode) {
        return deptTypeRepository.findById(deptTypeCode.toUpperCase().trim())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy loại đơn vị: " + deptTypeCode));
    }

    @Transactional
    public DeptType create(String deptTypeCode, String deptTypeName, String orgLevelScope, Integer sortOrder) {
        String code = deptTypeCode.toUpperCase().trim();
        if (deptTypeRepository.existsByDeptTypeCode(code)) {
            throw new RuntimeException("Mã loại đơn vị '" + code + "' đã tồn tại");
        }
        return deptTypeRepository.save(DeptType.builder()
                .deptTypeCode(code)
                .deptTypeName(deptTypeName.trim())
                .orgLevelScope(orgLevelScope.trim())
                .sortOrder(sortOrder != null ? sortOrder : 0)
                .active(true)
                .build());
    }

    @Transactional
    public DeptType update(String deptTypeCode, String deptTypeName, String orgLevelScope,
                            Integer sortOrder, Boolean active) {
        DeptType d = getByCode(deptTypeCode);
        if (deptTypeName  != null) d.setDeptTypeName(deptTypeName.trim());
        if (orgLevelScope != null) d.setOrgLevelScope(orgLevelScope.trim());
        if (sortOrder     != null) d.setSortOrder(sortOrder);
        if (active        != null) d.setActive(active);
        return deptTypeRepository.save(d);
    }

    @Transactional
    public void delete(String deptTypeCode) {
        DeptType d = getByCode(deptTypeCode);
        d.setActive(false);
        deptTypeRepository.save(d);
    }
}
