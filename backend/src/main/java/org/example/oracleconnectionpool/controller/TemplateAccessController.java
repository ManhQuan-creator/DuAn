package org.example.oracleconnectionpool.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.constant.CommonResponseCode;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.request.templateaccess.CreateTemplateAccessRequest;
import org.example.oracleconnectionpool.model.request.templateaccess.SearchTemplateAccessRequest;
import org.example.oracleconnectionpool.model.request.templateaccess.UpdateTemplateAccessRequest;
import org.example.oracleconnectionpool.model.response.TemplateAccessResponse;
import org.example.oracleconnectionpool.service.TemplateAccessService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping(Api.V1.TEMPLATE_ACCESS)
@RequiredArgsConstructor
public class TemplateAccessController {

    private final TemplateAccessService templateAccessService;

    /** Tìm kiếm rule phân quyền có phân trang (templateId và keyword tuỳ chọn) */
    @PostMapping("/search")
    public ResponseEntity<ResponseData<Page<TemplateAccessResponse>>> search(
            @RequestBody SearchTemplateAccessRequest request) {
        return ResponseEntity.ok(
                new ResponseData<Page<TemplateAccessResponse>>().success(
                        templateAccessService.search(request)));
    }

    /** Lấy tất cả rule phân quyền của một template */
    @GetMapping("/by-template/{templateId}")
    public ResponseEntity<ResponseData<List<TemplateAccessResponse>>> getByTemplateId(
            @PathVariable Long templateId) {
        return ResponseEntity.ok(
                new ResponseData<List<TemplateAccessResponse>>().success(
                        templateAccessService.getByTemplateId(templateId)));
    }

    /** Tạo rule phân quyền mới */
    @PostMapping
    public ResponseEntity<ResponseData<TemplateAccessResponse>> create(
            @Valid @RequestBody CreateTemplateAccessRequest request) {
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Tạo rule phân quyền thành công",
                templateAccessService.create(request)
        ));
    }

    /** Cập nhật rule phân quyền */
    @PutMapping("/{id}")
    public ResponseEntity<ResponseData<TemplateAccessResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateTemplateAccessRequest request) {
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Cập nhật rule phân quyền thành công",
                templateAccessService.update(id, request)
        ));
    }

    /** Xóa rule phân quyền (soft-delete) */
    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseData<Void>> delete(@PathVariable Long id) {
        templateAccessService.delete(id);
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Đã xóa rule phân quyền"
        ));
    }

    /** Kiểm tra user hiện tại có quyền actionKey (VIEW/EDIT/SUBMIT/APPROVE:N) trên template không */
    @GetMapping("/check/{templateId}")
    public ResponseEntity<ResponseData<Boolean>> checkAccess(
            @PathVariable Long templateId,
            @RequestParam(defaultValue = "VIEW") String actionKey) {
        return ResponseEntity.ok(
                new ResponseData<Boolean>().success(
                        templateAccessService.hasAccess(templateId, actionKey)));
    }

    /** Lấy danh sách templateId mà user hiện tại có quyền VIEW */
    @GetMapping("/my-viewable")
    public ResponseEntity<ResponseData<List<Long>>> getMyViewableTemplates() {
        return ResponseEntity.ok(
                new ResponseData<List<Long>>().success(
                        templateAccessService.getViewableTemplateIds()));
    }
}
