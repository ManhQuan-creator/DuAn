package org.example.oracleconnectionpool.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.camunda.bpm.engine.HistoryService;
import org.camunda.bpm.engine.RuntimeService;
import org.camunda.bpm.engine.TaskService;
import org.camunda.bpm.engine.history.HistoricDetail;
import org.camunda.bpm.engine.history.HistoricVariableUpdate;
import org.camunda.bpm.engine.history.HistoricTaskInstance;
import org.camunda.bpm.engine.history.HistoricVariableInstance;
import org.camunda.bpm.engine.runtime.ProcessInstance;
import org.camunda.bpm.engine.task.Task;
import org.example.oracleconnectionpool.constant.EntryStatus;
import org.example.oracleconnectionpool.entity.AppUser;
import org.example.oracleconnectionpool.entity.GridDataEntry;
import org.example.oracleconnectionpool.entity.GridTemplate;
import org.example.oracleconnectionpool.entity.WorkflowDefinition;
import org.example.oracleconnectionpool.entity.WorkflowStep;
import org.example.oracleconnectionpool.entity.WorkflowSubmitterCandidate;
import org.example.oracleconnectionpool.model.response.WorkflowHistoryResponse;
import org.example.oracleconnectionpool.model.response.WorkflowTaskResponse;
import org.example.oracleconnectionpool.repository.AppUserRepository;
import org.example.oracleconnectionpool.repository.GridDataEntryRepository;
import org.example.oracleconnectionpool.repository.GridTemplateRepository;
import org.example.oracleconnectionpool.repository.WorkflowDefinitionRepository;
import org.example.oracleconnectionpool.repository.WorkflowStepCandidateRepository;
import org.example.oracleconnectionpool.repository.WorkflowStepRepository;
import org.example.oracleconnectionpool.repository.WorkflowSubmitterCandidateRepository;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.example.oracleconnectionpool.workflow.action.WorkflowAction;
import org.example.oracleconnectionpool.workflow.action.WorkflowActionContext;
import org.example.oracleconnectionpool.workflow.action.WorkflowActionDispatcher;
import org.example.oracleconnectionpool.workflow.action.WorkflowActionResult;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowService {

    private final RuntimeService runtimeService;
    private final TaskService taskService;
    private final HistoryService historyService;
    private final GridDataEntryRepository entryRepository;
    private final GridTemplateRepository templateRepository;
    private final TemplateAccessService templateAccessService;
    private final AppUserRepository appUserRepository;
    private final WorkflowDefinitionRepository workflowDefinitionRepository;
    private final WorkflowStepRepository workflowStepRepository;
    private final WorkflowStepCandidateRepository workflowStepCandidateRepository;
    private final WorkflowSubmitterCandidateRepository workflowSubmitterCandidateRepository;
    private final WorkflowActionDispatcher workflowActionDispatcher;

    /**
     * Submit entry for approval — starts a Camunda process instance.
     * Sau khi start, gán candidate users cho task đầu tiên từ TEMPLATE_PERMISSION.
     */
    @Transactional
    public void submitEntry(Long templateId, Long entryId, AppUserDetails user) {
        GridDataEntry entry = entryRepository.findById(entryId)
                .orElseThrow(() -> new RuntimeException("Entry không tồn tại: " + entryId));

        if (!entry.getTemplateId().equals(templateId)) {
            throw new RuntimeException("Entry không thuộc template " + templateId);
        }
        if (!EntryStatus.DRAFT.equals(entry.getStatus()) && !EntryStatus.RETURNED.equals(entry.getStatus())) {
            throw new RuntimeException("Chỉ có thể gửi phê duyệt entry ở trạng thái DRAFT hoặc RETURNED");
        }

        GridTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() -> new RuntimeException("Template không tồn tại: " + templateId));
        String processKey = template.getProcessDefinitionKey();
        if (processKey == null || processKey.isBlank()) {
            throw new RuntimeException("Template chưa được gán quy trình phê duyệt");
        }

        // Kiểm tra quyền SUBMIT từ WORKFLOW_SUBMITTER_CANDIDATE
        WorkflowDefinition wfDef = workflowDefinitionRepository.findByWorkflowKey(processKey).orElse(null);
        if (wfDef != null) {
            AppUser appUser = appUserRepository.findByUsername(user.getUsername()).orElse(null);
            if (appUser == null) {
                throw new RuntimeException("Không tìm thấy user: " + user.getUsername());
            }
            // Nếu có khai báo submitter candidates, kiểm tra quyền
            List<WorkflowSubmitterCandidate> submitterRules =
                    workflowSubmitterCandidateRepository.findByWorkflowDefinitionId(wfDef.getId());
            if (!submitterRules.isEmpty()) {
                boolean hasAccess = workflowSubmitterCandidateRepository.hasSubmitAccess(
                        wfDef.getId(),
                        appUser.getDeptCode() != null ? appUser.getDeptCode() : "",
                        appUser.getPositionCode() != null ? appUser.getPositionCode() : ""
                );
                if (!hasAccess) {
                    throw new RuntimeException("Bạn không có quyền gửi phê duyệt cho quy trình này");
                }
            }
            // Nếu chưa khai báo submitter candidates → cho phép tất cả (backward compatible)
        }

        Map<String, Object> variables = new HashMap<>();
        variables.put("entryId", entryId);
        variables.put("templateId", templateId);
        variables.put("orgCode", entry.getOrgCode());
        variables.put("submittedBy", user.getUsername());

        ProcessInstance processInstance = runtimeService.startProcessInstanceByKey(
                processKey, "entry-" + entryId, variables);

        entry.setProcessInstanceId(processInstance.getId());
        entry.setSubmittedBy(user.getUsername());
        entry.setSubmittedAt(LocalDateTime.now());
        entryRepository.save(entry);

        // Gán candidate users cho các Camunda task vừa tạo
        assignCandidatesToOpenTasks(processInstance.getId(), templateId, processKey);

        log.info("Started approval process for entry={} by={}, processInstanceId={}",
                entryId, user.getUsername(), processInstance.getId());
    }

    /**
     * Kiểm tra user có quyền gửi duyệt cho template này không.
     * Frontend gọi để quyết định hiển thị nút "Gửi duyệt".
     */
    public boolean canSubmit(Long templateId, AppUserDetails user) {
        GridTemplate template = templateRepository.findById(templateId).orElse(null);
        if (template == null || template.getProcessDefinitionKey() == null) return false;

        WorkflowDefinition wfDef = workflowDefinitionRepository
                .findByWorkflowKey(template.getProcessDefinitionKey()).orElse(null);
        if (wfDef == null) return false;

        List<WorkflowSubmitterCandidate> rules =
                workflowSubmitterCandidateRepository.findByWorkflowDefinitionId(wfDef.getId());
        if (rules.isEmpty()) return true; // Chưa cấu hình → cho phép tất cả

        AppUser appUser = appUserRepository.findByUsername(user.getUsername()).orElse(null);
        if (appUser == null) return false;

        return workflowSubmitterCandidateRepository.hasSubmitAccess(
                wfDef.getId(),
                appUser.getDeptCode() != null ? appUser.getDeptCode() : "",
                appUser.getPositionCode() != null ? appUser.getPositionCode() : ""
        );
    }

    /**
     * Complete a task — kiểm tra quyền từ TEMPLATE_PERMISSION thay vì APP_ROLE.
     */
    @Transactional
    public WorkflowActionResult completeTask(String taskId, String action, String comment, AppUserDetails user) {
        Task task = taskService.createTaskQuery().taskId(taskId).singleResult();
        if (task == null) {
            throw new RuntimeException("Task không tồn tại: " + taskId);
        }

        // Kiểm tra quyền: assigned trực tiếp, hoặc là candidate user
        boolean isAssignee = user.getUsername().equals(task.getAssignee());
        boolean isCandidate = !taskService.createTaskQuery()
                .taskId(taskId)
                .taskCandidateUser(user.getUsername())
                .list().isEmpty();

        // Fallback: kiểm tra WORKFLOW_STEP_CANDIDATE nếu chưa được gán (task mới)
        boolean hasPermission = isAssignee || isCandidate;
        if (!hasPermission) {
            Long templateId = (Long) taskService.getVariable(taskId, "templateId");
            String processKey = getProcessKey(task.getProcessInstanceId());
            if (processKey != null) {
                WorkflowDefinition wfDef = workflowDefinitionRepository.findByWorkflowKey(processKey).orElse(null);
                if (wfDef != null) {
                    List<WorkflowStep> allSteps = workflowStepRepository
                            .findByWorkflowDefinitionIdOrderByStepOrderAsc(wfDef.getId());
                    Optional<WorkflowStep> stepOpt = resolveWorkflowStep(
                            task.getTaskDefinitionKey(), wfDef.getId(), allSteps);
                    if (stepOpt.isPresent()) {
                        List<String> eligible = workflowStepCandidateRepository
                                .findEligibleUsernames(stepOpt.get().getId());
                        hasPermission = eligible.contains(user.getUsername());
                    }
                }
            }
            // Fallback cũ: TEMPLATE_ACCESS (tương thích ngược)
            if (!hasPermission && templateId != null) {
                String candidateActionKey = resolveCandidateActionKey(task, templateId);
                if (candidateActionKey != null) {
                    AppUser appUser = appUserRepository.findByUsername(user.getUsername()).orElse(null);
                    hasPermission = appUser != null &&
                            templateAccessService.hasAccessForUser(templateId, candidateActionKey, appUser);
                }
            }
        }

        if (!hasPermission) {
            throw new RuntimeException("Bạn không có quyền xử lý task này");
        }

        if (("RETURN".equals(action) || "REJECT".equals(action))
                && (comment == null || comment.isBlank())) {
            throw new RuntimeException("Ghi chú là bắt buộc khi trả lại hoặc từ chối");
        }

        if (task.getAssignee() == null) {
            taskService.claim(taskId, user.getUsername());
        }

        // Đọc variables TRƯỚC khi complete (complete sẽ xóa task)
        Long templateId = (Long) taskService.getVariable(taskId, "templateId");
        String processInstanceId = task.getProcessInstanceId();

        // Lưu action/comment vào task-local variable (cho history từng task)
        taskService.setVariableLocal(taskId, "action", action);
        taskService.setVariableLocal(taskId, "comment", comment != null ? comment : "");

        // Lưu vào process variable (cho BPMN gateway condition ${action == 'APPROVE'})
        Map<String, Object> variables = new HashMap<>();
        variables.put("action", action);
        variables.put("comment", comment != null ? comment : "");

        // === HYBRID ACTION HANDLER DISPATCH ===
        // Resolve step tương ứng với task rồi gọi handler đã cấu hình (nếu có).
        // Chạy TRƯỚC taskService.complete() để nằm trong cùng @Transactional —
        // handler throw → rollback cả Camunda. Kết quả (vd redirectUrl) sẽ được trả lên FE.
        WorkflowActionResult handlerResult = dispatchActionHandler(
                task, action, comment, user, templateId, processInstanceId);

        taskService.complete(taskId, variables);

        // Sau khi complete, gán candidates cho task tiếp theo nếu có
        if (templateId != null) {
            String processKey = getProcessKey(processInstanceId);
            if (processKey != null) {
                assignCandidatesToOpenTasks(processInstanceId, templateId, processKey);
            }
        }

        log.info("Task {} completed by {} with action={}", taskId, user.getUsername(), action);
        return handlerResult;
    }

    /**
     * Lấy tasks đang chờ xử lý của user.
     * Resolve quyền từ TEMPLATE_PERMISSION — không phụ thuộc APP_ROLE.
     */
    public List<WorkflowTaskResponse> getMyTasks(AppUserDetails user) {
        // AppUser appUser = appUserRepository.findByUsername(user.getUsername()).orElse(null);

        // Tasks được assign trực tiếp
        List<Task> assignedTasks = taskService.createTaskQuery()
                .taskAssignee(user.getUsername())
                .orderByTaskCreateTime().desc()
                .list();

        // Tasks mà user là candidate (đã được gán qua assignCandidatesToOpenTasks)
        List<Task> candidateTasks = taskService.createTaskQuery()
                .taskCandidateUser(user.getUsername())
                .taskUnassigned()
                .orderByTaskCreateTime().desc()
                .list();

        Set<String> seen = new HashSet<>();
        List<WorkflowTaskResponse> result = new ArrayList<>();

        for (Task task : assignedTasks) {
            if (seen.add(task.getId())) result.add(mapTaskToResponse(task));
        }
        for (Task task : candidateTasks) {
            if (seen.add(task.getId())) result.add(mapTaskToResponse(task));
        }

        return result;
    }

    public long getMyTaskCount(AppUserDetails user) {
        long assignedCount = taskService.createTaskQuery()
                .taskAssignee(user.getUsername()).count();
        long candidateCount = taskService.createTaskQuery()
                .taskCandidateUser(user.getUsername()).taskUnassigned().count();
        return assignedCount + candidateCount;
    }

    public List<WorkflowHistoryResponse> getEntryHistory(Long entryId) {
        List<HistoricTaskInstance> tasks = historyService.createHistoricTaskInstanceQuery()
                .processVariableValueEquals("entryId", entryId)
                .orderByHistoricActivityInstanceStartTime().asc()
                .list();

        return tasks.stream().map(ht -> {
            // Lấy action/comment từ task-local variables (không phải process-level)
            String action = getTaskLocalVariable(ht.getId(), "action");
            String comment = getTaskLocalVariable(ht.getId(), "comment");
            return WorkflowHistoryResponse.builder()
                    .activityName(ht.getName())
                    .assignee(ht.getAssignee())
                    .action(action)
                    .comment(comment)
                    .startTime(toLocalDateTime(ht.getStartTime()))
                    .endTime(ht.getEndTime() != null ? toLocalDateTime(ht.getEndTime()) : null)
                    .durationMs(ht.getDurationInMillis())
                    .build();
        }).collect(Collectors.toList());
    }

    /**
     * Resolve WorkflowStep cho task hiện tại rồi gọi dispatcher với context đầy đủ.
     * Không throw khi step không resolve được (workflow cũ chưa map) — chỉ bỏ qua.
     * Trả về {@link WorkflowActionResult} do handler sinh ra (có thể null).
     */
    private WorkflowActionResult dispatchActionHandler(Task task, String action, String comment,
                                        AppUserDetails user, Long templateId,
                                        String processInstanceId) {
        WorkflowAction wfAction = WorkflowAction.fromString(action);
        if (wfAction == null) return null;

        String processKey = getProcessKey(processInstanceId);
        if (processKey == null) return null;

        WorkflowDefinition wfDef = workflowDefinitionRepository.findByWorkflowKey(processKey).orElse(null);
        if (wfDef == null) return null;

        List<WorkflowStep> allSteps = workflowStepRepository
                .findByWorkflowDefinitionIdOrderByStepOrderAsc(wfDef.getId());
        WorkflowStep step = resolveWorkflowStep(task.getTaskDefinitionKey(), wfDef.getId(), allSteps)
                .orElse(null);
        if (step == null) return null;

        Long entryId = (Long) taskService.getVariable(task.getId(), "entryId");

        return workflowActionDispatcher.dispatch(WorkflowActionContext.builder()
                .task(task)
                .step(step)
                .action(wfAction)
                .comment(comment)
                .user(user)
                .entryId(entryId)
                .templateId(templateId)
                .processDefinitionKey(processKey)
                .processInstanceId(processInstanceId)
                .build());
    }

    // ─── Private helpers ───────────────────────────────────────────────────────

    /**
     * Gán candidate users vào tất cả UserTask đang mở trong process instance.
     * Mỗi task tra cứu WORKFLOW_STEP_CANDIDATE → tìm eligible usernames.
     */
    private void assignCandidatesToOpenTasks(String processInstanceId, Long templateId, String workflowKey) {
        List<Task> openTasks = taskService.createTaskQuery()
                .processInstanceId(processInstanceId)
                .taskUnassigned()
                .list();

        WorkflowDefinition wfDef = workflowDefinitionRepository.findByWorkflowKey(workflowKey).orElse(null);
        if (wfDef == null) return;

        List<WorkflowStep> allSteps = workflowStepRepository
                .findByWorkflowDefinitionIdOrderByStepOrderAsc(wfDef.getId());

        for (Task task : openTasks) {
            resolveWorkflowStep(task.getTaskDefinitionKey(), wfDef.getId(), allSteps)
                    .ifPresent(step -> {
                        // Ưu tiên WORKFLOW_STEP_CANDIDATE (Hướng B)
                        List<String> candidates = workflowStepCandidateRepository
                                .findEligibleUsernames(step.getId());

                        // Fallback: tra TEMPLATE_ACCESS nếu chưa có candidate nào
                        if (candidates.isEmpty() && step.getCandidateActionKey() != null) {
                            candidates = templateAccessService
                                    .findEligibleUsernames(templateId, step.getCandidateActionKey());
                        }

                        candidates.forEach(username ->
                                taskService.addCandidateUser(task.getId(), username));
                        log.debug("Assigned {} candidates to task {} (step={})",
                                candidates.size(), task.getId(), step.getStepKey());
                    });
        }
    }

    /**
     * Resolve candidateActionKey của task từ WorkflowStep.
     */
    private String resolveCandidateActionKey(Task task, Long templateId) {
        if (templateId == null) return null;
        String processKey = getProcessKey(task.getProcessInstanceId());
        if (processKey == null) return null;

        WorkflowDefinition wfDef = workflowDefinitionRepository.findByWorkflowKey(processKey).orElse(null);
        if (wfDef == null) return null;

        List<WorkflowStep> allSteps = workflowStepRepository
                .findByWorkflowDefinitionIdOrderByStepOrderAsc(wfDef.getId());
        return resolveWorkflowStep(task.getTaskDefinitionKey(), wfDef.getId(), allSteps)
                .map(WorkflowStep::getCandidateActionKey)
                .orElse(null);
    }

    /**
     * Tìm WorkflowStep từ Camunda taskDefinitionKey.
     * Hỗ trợ cả convention mới (stepKey_task, ví dụ: bkh_task → bkh)
     * và convention cũ trong BPMN tĩnh (bkh_review, txd_audit, tgd_approve...).
     */
    private Optional<WorkflowStep> resolveWorkflowStep(String taskDefinitionKey, Long wfDefId,
                                                        List<WorkflowStep> allSteps) {
        // Convention mới: stepKey_task → stepKey
        String keyWithoutTask = taskDefinitionKey.replace("_task", "");
        Optional<WorkflowStep> step = workflowStepRepository
                .findByWorkflowDefinitionIdAndStepKey(wfDefId, keyWithoutTask);
        if (step.isPresent()) return step;

        // Convention cũ (BPMN tĩnh): taskDefKey bắt đầu bằng stepKey + "_"
        return allSteps.stream()
                .filter(s -> taskDefinitionKey.startsWith(s.getStepKey() + "_")
                        || taskDefinitionKey.equals(s.getStepKey()))
                .findFirst();
    }

    /** Lấy processDefinitionKey (e.g. "scl-approval") từ processInstanceId. */
    private String getProcessKey(String processInstanceId) {
        ProcessInstance pi = runtimeService.createProcessInstanceQuery()
                .processInstanceId(processInstanceId).singleResult();
        if (pi == null) return null;
        // processDefinitionId format: "scl-approval:1:abc123" → lấy phần đầu
        String defId = pi.getProcessDefinitionId();
        return defId != null ? defId.split(":")[0] : null;
    }

    /**
     * Lấy biến local của một historic task (action, comment...).
     * Dùng activityInstanceId để query HistoricVariableInstance.
     */
    private String getTaskLocalVariable(String taskId, String varName) {
        // Approach 1: Query HistoricDetail by taskId
        List<HistoricDetail> details = historyService.createHistoricDetailQuery()
                .taskId(taskId)
                .variableUpdates()
                .list();
        for (HistoricDetail detail : details) {
            if (detail instanceof HistoricVariableUpdate update) {
                if (varName.equals(update.getVariableName())) {
                    Object val = update.getValue();
                    return val != null ? val.toString() : null;
                }
            }
        }

        // Approach 2: Query HistoricVariableInstance by activityInstanceId = taskId
        List<HistoricVariableInstance> vars = historyService.createHistoricVariableInstanceQuery()
                .activityInstanceIdIn(taskId)
                .variableName(varName)
                .list();
        if (!vars.isEmpty()) {
            Object val = vars.get(0).getValue();
            return val != null ? val.toString() : null;
        }

        return null;
    }

    private String getHistoricVariable(String processInstanceId, String varName) {
        List<HistoricVariableInstance> vars = historyService.createHistoricVariableInstanceQuery()
                .processInstanceId(processInstanceId).variableName(varName).list();
        if (!vars.isEmpty()) {
            Object value = vars.get(0).getValue();
            return value != null ? value.toString() : null;
        }
        return null;
    }

    private WorkflowTaskResponse mapTaskToResponse(Task task) {
        Long entryId = (Long) taskService.getVariable(task.getId(), "entryId");
        Long templateId = (Long) taskService.getVariable(task.getId(), "templateId");
        String orgCode = (String) taskService.getVariable(task.getId(), "orgCode");
        String submittedBy = (String) taskService.getVariable(task.getId(), "submittedBy");

        return WorkflowTaskResponse.builder()
                .taskId(task.getId())
                .taskName(task.getName())
                .taskDefinitionKey(task.getTaskDefinitionKey())
                .processInstanceId(task.getProcessInstanceId())
                .entryId(entryId)
                .templateId(templateId)
                .orgCode(orgCode)
                .submittedBy(submittedBy)
                .assignee(task.getAssignee())
                .createdAt(toLocalDateTime(task.getCreateTime()))
                .build();
    }

    private LocalDateTime toLocalDateTime(Date date) {
        if (date == null) return null;
        return date.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime();
    }
}
