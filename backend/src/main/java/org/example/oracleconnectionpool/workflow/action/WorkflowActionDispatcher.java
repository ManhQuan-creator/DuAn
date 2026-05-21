package org.example.oracleconnectionpool.workflow.action;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.entity.WorkflowStep;
import org.springframework.stereotype.Component;

/**
 * Chịu trách nhiệm điều phối: cho một WorkflowStep + action, tìm handler tương ứng và gọi.
 *
 * <p>Được gọi từ {@link org.example.oracleconnectionpool.service.WorkflowService#completeTask}
 * TRƯỚC {@code taskService.complete(...)} để handler chạy trong cùng transaction,
 * throw → rollback cả workflow.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WorkflowActionDispatcher {

    private final WorkflowActionHandlerRegistry registry;

    /**
     * Điều phối handler; trả về {@link WorkflowActionResult} do handler sinh ra (có thể null
     * nếu không có handler match, handler bỏ qua, hoặc không có tín hiệu cho FE).
     */
    public WorkflowActionResult dispatch(WorkflowActionContext ctx) {
        if (ctx.getStep() == null || ctx.getAction() == null) return null;

        String handlerKey = resolveHandlerKey(ctx.getStep(), ctx.getAction());
        if (handlerKey == null || handlerKey.isBlank()) return null;

        WorkflowActionHandler handler = registry.find(handlerKey).orElse(null);
        if (handler == null) {
            log.warn("Step '{}' config handler '{}' cho action {} nhưng không có bean nào match — bỏ qua",
                    ctx.getStep().getStepKey(), handlerKey, ctx.getAction());
            return null;
        }

        log.info("Chạy handler '{}' cho step='{}' action={} (entryId={})",
                handlerKey, ctx.getStep().getStepKey(), ctx.getAction(), ctx.getEntryId());
        return handler.handle(ctx);
    }

    private String resolveHandlerKey(WorkflowStep step, WorkflowAction action) {
        return switch (action) {
            case APPROVE -> step.getOnApproveHandlerKey();
            case RETURN -> step.getOnReturnHandlerKey();
            case REJECT -> step.getOnRejectHandlerKey();
            // RESUBMIT/CANCEL chưa cần mapping riêng — có thể mở rộng sau nếu BA yêu cầu.
            default -> null;
        };
    }
}
