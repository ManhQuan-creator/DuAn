package org.example.oracleconnectionpool.constant;

/**
 * Status hợp lệ cho {@code WORKFLOW_DEFINITION.status}.
 *
 * <p>{@link #DRAFT} = đang soạn BPMN, có thể sửa/xóa.
 * {@link #DEPLOYED} = đã deploy lên Camunda engine, không sửa được nữa.
 */
public final class WorkflowDefinitionStatus {

    public static final String DRAFT = "DRAFT";
    public static final String DEPLOYED = "DEPLOYED";

    private WorkflowDefinitionStatus() {}
}
