package org.example.oracleconnectionpool.service;

import org.example.oracleconnectionpool.constant.EntryStatus;
import org.example.oracleconnectionpool.entity.WorkflowDefinition;
import org.example.oracleconnectionpool.entity.WorkflowStep;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Generates valid Camunda 7 BPMN 2.0 XML from WorkflowDefinition + WorkflowSteps.
 * Pattern follows existing scl-approval.bpmn exactly.
 */
@Service
public class BpmnGeneratorService {

    public String generate(WorkflowDefinition definition, List<WorkflowStep> steps) {
        validate(steps);

        String processId = definition.getWorkflowKey();
        String processName = definition.getName();

        StringBuilder xml = new StringBuilder();
        // Collect all elements and flows
        List<String> elements = new ArrayList<>();
        List<String> flows = new ArrayList<>();

        // === START ===
        elements.add(startEvent("start", "Gửi phê duyệt", "flow_start_to_update_submitted"));

        // Update status to SUBMITTED
        elements.add(serviceTask("update_status_submitted", "Cập nhật trạng thái SUBMITTED",
                "${updateEntryStatusDelegate}", "targetStatus", EntryStatus.SUBMITTED,
                List.of("flow_start_to_update_submitted"),
                List.of("flow_submitted_to_notify_" + steps.get(0).getStepKey())));

        // Notify first step
        WorkflowStep first = steps.get(0);
        String notifyMsg0 = first.getNotifyMessage() != null ? first.getNotifyMessage()
                : "Có phiên nhập liệu mới cần xét duyệt";
        elements.add(notifyTask("notify_" + first.getStepKey(), "Thông báo " + first.getStepKey().toUpperCase(),
                first.getStepKey(), notifyMsg0,
                List.of("flow_submitted_to_notify_" + first.getStepKey()),
                List.of("flow_notify_" + first.getStepKey() + "_to_" + first.getStepKey())));

        flows.add(flow("flow_start_to_update_submitted", "start", "update_status_submitted"));
        flows.add(flow("flow_submitted_to_notify_" + first.getStepKey(), "update_status_submitted", "notify_" + first.getStepKey()));
        flows.add(flow("flow_notify_" + first.getStepKey() + "_to_" + first.getStepKey(), "notify_" + first.getStepKey(), first.getStepKey() + "_task"));

        // === STEPS ===
        for (int i = 0; i < steps.size(); i++) {
            WorkflowStep step = steps.get(i);
            String key = step.getStepKey();
            String taskId = key + "_task";
            String updateId = "update_status_" + key;
            String gwId = "gw_" + key;
            boolean isLast = (i == steps.size() - 1);
            WorkflowStep nextStep = isLast ? null : steps.get(i + 1);
            WorkflowStep prevStep = (i == 0) ? null : steps.get(i - 1);

            // Incoming flows for UserTask
            List<String> taskIncoming = new ArrayList<>();
            taskIncoming.add("flow_notify_" + key + "_to_" + key);
            // PREVIOUS_STEP return flows target this task
            for (int j = i + 1; j < steps.size(); j++) {
                if ("PREVIOUS_STEP".equals(steps.get(j).getReturnTarget())) {
                    taskIncoming.add("flow_return_from_" + steps.get(j).getStepKey());
                }
            }

            // UserTask
            elements.add(userTask(taskId, step.getStepName(), step.getCandidateActionKey(),
                    taskIncoming, List.of("flow_" + key + "_to_update_" + key)));

            // Update status after task
            elements.add(serviceTask(updateId, "Cập nhật trạng thái sau " + key.toUpperCase(),
                    "${updateEntryStatusDelegate}", "targetStatus", step.getStatusAfterApprove(),
                    List.of("flow_" + key + "_to_update_" + key),
                    List.of("flow_update_" + key + "_to_gw_" + key)));

            // Gateway
            List<String> gwOutgoing = new ArrayList<>();
            gwOutgoing.add("flow_" + key + "_approve");
            gwOutgoing.add("flow_" + key + "_return");
            gwOutgoing.add("flow_" + key + "_reject");
            elements.add(exclusiveGateway(gwId, "Kết quả " + key.toUpperCase() + "?",
                    List.of("flow_update_" + key + "_to_gw_" + key), gwOutgoing));

            // Flows: task → update → gateway
            flows.add(flow("flow_" + key + "_to_update_" + key, taskId, updateId));
            flows.add(flow("flow_update_" + key + "_to_gw_" + key, updateId, gwId));

            // APPROVE flow
            if (isLast) {
                flows.add(conditionFlow("flow_" + key + "_approve", gwId, "update_status_approved",
                        "${action == 'APPROVE'}"));
            } else {
                flows.add(conditionFlow("flow_" + key + "_approve", gwId, "notify_" + nextStep.getStepKey(),
                        "${action == 'APPROVE'}"));

                // Notify next step
                String nextNotifyMsg = nextStep.getNotifyMessage() != null ? nextStep.getNotifyMessage()
                        : "Phiên nhập liệu cần " + nextStep.getStepKey().toUpperCase() + " xử lý";
                elements.add(notifyTask("notify_" + nextStep.getStepKey(),
                        "Thông báo " + nextStep.getStepKey().toUpperCase(),
                        nextStep.getStepKey(), nextNotifyMsg,
                        List.of("flow_" + key + "_approve"),
                        List.of("flow_notify_" + nextStep.getStepKey() + "_to_" + nextStep.getStepKey())));
                flows.add(flow("flow_notify_" + nextStep.getStepKey() + "_to_" + nextStep.getStepKey(),
                        "notify_" + nextStep.getStepKey(), nextStep.getStepKey() + "_task"));
            }

            // REJECT flow → shared rejected
            flows.add(conditionFlow("flow_" + key + "_reject", gwId, "update_status_rejected",
                    "${action == 'REJECT'}"));

            // RETURN flow
            String returnTarget = step.getReturnTarget() != null ? step.getReturnTarget() : "SUBMITTER";
            if ("PREVIOUS_STEP".equals(returnTarget) && prevStep != null) {
                // Return to previous step
                String returnUpdateId = "update_status_returned_" + key;
                String returnNotifyId = "notify_return_" + key;

                elements.add(serviceTask(returnUpdateId, "Cập nhật RETURNED (" + key.toUpperCase() + ")",
                        "${updateEntryStatusDelegate}", "targetStatus", EntryStatus.RETURNED,
                        List.of("flow_" + key + "_return"),
                        List.of("flow_return_" + key + "_to_notify")));

                elements.add(notifyTask(returnNotifyId, "Thông báo trả lại (" + key.toUpperCase() + ")",
                        prevStep.getStepKey(),
                        "Phiên nhập liệu bị trả lại bởi " + step.getStepName(),
                        List.of("flow_return_" + key + "_to_notify"),
                        List.of("flow_return_from_" + key)));

                flows.add(conditionFlow("flow_" + key + "_return", gwId, returnUpdateId,
                        "${action == 'RETURN'}"));
                flows.add(flow("flow_return_" + key + "_to_notify", returnUpdateId, returnNotifyId));
                flows.add(flow("flow_return_from_" + key, returnNotifyId, prevStep.getStepKey() + "_task"));
            } else {
                // SUBMITTER return — revision task
                String returnUpdateId = "update_status_returned_" + key;
                String returnNotifyId = "notify_return_" + key;
                String revisionId = "revision_from_" + key;
                String gwRevisionId = "gw_revision_" + key;

                elements.add(serviceTask(returnUpdateId, "Cập nhật RETURNED (" + key.toUpperCase() + ")",
                        "${updateEntryStatusDelegate}", "targetStatus", EntryStatus.RETURNED,
                        List.of("flow_" + key + "_return"),
                        List.of("flow_return_" + key + "_to_notify")));

                elements.add(notifyTask(returnNotifyId, "Thông báo trả lại (" + key.toUpperCase() + ")",
                        "SUBMITTER",
                        "Phiên nhập liệu bị trả lại bởi " + step.getStepName(),
                        List.of("flow_return_" + key + "_to_notify"),
                        List.of("flow_notify_return_" + key + "_to_revision")));

                elements.add(revisionUserTask(revisionId, "Chỉnh sửa lại (từ " + key.toUpperCase() + ")",
                        List.of("flow_notify_return_" + key + "_to_revision"),
                        List.of("flow_revision_" + key + "_to_gw")));

                elements.add(exclusiveGateway(gwRevisionId, "Gửi lại hay hủy?",
                        List.of("flow_revision_" + key + "_to_gw"),
                        List.of("flow_revision_" + key + "_resubmit", "flow_revision_" + key + "_cancel")));

                flows.add(conditionFlow("flow_" + key + "_return", gwId, returnUpdateId,
                        "${action == 'RETURN'}"));
                flows.add(flow("flow_return_" + key + "_to_notify", returnUpdateId, returnNotifyId));
                flows.add(flow("flow_notify_return_" + key + "_to_revision", returnNotifyId, revisionId));
                flows.add(flow("flow_revision_" + key + "_to_gw", revisionId, gwRevisionId));
                // Resubmit goes back to first step notification
                flows.add(conditionFlow("flow_revision_" + key + "_resubmit", gwRevisionId,
                        "notify_" + first.getStepKey(), "${action == 'RESUBMIT'}"));
                // Cancel goes to rejected
                flows.add(conditionFlow("flow_revision_" + key + "_cancel", gwRevisionId,
                        "update_status_rejected", "${action == 'CANCEL'}"));
            }
        }

        // === FINAL APPROVED ===
        WorkflowStep lastStep = steps.get(steps.size() - 1);
        elements.add(serviceTask("update_status_approved", "Cập nhật APPROVED",
                "${updateEntryStatusDelegate}", "targetStatus", EntryStatus.APPROVED,
                List.of("flow_" + lastStep.getStepKey() + "_approve"),
                List.of("flow_approved_to_notify_done")));

        elements.add(notifyTask("notify_approved", "Thông báo hoàn thành",
                "SUBMITTER", "Phiên nhập liệu đã được phê duyệt hoàn thành",
                List.of("flow_approved_to_notify_done"),
                List.of("flow_notify_done_to_end")));

        elements.add(endEvent("end_approved", "Đã phê duyệt", "flow_notify_done_to_end"));

        flows.add(flow("flow_approved_to_notify_done", "update_status_approved", "notify_approved"));
        flows.add(flow("flow_notify_done_to_end", "notify_approved", "end_approved"));

        // === SHARED REJECTED ===
        // Collect all incoming reject flows
        List<String> rejectIncoming = steps.stream()
                .map(s -> "flow_" + s.getStepKey() + "_reject")
                .collect(Collectors.toList());
        // Add cancel flows from SUBMITTER revision gateways
        for (WorkflowStep step : steps) {
            String rt = step.getReturnTarget() != null ? step.getReturnTarget() : "SUBMITTER";
            if ("SUBMITTER".equals(rt) || (steps.indexOf(step) == 0)) {
                rejectIncoming.add("flow_revision_" + step.getStepKey() + "_cancel");
            }
        }

        elements.add(serviceTask("update_status_rejected", "Cập nhật REJECTED",
                "${updateEntryStatusDelegate}", "targetStatus", EntryStatus.REJECTED,
                rejectIncoming,
                List.of("flow_rejected_to_notify")));

        elements.add(notifyTask("notify_rejected", "Thông báo từ chối",
                "SUBMITTER", "Phiên nhập liệu đã bị từ chối",
                List.of("flow_rejected_to_notify"),
                List.of("flow_notify_reject_to_end")));

        elements.add(endEvent("end_rejected", "Đã từ chối", "flow_notify_reject_to_end"));

        flows.add(flow("flow_rejected_to_notify", "update_status_rejected", "notify_rejected"));
        flows.add(flow("flow_notify_reject_to_end", "notify_rejected", "end_rejected"));

        // === BUILD XML ===
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<definitions xmlns=\"http://www.omg.org/spec/BPMN/20100524/MODEL\"\n");
        xml.append("             xmlns:bpmndi=\"http://www.omg.org/spec/BPMN/20100524/DI\"\n");
        xml.append("             xmlns:omgdc=\"http://www.omg.org/spec/DD/20100524/DC\"\n");
        xml.append("             xmlns:omgdi=\"http://www.omg.org/spec/DD/20100524/DI\"\n");
        xml.append("             xmlns:camunda=\"http://camunda.org/schema/1.0/bpmn\"\n");
        xml.append("             xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n");
        xml.append("             targetNamespace=\"http://evnnpc.vn/workflow\">\n\n");
        xml.append("  <process id=\"").append(esc(processId)).append("\" name=\"").append(esc(processName))
                .append("\" isExecutable=\"true\" camunda:historyTimeToLive=\"365\">\n\n");

        for (String el : elements) {
            xml.append(el).append("\n");
        }

        xml.append("    <!-- SEQUENCE FLOWS -->\n");
        for (String fl : flows) {
            xml.append(fl).append("\n");
        }

        xml.append("\n  </process>\n\n");

        // === BPMN DI (auto-layout) ===
        xml.append(generateDiagram(processId, steps));

        xml.append("</definitions>\n");

        return xml.toString();
    }

    /**
     * Generate BPMN DI diagram with auto-layout coordinates.
     * Main approval flow runs left-to-right at y=280.
     * Return flows drop down below each gateway.
     * Rejected path at the bottom.
     */
    private String generateDiagram(String processId, List<WorkflowStep> steps) {
        StringBuilder di = new StringBuilder();
        di.append("  <bpmndi:BPMNDiagram id=\"BPMNDiagram_1\">\n");
        di.append("    <bpmndi:BPMNPlane id=\"BPMNPlane_1\" bpmnElement=\"").append(processId).append("\">\n\n");

        int mainY = 280;   // center Y for main flow
        int taskW = 100, taskH = 80;
        int gwSize = 50;
        int eventSize = 36;
        int gap = 50;      // horizontal gap between elements

        // Track x position as we go
        int x = 160;

        // Start event
        di.append(shape("start", x, mainY, eventSize, eventSize));
        x += eventSize + gap;

        // update_status_submitted
        di.append(shape("update_status_submitted", x, mainY - taskH / 2, taskW, taskH));
        x += taskW + gap;

        // notify first step
        String firstKey = steps.get(0).getStepKey();
        di.append(shape("notify_" + firstKey, x, mainY - taskH / 2, taskW, taskH));
        x += taskW + gap;

        // For each step: userTask → updateStatus → gateway
        Map<String, Integer> gwXPositions = new LinkedHashMap<>();
        for (int i = 0; i < steps.size(); i++) {
            WorkflowStep step = steps.get(i);
            String key = step.getStepKey();
            boolean isLast = (i == steps.size() - 1);

            // UserTask
            di.append(shape(key + "_task", x, mainY - taskH / 2, taskW, taskH));
            x += taskW + gap;

            // Update status
            di.append(shape("update_status_" + key, x, mainY - taskH / 2, taskW, taskH));
            x += taskW + gap;

            // Gateway
            int gwX = x;
            di.append(shape("gw_" + key, gwX, mainY - gwSize / 2, gwSize, gwSize));
            gwXPositions.put(key, gwX);
            x += gwSize + gap;

            // If not last, add notify for next step
            if (!isLast) {
                WorkflowStep next = steps.get(i + 1);
                di.append(shape("notify_" + next.getStepKey(), x, mainY - taskH / 2, taskW, taskH));
                x += taskW + gap;
            }

            // Return elements below gateway
            String returnTarget = step.getReturnTarget() != null ? step.getReturnTarget() : "SUBMITTER";
            int retX = gwX - 15; // align under gateway
            int retY = mainY + 100;

            di.append(shape("update_status_returned_" + key, retX, retY, taskW, taskH));
            di.append(shape("notify_return_" + key, retX, retY + 120, taskW, taskH));

            if ("SUBMITTER".equals(returnTarget) || i == 0) {
                di.append(shape("revision_from_" + key, retX, retY + 240, taskW, taskH));
                di.append(shape("gw_revision_" + key, retX + 25, retY + 360, gwSize, gwSize));
            }
        }

        // Final approved
        di.append(shape("update_status_approved", x, mainY - taskH / 2, taskW, taskH));
        x += taskW + gap;
        di.append(shape("notify_approved", x, mainY - taskH / 2, taskW, taskH));
        x += taskW + gap;
        di.append(shape("end_approved", x, mainY, eventSize, eventSize));

        // Rejected path at bottom
        int rejY = mainY + 550;
        int rejX = x / 2; // center-ish
        di.append(shape("update_status_rejected", rejX, rejY, taskW, taskH));
        di.append(shape("notify_rejected", rejX + taskW + gap, rejY, taskW, taskH));
        di.append(shape("end_rejected", rejX + 2 * (taskW + gap), rejY + taskH / 2 - eventSize / 2, eventSize, eventSize));

        di.append("\n    </bpmndi:BPMNPlane>\n");
        di.append("  </bpmndi:BPMNDiagram>\n\n");
        return di.toString();
    }

    private String shape(String id, int x, int y, int w, int h) {
        return "      <bpmndi:BPMNShape id=\"" + id + "_di\" bpmnElement=\"" + id + "\">\n"
                + "        <omgdc:Bounds x=\"" + x + "\" y=\"" + y + "\" width=\"" + w + "\" height=\"" + h + "\" />\n"
                + "      </bpmndi:BPMNShape>\n";
    }

    private void validate(List<WorkflowStep> steps) {
        if (steps == null || steps.isEmpty()) {
            throw new RuntimeException("Quy trình phải có ít nhất 1 bước");
        }

        // First step cannot be PREVIOUS_STEP
        if ("PREVIOUS_STEP".equals(steps.get(0).getReturnTarget())) {
            throw new RuntimeException("Bước đầu tiên không thể có returnTarget = PREVIOUS_STEP");
        }

        // Unique stepKeys
        Set<String> keys = new HashSet<>();
        for (WorkflowStep step : steps) {
            if (!keys.add(step.getStepKey())) {
                throw new RuntimeException("stepKey trùng lặp: " + step.getStepKey());
            }
        }

        // Sequential stepOrder
        for (int i = 0; i < steps.size(); i++) {
            if (steps.get(i).getStepOrder() != i + 1) {
                throw new RuntimeException("stepOrder phải tuần tự từ 1. Bước " + (i + 1) + " có stepOrder=" + steps.get(i).getStepOrder());
            }
        }
    }

    // === XML Helpers ===

    private String startEvent(String id, String name, String outgoing) {
        return "    <startEvent id=\"" + esc(id) + "\" name=\"" + esc(name) + "\">\n"
                + "      <outgoing>" + outgoing + "</outgoing>\n"
                + "    </startEvent>\n";
    }

    private String endEvent(String id, String name, String incoming) {
        return "    <endEvent id=\"" + esc(id) + "\" name=\"" + esc(name) + "\">\n"
                + "      <incoming>" + incoming + "</incoming>\n"
                + "    </endEvent>\n";
    }

    private String serviceTask(String id, String name, String delegate,
                                String fieldName, String fieldValue,
                                List<String> incoming, List<String> outgoing) {
        StringBuilder sb = new StringBuilder();
        sb.append("    <serviceTask id=\"").append(esc(id)).append("\" name=\"").append(esc(name)).append("\"\n");
        sb.append("                 camunda:delegateExpression=\"").append(delegate).append("\">\n");
        sb.append("      <extensionElements>\n");
        sb.append("        <camunda:field name=\"").append(fieldName).append("\" stringValue=\"").append(esc(fieldValue)).append("\" />\n");
        sb.append("      </extensionElements>\n");
        for (String inc : incoming) {
            sb.append("      <incoming>").append(inc).append("</incoming>\n");
        }
        for (String out : outgoing) {
            sb.append("      <outgoing>").append(out).append("</outgoing>\n");
        }
        sb.append("    </serviceTask>\n");
        return sb.toString();
    }

    private String notifyTask(String id, String name, String targetGroup, String message,
                               List<String> incoming, List<String> outgoing) {
        StringBuilder sb = new StringBuilder();
        sb.append("    <serviceTask id=\"").append(esc(id)).append("\" name=\"").append(esc(name)).append("\"\n");
        sb.append("                 camunda:delegateExpression=\"${taskNotificationDelegate}\">\n");
        sb.append("      <extensionElements>\n");
        sb.append("        <camunda:field name=\"targetGroup\" stringValue=\"").append(esc(targetGroup)).append("\" />\n");
        sb.append("        <camunda:field name=\"message\" stringValue=\"").append(esc(message)).append("\" />\n");
        sb.append("      </extensionElements>\n");
        for (String inc : incoming) {
            sb.append("      <incoming>").append(inc).append("</incoming>\n");
        }
        for (String out : outgoing) {
            sb.append("      <outgoing>").append(out).append("</outgoing>\n");
        }
        sb.append("    </serviceTask>\n");
        return sb.toString();
    }

    private String userTask(String id, String name, String candidateGroups,
                             List<String> incoming, List<String> outgoing) {
        StringBuilder sb = new StringBuilder();
        sb.append("    <userTask id=\"").append(esc(id)).append("\" name=\"").append(esc(name)).append("\"\n");
        sb.append("              camunda:candidateGroups=\"").append(esc(candidateGroups)).append("\">\n");
        for (String inc : incoming) {
            sb.append("      <incoming>").append(inc).append("</incoming>\n");
        }
        for (String out : outgoing) {
            sb.append("      <outgoing>").append(out).append("</outgoing>\n");
        }
        sb.append("    </userTask>\n");
        return sb.toString();
    }

    private String revisionUserTask(String id, String name,
                                     List<String> incoming, List<String> outgoing) {
        StringBuilder sb = new StringBuilder();
        sb.append("    <userTask id=\"").append(esc(id)).append("\" name=\"").append(esc(name)).append("\"\n");
        sb.append("              camunda:assignee=\"${submittedBy}\">\n");
        for (String inc : incoming) {
            sb.append("      <incoming>").append(inc).append("</incoming>\n");
        }
        for (String out : outgoing) {
            sb.append("      <outgoing>").append(out).append("</outgoing>\n");
        }
        sb.append("    </userTask>\n");
        return sb.toString();
    }

    private String exclusiveGateway(String id, String name,
                                     List<String> incoming, List<String> outgoing) {
        StringBuilder sb = new StringBuilder();
        sb.append("    <exclusiveGateway id=\"").append(esc(id)).append("\" name=\"").append(esc(name)).append("\">\n");
        for (String inc : incoming) {
            sb.append("      <incoming>").append(inc).append("</incoming>\n");
        }
        for (String out : outgoing) {
            sb.append("      <outgoing>").append(out).append("</outgoing>\n");
        }
        sb.append("    </exclusiveGateway>\n");
        return sb.toString();
    }

    private String flow(String id, String sourceRef, String targetRef) {
        return "    <sequenceFlow id=\"" + id + "\" sourceRef=\"" + sourceRef + "\" targetRef=\"" + targetRef + "\" />";
    }

    private String conditionFlow(String id, String sourceRef, String targetRef, String condition) {
        return "    <sequenceFlow id=\"" + id + "\" sourceRef=\"" + sourceRef + "\" targetRef=\"" + targetRef + "\">\n"
                + "      <conditionExpression xsi:type=\"tFormalExpression\">" + condition + "</conditionExpression>\n"
                + "    </sequenceFlow>";
    }

    private String esc(String val) {
        if (val == null) return "";
        return val.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }
}
