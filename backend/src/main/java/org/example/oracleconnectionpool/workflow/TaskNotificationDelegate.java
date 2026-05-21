package org.example.oracleconnectionpool.workflow;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.camunda.bpm.engine.delegate.DelegateExecution;
import org.camunda.bpm.engine.delegate.Expression;
import org.camunda.bpm.engine.delegate.JavaDelegate;
import org.camunda.bpm.engine.RepositoryService;
import org.camunda.bpm.model.bpmn.BpmnModelInstance;
import org.camunda.bpm.model.bpmn.instance.FlowElement;
import org.example.oracleconnectionpool.constant.NotificationType;
import org.example.oracleconnectionpool.entity.GridTemplate;
import org.example.oracleconnectionpool.entity.Notification;
import org.example.oracleconnectionpool.entity.WorkflowDefinition;
import org.example.oracleconnectionpool.entity.WorkflowStep;
import org.example.oracleconnectionpool.repository.AppUserRepository;
import org.example.oracleconnectionpool.repository.GridTemplateRepository;
import org.example.oracleconnectionpool.repository.WorkflowDefinitionRepository;
import org.example.oracleconnectionpool.repository.WorkflowStepCandidateRepository;
import org.example.oracleconnectionpool.repository.WorkflowStepRepository;
import org.example.oracleconnectionpool.service.NotificationService;
import org.example.oracleconnectionpool.service.TemplateAccessService;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.Locale;

@Slf4j
@Component("taskNotificationDelegate")
@RequiredArgsConstructor
public class TaskNotificationDelegate implements JavaDelegate {

    private final NotificationService notificationService;
    private final TemplateAccessService templateAccessService;
    private final GridTemplateRepository gridTemplateRepository;
    private final WorkflowDefinitionRepository workflowDefinitionRepository;
    private final WorkflowStepRepository workflowStepRepository;
    private final WorkflowStepCandidateRepository workflowStepCandidateRepository;
    private final AppUserRepository appUserRepository;
    private final RepositoryService repositoryService;

    /** Backward compat: targetGroup: "SUBMITTER" hoặc stepKey (vd: "bkh", "tgd") */
    private Expression targetGroup;

    private Expression message;

    private static final String NS_EXCELPRO = "http://evnnpc.vn/workflow/excelpro";

    @Override
    public void execute(DelegateExecution execution) throws Exception {
        String group = (String) targetGroup.getValue(execution);
        String msg = (String) message.getValue(execution);
        Long entryId = (Long) execution.getVariable("entryId");
        Long templateId = (Long) execution.getVariable("templateId");
        String submittedBy = (String) execution.getVariable("submittedBy");

        // Lấy tên template làm tiêu đề thông báo
        String title = gridTemplateRepository.findById(templateId)
                .map(GridTemplate::getName)
                .orElse("Phê duyệt biểu mẫu");
        String targetUrl = "/excel-render?templateId=" + templateId + "&entryId=" + entryId;

        Set<String> usernamesToNotify = resolveUsernamesFromExcelproCandidates(execution);

        if (!usernamesToNotify.isEmpty()) {
            for (String username : usernamesToNotify) {
                sendNotification(username, title, msg, targetUrl);
            }
            log.info("Sent notification to excelpro candidates ({} users) for entryId={}", usernamesToNotify.size(), entryId);
            return;
        }

        // If excelpro:Candidates container exists but results Sent notification to excelpro candidatesempty => send to nobody (do not fallback)
        if (hasExcelproCandidatesContainer(execution)) {
            log.info("Notify task has excelpro:Candidates but no valid pairs resolved; skip sending");
            return;
        }

        if ("SUBMITTER".equals(group)) {
            sendNotification(submittedBy, title, msg, targetUrl);
            log.info("Sent notification to SUBMITTER={} for entryId={}", submittedBy, entryId);
            return;
        }

        List<String> usernames = resolveUsersByStepKey(execution, group, templateId);
        for (String username : usernames) {
            sendNotification(username, title, msg, targetUrl);
        }
        log.info("Sent notification to stepKey={} ({} users) for entryId={}", group, usernames.size(), entryId);
    }

    private boolean hasExcelproCandidatesContainer(DelegateExecution execution) {
        BpmnModelInstance model = getModel(execution);
        if (model == null) return false;
        FlowElement el = model.getModelElementById(execution.getCurrentActivityId());
        if (el == null) return false;
        var ext = el.getExtensionElements();
        if (ext == null) return false;
        return ext.getElements().stream().anyMatch(e -> e != null && "candidates".equalsIgnoreCase(e.getElementType().getTypeName())
                && "http://evnnpc.vn/workflow/excelpro".equals(e.getElementType().getTypeNamespace()));
    }

    private Set<String> resolveUsernamesFromExcelproCandidates(DelegateExecution execution) {
        String activityId = execution != null ? execution.getCurrentActivityId() : null;
        String procDefId = execution != null ? execution.getProcessDefinitionId() : null;
        log.info("[notify.resolveCandidates] start activityId={}, processDefinitionId={}", activityId, procDefId);

        BpmnModelInstance model = getModel(execution);
        if (model == null) {
            return Set.of();
        }

        try {
            var pd = repositoryService.getProcessDefinition(procDefId);
            String resourceName = pd != null ? pd.getResourceName() : null;
            log.info("[notify.resolveCandidates] ProcessDefinition resourceName={}", resourceName);

            try (var in = repositoryService.getProcessModel(procDefId)) {
                if (in != null) {
                    String xml = new String(in.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
                    log.info("[notify.resolveCandidates] BPMN XML dump(from engine) for procDefId={} (resourceName={}, len={}):\n{}",
                            procDefId,
                            resourceName,
                            xml.length(),
                            xml);
                } else {
                    log.warn("[notify.resolveCandidates] repositoryService.getProcessModel returned null for procDefId={}", procDefId);
                }
            }
        } catch (Exception ex) {
            log.warn("[notify.resolveCandidates] Cannot dump BPMN XML from engine: {}", ex.getMessage());
        }

        FlowElement el = model.getModelElementById(activityId);
        if (el == null) {
            log.warn("[notify.resolveCandidates] cannot find FlowElement by id={} -> return empty", activityId);
            return Set.of();
        }
        log.info(
                "[notify.resolveCandidates] FlowElement found: id={}, type={}, ns={}, class={}",
                el.getId(),
                el.getElementType() != null ? el.getElementType().getTypeName() : "<unknown>",
                el.getElementType() != null ? el.getElementType().getTypeNamespace() : "<unknown>",
                el.getClass().getName()
        );

        var ext = el.getExtensionElements();
        if (ext == null) {
            log.info("[notify.resolveCandidates] no extensionElements on activityId={} -> return empty", activityId);
            return Set.of();
        }

        var extEls = ext.getElements();
        log.info("[notify.resolveCandidates] extensionElements count={} on activityId={}", extEls != null ? extEls.size() : 0, activityId);

        Set<String> usernames = new LinkedHashSet<>();
        int candidatesContainers = 0;
        int candidateNodes = 0;

        for (var any : extEls) {
            if (any == null) continue;

            String ns = any.getElementType() != null ? any.getElementType().getTypeNamespace() : null;
            String typeName = any.getElementType() != null ? any.getElementType().getTypeName() : null;
            log.info("[notify.resolveCandidates] ext element: type='{}', ns='{}'", typeName, ns);

            // EXTRA DIAGNOSTIC: dom name for extension element
            try {
                var domAny = any.getDomElement();
                if (domAny != null) {
                    log.info("[notify.resolveCandidates] ext element dom: name='{}', nsUri='{}'", domAny.getLocalName(), domAny.getNamespaceURI());
                } else {
                    log.info("[notify.resolveCandidates] ext element dom: <null>");
                }
            } catch (Exception ignore) {
                log.info("[notify.resolveCandidates] ext element dom: <error reading dom>");
            }

            if (!NS_EXCELPRO.equals(ns)) {
                log.info("[notify.resolveCandidates] skip ext element because namespace != excelpro");
                continue;
            }
            if (!"candidates".equalsIgnoreCase(typeName)) {
                log.info("[notify.resolveCandidates] skip ext element because type != candidates");
                continue;
            }

            candidatesContainers++;

            // Parse ONLY by DOM children
            try {
                var dom = any.getDomElement();
                var domChildren = dom != null ? dom.getChildElements() : null;
                log.info("[notify.resolveCandidates] candidates dom childElements count={}", domChildren != null ? domChildren.size() : 0);

                if (domChildren != null) {
                    int idx = 0;
                    for (var d : domChildren) {
                        if (d == null) continue;

                        log.info("[notify.resolveCandidates]  domChild[{}]: name='{}', nsUri='{}', orgCode='{}', positionCode='{}'",
                                idx++,
                                d.getLocalName(),
                                d.getNamespaceURI(),
                                d.getAttribute("orgCode"),
                                d.getAttribute("positionCode"));

                        if (!NS_EXCELPRO.equals(d.getNamespaceURI())) continue;
                        if (!"candidate".equalsIgnoreCase(d.getLocalName())) continue;

                        candidateNodes++;

                        String orgCode = normalizeUpperOrNull(d.getAttribute("orgCode"));
                        String positionCode = normalizeUpperOrNull(d.getAttribute("positionCode"));
                        log.info("[notify.resolveCandidates]  candidate attrs(dom): orgCode='{}', positionCode='{}'", orgCode, positionCode);

                        if (orgCode == null && positionCode == null) {
                            log.warn("[notify.resolveCandidates]  skip candidate(dom) because both orgCode and positionCode are null");
                            continue;
                        }

                        List<String> found = appUserRepository.findActiveUsernamesForNotification(orgCode, positionCode);
                        log.info("[notify.resolveCandidates]  repo.findActiveUsernamesForNotification({}, {}) -> {} users", orgCode, positionCode, found != null ? found.size() : 0);
                        if (found != null && !found.isEmpty()) {
                            log.info("[notify.resolveCandidates]  found usernames={}", found);
                            usernames.addAll(found);
                        }
                    }
                }
            } catch (Exception ex) {
                log.warn("[notify.resolveCandidates] DOM parse failed: {}", ex.getMessage());
            }
        }

        log.info("[notify.resolveCandidates] done. candidatesContainers={}, candidateNodes={}, uniqueUsernames={}", candidatesContainers, candidateNodes, usernames.size());
        if (!usernames.isEmpty()) {
            log.info("[notify.resolveCandidates] resolved usernames={}", usernames);
        }

        return usernames;
    }

    private BpmnModelInstance getModel(DelegateExecution execution) {
        try {
            String processDefinitionId = execution.getProcessDefinitionId();
            if (processDefinitionId == null) return null;
            return repositoryService.getBpmnModelInstance(processDefinitionId);
        } catch (Exception e) {
            log.warn("Cannot load BPMN model for notification recipients: {}", e.getMessage());
            return null;
        }
    }

    private String normalizeUpperOrNull(String s) {
        if (s == null || s.isBlank()) return null;
        return s.trim().toUpperCase(Locale.ROOT);
    }

    private List<String> resolveUsersByStepKey(DelegateExecution execution, String stepKey, Long templateId) {
        // Lấy workflowKey từ processDefinitionId
        String processDefId = execution.getProcessDefinitionId();
        String workflowKey = processDefId != null ? processDefId.split(":")[0] : null;
        if (workflowKey == null) return List.of();

        WorkflowDefinition wfDef = workflowDefinitionRepository.findByWorkflowKey(workflowKey).orElse(null);
        if (wfDef == null) return List.of();

        // Tìm step theo stepKey
        return workflowStepRepository.findByWorkflowDefinitionIdAndStepKey(wfDef.getId(), stepKey)
                .map(step -> workflowStepCandidateRepository.findEligibleUsernames(step.getId()))
                .orElseGet(() -> {
                    // Fallback: thử dùng group như candidateActionKey → TEMPLATE_ACCESS (backward compat)
                    log.warn("Step '{}' not found in workflow '{}', fallback to TEMPLATE_ACCESS", stepKey, workflowKey);
                    return templateAccessService.findEligibleUsernames(templateId, stepKey);
                });
    }

    public void sendNotification(String userId, String title, String msg, String targetUrl) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setTitle(title);
        notification.setContent(msg);
        notification.setType(NotificationType.NOTIFICATION);
        notification.setTargetUrl(targetUrl);
        notification.setCreatedAt(LocalDateTime.now());
        notificationService.sendNotification(notification);
    }
}
