package org.example.oracleconnectionpool.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.constant.CommonResponseCode;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.buttonaction.ButtonActionHandlerRegistry;
import org.example.oracleconnectionpool.buttonaction.ButtonActionResult;
import org.example.oracleconnectionpool.model.request.templatebutton.CreateTemplateButtonRequest;
import org.example.oracleconnectionpool.model.request.templatebutton.ExecuteButtonActionRequest;
import org.example.oracleconnectionpool.model.request.templatebutton.UpdateTemplateButtonRequest;
import org.example.oracleconnectionpool.model.response.TemplateButtonResponse;
import org.example.oracleconnectionpool.service.TemplateButtonService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping(Api.V1.TEMPLATE_BUTTONS)
@RequiredArgsConstructor
public class TemplateButtonController {

    private final TemplateButtonService templateButtonService;
    private final ButtonActionHandlerRegistry handlerRegistry;

    /** Lấy danh sách nút của template, kèm allowed=true/false cho user hiện tại */
    @GetMapping("/by-template/{templateId}")
    public ResponseEntity<ResponseData<List<TemplateButtonResponse>>> getByTemplateId(
            @PathVariable Long templateId) {
        return ResponseEntity.ok(
                new ResponseData<List<TemplateButtonResponse>>().success(
                        templateButtonService.getByTemplateId(templateId)));
    }

    /** Khai báo nút mới cho template (ADMIN) */
    @PostMapping
    public ResponseEntity<ResponseData<TemplateButtonResponse>> create(
            @Valid @RequestBody CreateTemplateButtonRequest request) {
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Tạo nút thành công",
                templateButtonService.create(request)));
    }

    /** Cập nhật nút (label, icon, sortOrder) */
    @PutMapping("/{id}")
    public ResponseEntity<ResponseData<TemplateButtonResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateTemplateButtonRequest request) {
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Cập nhật nút thành công",
                templateButtonService.update(id, request)));
    }

    /** Thực thi logic nút — dispatch đến handler tương ứng theo buttonKey */
    @PostMapping("/execute")
    public ResponseEntity<ResponseData<ButtonActionResult>> execute(
            @Valid @RequestBody ExecuteButtonActionRequest request) {
        ButtonActionResult result = templateButtonService.executeAction(request);
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                result.getMessage(),
                result));
    }

    /** Lấy danh sách handler đã đăng ký — cho UI cấu hình */
    @GetMapping("/action-handlers")
    public ResponseEntity<ResponseData<List<java.util.Map<String, String>>>> getActionHandlers() {
        List<java.util.Map<String, String>> list = handlerRegistry.all().stream()
                .map(h -> java.util.Map.of(
                        "key", h.getKey(),
                        "label", h.getLabel(),
                        "description", h.getDescription() != null ? h.getDescription() : ""
                ))
                .toList();
        return ResponseEntity.ok(new ResponseData<List<java.util.Map<String, String>>>().success(list));
    }

    /** Xóa nút (soft-delete, ADMIN) */
    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseData<Void>> delete(@PathVariable Long id) {
        templateButtonService.delete(id);
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Đã xóa nút"));
    }
}
