package org.example.oracleconnectionpool.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.constant.CommonResponseCode;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.request.workflow.WorkflowActionRequest;
import org.example.oracleconnectionpool.model.response.WorkflowActionHandlerResponse;
import org.example.oracleconnectionpool.model.response.WorkflowHistoryResponse;
import org.example.oracleconnectionpool.model.response.WorkflowTaskResponse;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.example.oracleconnectionpool.service.WorkflowService;
import org.example.oracleconnectionpool.workflow.action.WorkflowActionHandlerRegistry;
import org.example.oracleconnectionpool.workflow.action.WorkflowActionResult;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RequiredArgsConstructor
@RestController
public class WorkflowController {

    private final WorkflowService workflowService;
    private final WorkflowActionHandlerRegistry actionHandlerRegistry;

    /**
     * Submit entry for approval
     */
    @PostMapping(Api.V1.GRID_TEMPLATE + "/{templateId}/entries/{entryId}/submit")
    public ResponseEntity<ResponseData<Void>> submitEntry(
            @PathVariable Long templateId,
            @PathVariable Long entryId,
            @AuthenticationPrincipal AppUserDetails user) {
        workflowService.submitEntry(templateId, entryId, user);
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Đã gửi phê duyệt thành công"
        ));
    }

    /**
     * Complete a workflow task (approve/return/reject).
     * Trả về {@link WorkflowActionResult} nếu handler muốn FE điều hướng (vd sang entry mới tạo).
     * Payload có thể null — FE chỉ cần check {@code data?.redirectUrl}.
     */
    @PostMapping(Api.V1.WORKFLOW + "/tasks/{taskId}/complete")
    public ResponseEntity<ResponseData<WorkflowActionResult>> completeTask(
            @PathVariable String taskId,
            @Valid @RequestBody WorkflowActionRequest request,
            @AuthenticationPrincipal AppUserDetails user) {
        WorkflowActionResult result = workflowService.completeTask(
                taskId, request.getAction(), request.getComment(), user);
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Đã xử lý thành công",
                result
        ));
    }

    /**
     * Get current user's pending tasks
     */
    @GetMapping(Api.V1.WORKFLOW + "/my-tasks")
    public ResponseEntity<ResponseData<List<WorkflowTaskResponse>>> getMyTasks(
            @AuthenticationPrincipal AppUserDetails user) {
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                CommonResponseCode.SUCCESS.getMessageKey(),
                workflowService.getMyTasks(user)
        ));
    }

    /**
     * Get current user's pending task count
     */
    @GetMapping(Api.V1.WORKFLOW + "/my-tasks/count")
    public ResponseEntity<ResponseData<Long>> getMyTaskCount(
            @AuthenticationPrincipal AppUserDetails user) {
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                CommonResponseCode.SUCCESS.getMessageKey(),
                workflowService.getMyTaskCount(user)
        ));
    }

    /**
     * Get approval history for an entry
     */
    /** Kiểm tra user hiện tại có quyền gửi duyệt cho template này không */
    @GetMapping(Api.V1.GRID_TEMPLATE + "/{templateId}/can-submit")
    public ResponseEntity<ResponseData<Boolean>> canSubmit(@PathVariable Long templateId) {
        AppUserDetails user = (AppUserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                CommonResponseCode.SUCCESS.getMessageKey(),
                workflowService.canSubmit(templateId, user)
        ));
    }

    @GetMapping(Api.V1.GRID_TEMPLATE + "/{templateId}/entries/{entryId}/history")
    public ResponseEntity<ResponseData<List<WorkflowHistoryResponse>>> getEntryHistory(
            @PathVariable Long templateId,
            @PathVariable Long entryId) {
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                CommonResponseCode.SUCCESS.getMessageKey(),
                workflowService.getEntryHistory(entryId)
        ));
    }

    /** Liệt kê tất cả WorkflowActionHandler đang đăng ký — dùng cho UI cấu hình bước. */
    @GetMapping(Api.V1.WORKFLOW + "/action-handlers")
    public ResponseEntity<ResponseData<List<WorkflowActionHandlerResponse>>> listActionHandlers() {
        List<WorkflowActionHandlerResponse> data = actionHandlerRegistry.all().stream()
                .map(h -> WorkflowActionHandlerResponse.builder()
                        .key(h.getKey())
                        .label(h.getLabel())
                        .description(h.getDescription())
                        .build())
                .toList();
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                CommonResponseCode.SUCCESS.getMessageKey(),
                data
        ));
    }
}
