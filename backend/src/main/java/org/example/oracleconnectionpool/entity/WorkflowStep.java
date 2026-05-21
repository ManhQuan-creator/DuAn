package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "WORKFLOW_STEP")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkflowStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Long id;

    @Column(name = "WORKFLOW_DEFINITION_ID", nullable = false)
    private Long workflowDefinitionId;

    @Column(name = "STEP_ORDER", nullable = false)
    private Integer stepOrder;

    @Column(name = "STEP_KEY", nullable = false, length = 50)
    private String stepKey;

    @Column(name = "STEP_NAME", nullable = false, length = 200)
    private String stepName;

    /**
     * actionKey tương ứng với TEMPLATE_PERMISSION.actionKey.
     * Ví dụ: "APPROVE:1", "APPROVE:2", "APPROVE:3".
     * Dùng để resolve danh sách user eligible từ TEMPLATE_PERMISSION thay vì APP_ROLE.
     */
    // Oracle schema cũ đang giữ tên cột CANDIDATE_GROUP; ddl-auto=update không tự rename cột.
    // Giữ field Java theo model mới nhưng map vào cột cũ để tương thích dữ liệu hiện tại.
    @Column(name = "CANDIDATE_GROUP", nullable = false, length = 50)
    private String candidateActionKey;

    @Column(name = "STATUS_AFTER_APPROVE", nullable = false, length = 30)
    private String statusAfterApprove;

    @Column(name = "RETURN_TARGET", length = 20)
    @Builder.Default
    private String returnTarget = "SUBMITTER";

    @Column(name = "NOTIFY_MESSAGE", length = 500)
    private String notifyMessage;

    /** Key của handler chạy khi action=APPROVE (null = không có). Tra bean qua WorkflowActionHandlerRegistry. */
    @Column(name = "ON_APPROVE_HANDLER_KEY", length = 100)
    private String onApproveHandlerKey;

    @Column(name = "ON_RETURN_HANDLER_KEY", length = 100)
    private String onReturnHandlerKey;

    @Column(name = "ON_REJECT_HANDLER_KEY", length = 100)
    private String onRejectHandlerKey;
}
