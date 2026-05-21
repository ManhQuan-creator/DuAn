package org.example.oracleconnectionpool.workflow.action;

public enum WorkflowAction {
    APPROVE,
    RETURN,
    REJECT,
    RESUBMIT,
    CANCEL;

    public static WorkflowAction fromString(String raw) {
        if (raw == null) return null;
        try {
            return WorkflowAction.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
