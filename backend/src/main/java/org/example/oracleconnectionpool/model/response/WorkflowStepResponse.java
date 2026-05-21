package org.example.oracleconnectionpool.model.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class WorkflowStepResponse {
    private Long id;
    private Integer stepOrder;
    private String stepKey;
    private String stepName;
    private String candidateActionKey;
    private String statusAfterApprove;
    private String returnTarget;
    private String notifyMessage;

    private String onApproveHandlerKey;
    private String onReturnHandlerKey;
    private String onRejectHandlerKey;

    /** Danh sách nhóm người duyệt */
    private List<StepCandidateResponse> candidates;

    @Data
    @Builder
    public static class StepCandidateResponse {
        private Long id;
        private String subjectOrgCode;
        private String subjectPositionCode;
    }
}
