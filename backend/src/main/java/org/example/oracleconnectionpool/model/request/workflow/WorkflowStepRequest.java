package org.example.oracleconnectionpool.model.request.workflow;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class WorkflowStepRequest {
    @NotNull
    private Integer stepOrder;
    @NotBlank
    private String stepKey;
    @NotBlank
    private String stepName;
    /** Giữ lại cho BPMN candidateGroups attribute — không dùng cho phân quyền runtime */
    private String candidateActionKey;
    @NotBlank
    private String statusAfterApprove;
    private String returnTarget;
    private String notifyMessage;

    /** Key handler chạy khi phê duyệt/trả lại/từ chối bước này. Null = không chạy logic phụ. */
    private String onApproveHandlerKey;
    private String onReturnHandlerKey;
    private String onRejectHandlerKey;

    /** Danh sách nhóm người duyệt cho bước này */
    private List<StepCandidateRequest> candidates;

    @Data
    public static class StepCandidateRequest {
        private String subjectOrgCode;
        private String subjectPositionCode;
    }
}
