package org.example.oracleconnectionpool.workflow.action;

import lombok.Builder;
import lombok.Getter;
import org.camunda.bpm.engine.task.Task;
import org.example.oracleconnectionpool.entity.WorkflowStep;
import org.example.oracleconnectionpool.security.AppUserDetails;

/**
 * Context truyền cho {@link WorkflowActionHandler#handle(WorkflowActionContext)}.
 * Gom đủ thông tin để handler không phải tự query lại Camunda/DB cho các trường cơ bản.
 * Handler có thể dùng {@link #getUser()} / {@link #getEntryId()} để gọi service riêng.
 */
@Getter
@Builder
public class WorkflowActionContext {
    /** Camunda task đang xử lý. */
    private final Task task;
    /** Bước (WorkflowStep) tương ứng với task — có thể null nếu không resolve được. */
    private final WorkflowStep step;
    /** Hành động do user thực hiện. */
    private final WorkflowAction action;
    /** Nội dung ghi chú (nếu có). */
    private final String comment;
    /** User đang thao tác. */
    private final AppUserDetails user;
    /** entryId lấy từ process variable. Có thể null. */
    private final Long entryId;
    /** templateId lấy từ process variable. Có thể null. */
    private final Long templateId;
    /** processDefinitionKey (vd: "scl-approval"). */
    private final String processDefinitionKey;
    /** Process instance id của Camunda. */
    private final String processInstanceId;
}
