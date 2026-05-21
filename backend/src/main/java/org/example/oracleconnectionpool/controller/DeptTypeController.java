package org.example.oracleconnectionpool.controller;

import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.constant.CommonResponseCode;
import org.example.oracleconnectionpool.entity.DeptType;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.service.DeptTypeService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RequiredArgsConstructor
@RestController
@RequestMapping(Api.V1.DEPT_TYPES)
public class DeptTypeController {

    private final DeptTypeService deptTypeService;

    /** Toàn bộ loại đơn vị (cả vô hiệu hóa) — dùng cho admin manager. */
    @GetMapping
    public ResponseEntity<ResponseData<List<DeptType>>> getAll() {
        return ResponseEntity.ok(new ResponseData<List<DeptType>>().success(deptTypeService.getAll()));
    }

    /** Chỉ các loại đơn vị đang hoạt động — dùng cho dropdown chọn phân quyền. */
    @GetMapping("/active")
    public ResponseEntity<ResponseData<List<DeptType>>> getAllActive() {
        return ResponseEntity.ok(new ResponseData<List<DeptType>>().success(deptTypeService.getAllActive()));
    }

    /** Lọc theo cấp tổ chức (HQ_DEPT | PC_DEPT). */
    @GetMapping("/by-scope/{orgLevelScope}")
    public ResponseEntity<ResponseData<List<DeptType>>> getByScope(@PathVariable String orgLevelScope) {
        return ResponseEntity.ok(new ResponseData<List<DeptType>>().success(
                deptTypeService.getActiveByScope(orgLevelScope.toUpperCase())
        ));
    }

    @GetMapping("/{deptTypeCode}")
    public ResponseEntity<ResponseData<DeptType>> getByCode(@PathVariable String deptTypeCode) {
        return ResponseEntity.ok(new ResponseData<DeptType>().success(deptTypeService.getByCode(deptTypeCode)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ResponseData<DeptType>> create(@RequestBody Map<String, Object> body) {
        String deptTypeCode  = (String) body.get("deptTypeCode");
        String deptTypeName  = (String) body.get("deptTypeName");
        String orgLevelScope = (String) body.get("orgLevelScope");
        Integer sortOrder    = body.get("sortOrder") instanceof Number n ? n.intValue() : null;
        if (deptTypeCode  == null || deptTypeCode.isBlank())  throw new RuntimeException("deptTypeCode không được để trống");
        if (deptTypeName  == null || deptTypeName.isBlank())  throw new RuntimeException("deptTypeName không được để trống");
        if (orgLevelScope == null || orgLevelScope.isBlank()) throw new RuntimeException("orgLevelScope không được để trống");
        DeptType created = deptTypeService.create(deptTypeCode, deptTypeName, orgLevelScope, sortOrder);
        return ResponseEntity.ok(new ResponseData<>(CommonResponseCode.SUCCESS.getCode(), "Tạo loại đơn vị thành công", created));
    }

    @PutMapping("/{deptTypeCode}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ResponseData<DeptType>> update(@PathVariable String deptTypeCode,
                                                          @RequestBody Map<String, Object> body) {
        String  deptTypeName  = (String)  body.get("deptTypeName");
        String  orgLevelScope = (String)  body.get("orgLevelScope");
        Integer sortOrder     = body.get("sortOrder") instanceof Number n ? n.intValue() : null;
        Boolean active        = body.get("active")    instanceof Boolean b ? b : null;
        DeptType updated = deptTypeService.update(deptTypeCode, deptTypeName, orgLevelScope, sortOrder, active);
        return ResponseEntity.ok(new ResponseData<>(CommonResponseCode.SUCCESS.getCode(), "Cập nhật loại đơn vị thành công", updated));
    }

    @DeleteMapping("/{deptTypeCode}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ResponseData<Void>> delete(@PathVariable String deptTypeCode) {
        deptTypeService.delete(deptTypeCode);
        return ResponseEntity.ok(new ResponseData<>(CommonResponseCode.SUCCESS.getCode(), "Đã vô hiệu hóa loại đơn vị"));
    }
}
