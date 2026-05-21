package org.example.oracleconnectionpool.controller;

import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.constant.CommonResponseCode;
import org.example.oracleconnectionpool.entity.PcCompany;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.service.PcCompanyService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RequiredArgsConstructor
@RestController
@RequestMapping(Api.V1.PC_COMPANIES)
public class PcCompanyController {

    private final PcCompanyService pcCompanyService;

    /** Danh sách điện lực đang hoạt động — authenticated user. */
    @GetMapping
    public ResponseEntity<ResponseData<List<PcCompany>>> getAll() {
        return ResponseEntity.ok(new ResponseData<List<PcCompany>>().success(pcCompanyService.getAll()));
    }

    /** Toàn bộ kể cả vô hiệu hóa — ADMIN only. */
    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ResponseData<List<PcCompany>>> getAllIncludeInactive() {
        return ResponseEntity.ok(new ResponseData<List<PcCompany>>().success(pcCompanyService.getAllIncludeInactive()));
    }

    @GetMapping("/{companyCode}")
    public ResponseEntity<ResponseData<PcCompany>> getByCode(@PathVariable String companyCode) {
        return ResponseEntity.ok(new ResponseData<PcCompany>().success(pcCompanyService.getByCode(companyCode)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ResponseData<PcCompany>> create(@RequestBody Map<String, String> body) {
        String companyCode = body.get("companyCode");
        String companyName = body.get("companyName");
        if (companyCode == null || companyCode.isBlank())
            throw new RuntimeException("companyCode không được để trống");
        if (companyName == null || companyName.isBlank())
            throw new RuntimeException("companyName không được để trống");
        PcCompany created = pcCompanyService.create(companyCode, companyName);
        return ResponseEntity.ok(new ResponseData<>(CommonResponseCode.SUCCESS.getCode(), "Tạo điện lực thành công", created));
    }

    @PutMapping("/{companyCode}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ResponseData<PcCompany>> update(@PathVariable String companyCode,
                                                           @RequestBody Map<String, Object> body) {
        String  companyName = (String)  body.get("companyName");
        Boolean active      = body.get("active") instanceof Boolean b ? b : null;
        PcCompany updated = pcCompanyService.update(companyCode, companyName, active);
        return ResponseEntity.ok(new ResponseData<>(CommonResponseCode.SUCCESS.getCode(), "Cập nhật thành công", updated));
    }

    @DeleteMapping("/{companyCode}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ResponseData<Void>> delete(@PathVariable String companyCode) {
        pcCompanyService.delete(companyCode);
        return ResponseEntity.ok(new ResponseData<>(CommonResponseCode.SUCCESS.getCode(), "Đã vô hiệu hóa điện lực"));
    }
}
