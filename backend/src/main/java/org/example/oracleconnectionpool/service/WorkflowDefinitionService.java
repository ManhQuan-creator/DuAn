package org.example.oracleconnectionpool.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.camunda.bpm.engine.RepositoryService;
import org.camunda.bpm.engine.repository.Deployment;
import org.example.oracleconnectionpool.constant.WorkflowDefinitionStatus;
import org.example.oracleconnectionpool.entity.WorkflowDefinition;
import org.example.oracleconnectionpool.entity.WorkflowStep;
import org.example.oracleconnectionpool.entity.WorkflowStepCandidate;
import org.example.oracleconnectionpool.entity.WorkflowSubmitterCandidate;
import org.example.oracleconnectionpool.model.request.workflow.CreateWorkflowDefinitionRequest;
import org.example.oracleconnectionpool.model.request.workflow.UpdateWorkflowDefinitionRequest;
import org.example.oracleconnectionpool.model.request.workflow.WorkflowStepRequest;
import org.example.oracleconnectionpool.model.response.WorkflowDefinitionDetailResponse;
import org.example.oracleconnectionpool.model.response.WorkflowDefinitionListResponse;
import org.example.oracleconnectionpool.model.response.WorkflowStepResponse;
import org.example.oracleconnectionpool.model.response.XmlValidateResponse;
import org.example.oracleconnectionpool.repository.WorkflowDefinitionRepository;
import org.example.oracleconnectionpool.repository.WorkflowStepCandidateRepository;
import org.example.oracleconnectionpool.repository.WorkflowStepRepository;
import org.example.oracleconnectionpool.repository.WorkflowSubmitterCandidateRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowDefinitionService {

    private final WorkflowDefinitionRepository definitionRepository;
    private final WorkflowStepRepository stepRepository;
    private final WorkflowStepCandidateRepository candidateRepository;
    private final WorkflowSubmitterCandidateRepository submitterCandidateRepository;
    private final BpmnGeneratorService bpmnGeneratorService;
    private final RepositoryService repositoryService;
    private final WorkflowStepXmlExtractorService workflowStepXmlExtractorService;

    private static final String CAMUNDA_NS = "http://camunda.org/schema/1.0/bpmn";
    private static final String CAMUNDA_PREFIX = "camunda";
    private static final String DEFAULT_TTL = "365";

    private static final String BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL";
    private static final String EXCELPRO_NS = "http://evnnpc.vn/workflow/excelpro";
    private static final String EXCELPRO_PREFIX = "excelpro";

    public List<WorkflowDefinitionListResponse> getAll() {
        return definitionRepository.findAll().stream()
                .map(this::toListResponse)
                .toList();
    }

    public WorkflowDefinitionDetailResponse getById(Long id) {
        WorkflowDefinition def = findById(id);
        List<WorkflowStep> steps = stepRepository.findByWorkflowDefinitionIdOrderByStepOrderAsc(id);
        return toDetailResponse(def, steps);
    }

    @Transactional
    public WorkflowDefinitionDetailResponse create(CreateWorkflowDefinitionRequest request) {
        if (definitionRepository.existsByWorkflowKey(request.getWorkflowKey())) {
            throw new RuntimeException("Workflow key '" + request.getWorkflowKey() + "' đã tồn tại");
        }

        WorkflowDefinition def = WorkflowDefinition.builder()
                .workflowKey(request.getWorkflowKey())
                .name(request.getName())
                .description(request.getDescription())
                .build();
        def = definitionRepository.save(def);

        List<WorkflowStep> steps = List.of();
        if (request.getSteps() != null && !request.getSteps().isEmpty()) {
            steps = saveStepsWithCandidates(def.getId(), request.getSteps());
        }
        saveSubmitterCandidates(def.getId(), request.getSubmitterCandidates());
        return toDetailResponse(def, steps);
    }

    @Transactional
    public WorkflowDefinitionDetailResponse update(Long id, UpdateWorkflowDefinitionRequest request) {
        WorkflowDefinition def = findById(id);
        if (!WorkflowDefinitionStatus.DRAFT.equals(def.getStatus())) {
            throw new RuntimeException("Chỉ có thể sửa quy trình ở trạng thái DRAFT");
        }

        boolean bpmnChanged = request.getBpmnXml() != null && !java.util.Objects.equals(def.getBpmnXml(), request.getBpmnXml());

        boolean defChanged = false;
        if (request.getName() != null && !java.util.Objects.equals(def.getName(), request.getName())) {
            def.setName(request.getName());
            defChanged = true;
        }

        if (request.getBpmnXml() != null && !request.getBpmnXml().isBlank()) {
            log.info("[workflow.update] normalize BPMN for workflowKey={} (incomingXmlLength={})",
                    def.getWorkflowKey(), request.getBpmnXml().length());

            // Always normalize XML to enforce <process id>=workflowKey, isExecutable=true and required TTL.
            String normalizedXml = ensureProcessIdMatchesWorkflowKey(request.getBpmnXml(), def.getWorkflowKey());
            normalizedXml = ensureProcessIsExecutable(normalizedXml);
            normalizedXml = ensureHistoryTimeToLive(normalizedXml, DEFAULT_TTL);
            normalizedXml = ensureNotificationServiceTasksHaveExcelproCandidates(normalizedXml);

            log.info("[workflow.update] normalizedXmlLength={} (changed={})",
                    normalizedXml != null ? normalizedXml.length() : 0,
                    !java.util.Objects.equals(request.getBpmnXml(), normalizedXml));

            // Only persist if effective value changed.
            if (!java.util.Objects.equals(def.getBpmnXml(), normalizedXml)) {
                def.setBpmnXml(normalizedXml);
                defChanged = true;
                log.info("[workflow.update] BPMN XML persisted (workflowKey={})", def.getWorkflowKey());
            } else {
                log.info("[workflow.update] BPMN XML unchanged vs DB (workflowKey={})", def.getWorkflowKey());
            }
            // Ensure downstream logic uses normalized version
            request.setBpmnXml(normalizedXml);
        }

        if (request.getDescription() != null && !java.util.Objects.equals(def.getDescription(), request.getDescription())) {
            def.setDescription(request.getDescription());
            defChanged = true;
        }

        if (defChanged) {
            def.setVersion(def.getVersion() + 1);
            def = definitionRepository.save(def);
        }

        List<WorkflowStep> steps;
        if (request.getSteps() != null && !request.getSteps().isEmpty()) {
            steps = replaceAllSteps(id, request.getSteps());
        } else if (request.getBpmnXml() != null && !request.getBpmnXml().isBlank()) {
            if (bpmnChanged) {
                steps = replaceAllStepsFromBpmnXml(id, request.getBpmnXml());

                var extractedSubmitters = workflowStepXmlExtractorService.extractSubmitterCandidates(request.getBpmnXml());
                if (extractedSubmitters != null) {
                    List<WorkflowStepRequest.StepCandidateRequest> submitterReqs = new java.util.ArrayList<>();
                    for (var c : extractedSubmitters) {
                        WorkflowStepRequest.StepCandidateRequest cr = new WorkflowStepRequest.StepCandidateRequest();
                        cr.setSubjectOrgCode(c.getOrgCode());
                        cr.setSubjectPositionCode(c.getPositionCode());
                        submitterReqs.add(cr);
                    }
                    saveSubmitterCandidates(id, submitterReqs);
                }
            } else {
                steps = stepRepository.findByWorkflowDefinitionIdOrderByStepOrderAsc(id);
            }
        } else {
            steps = stepRepository.findByWorkflowDefinitionIdOrderByStepOrderAsc(id);
        }

        // Cập nhật submitter candidates nếu có
        if (request.getSubmitterCandidates() != null) {
            saveSubmitterCandidates(id, request.getSubmitterCandidates());
        }

        // If definition was not saved above, still return latest persisted version
        if (!defChanged) {
            def = findById(id);
        }

        return toDetailResponse(def, steps);
    }

    @Transactional
    public void delete(Long id) {
        WorkflowDefinition def = findById(id);
        if (!WorkflowDefinitionStatus.DRAFT.equals(def.getStatus())) {
            throw new RuntimeException("Chỉ có thể xóa quy trình ở trạng thái DRAFT");
        }
        List<Long> stepIds = stepRepository.findByWorkflowDefinitionIdOrderByStepOrderAsc(id)
                .stream().map(WorkflowStep::getId).toList();
        if (!stepIds.isEmpty()) {
            candidateRepository.deleteByWorkflowStepIdIn(stepIds);
        }
        stepRepository.deleteByWorkflowDefinitionId(id);
        submitterCandidateRepository.deleteByWorkflowDefinitionId(id);
        definitionRepository.deleteById(id);
    }

    @Transactional
    public WorkflowDefinitionDetailResponse deploy(Long id) {
        WorkflowDefinition def = findById(id);
        List<WorkflowStep> steps = stepRepository.findByWorkflowDefinitionIdOrderByStepOrderAsc(id);

        // Use existing BPMN XML (do not re-generate to avoid changing what user already configured)
        String bpmnXml = def.getBpmnXml();
        if (bpmnXml == null || bpmnXml.isBlank()) {
            throw new RuntimeException("BPMN XML trống, không thể deploy");
        }

        // Safety: enforce process id/isExecutable/TTL before deploy as well (prevents stale XML causing submit failures)
        String normalizedForDeploy = ensureProcessIdMatchesWorkflowKey(bpmnXml, def.getWorkflowKey());
        normalizedForDeploy = ensureProcessIsExecutable(normalizedForDeploy);
        normalizedForDeploy = ensureHistoryTimeToLive(normalizedForDeploy, DEFAULT_TTL);
        normalizedForDeploy = ensureNotificationServiceTasksHaveExcelproCandidates(normalizedForDeploy);
        if (!java.util.Objects.equals(bpmnXml, normalizedForDeploy)) {
            log.info("[workflow.deploy] normalize BPMN before deploy (workflowKey={})", def.getWorkflowKey());
            bpmnXml = normalizedForDeploy;
            // keep DB consistent with what we deploy
            def.setBpmnXml(bpmnXml);
            def.setVersion(def.getVersion() + 1);
            def = definitionRepository.save(def);
        }

        // Validate XML before deploy
        XmlValidateResponse vr = validateXml(id, bpmnXml);
        if (vr == null || !vr.isValid()) {
            throw new RuntimeException("BPMN XML không hợp lệ: " + (vr != null ? vr.getMessage() : "UNKNOWN"));
        }

        // Deploy to Camunda
        String resourceName = def.getWorkflowKey() + ".bpmn";
        Deployment deployment = repositoryService.createDeployment()
                .name(def.getName())
                .addString(resourceName, bpmnXml)
                .deploy();

        // Update definition
        def.setStatus(WorkflowDefinitionStatus.DEPLOYED);
        def.setDeploymentId(deployment.getId());
        def = definitionRepository.save(def);

        log.info("Deployed workflow '{}' (key={}) with deploymentId={}",
                def.getName(), def.getWorkflowKey(), deployment.getId());

        return toDetailResponse(def, steps);
    }

    public List<WorkflowDefinitionListResponse> getDeployed() {
        return definitionRepository.findByStatus(WorkflowDefinitionStatus.DEPLOYED).stream()
                .map(this::toListResponse)
                .toList();
    }

    public XmlValidateResponse validateXml(Long id, String bpmnXml) {

        findById(id);
        if (bpmnXml == null || bpmnXml.trim().isEmpty()) {
            return XmlValidateResponse.builder()
                    .valid(false)
                    .message("XML trống")
                    .build();
        }
        try {
            DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
            dbf.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            // harden XXE
            dbf.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            dbf.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            dbf.setExpandEntityReferences(false);

            dbf.newDocumentBuilder().parse(new java.io.ByteArrayInputStream(bpmnXml.getBytes(StandardCharsets.UTF_8)));

            return XmlValidateResponse.builder()
                    .valid(true)
                    .message("XML hợp lệ")
                    .build();
        } catch (Exception ex) {
            return XmlValidateResponse.builder()
                    .valid(false)
                    .message("XML sai cú pháp")
                    .build();
        }
    }

    public Page<WorkflowDefinitionListResponse> search(String keyword, String status, Integer pageNum, Integer pageSize) {
        int p = pageNum == null ? 0 : Math.max(pageNum, 0);
        int s = pageSize == null ? 20 : Math.max(pageSize, 1);
        Pageable pageable = PageRequest.of(p, s);

        return definitionRepository.search(
                        keyword == null ? null : keyword.trim(),
                        status == null || status.trim().isEmpty() ? null : status.trim(),
                        pageable)
                .map(this::toListResponse);
    }

    // === Private helpers ===

    private WorkflowDefinition findById(Long id) {
        return definitionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Quy trình không tồn tại: " + id));
    }

    private List<WorkflowStep> saveStepsWithCandidates(Long definitionId, List<WorkflowStepRequest> requests) {
        if (requests == null || requests.isEmpty()) return List.of();

        List<WorkflowStep> savedSteps = new ArrayList<>();
        for (WorkflowStepRequest req : requests) {
            WorkflowStep step = WorkflowStep.builder()
                    .workflowDefinitionId(definitionId)
                    .stepOrder(req.getStepOrder())
                    .stepKey(req.getStepKey())
                    .stepName(req.getStepName())
                    .candidateActionKey(req.getCandidateActionKey() != null ? req.getCandidateActionKey() : req.getStepKey())
                    .statusAfterApprove(req.getStatusAfterApprove())
                    .returnTarget(req.getReturnTarget() != null ? req.getReturnTarget() : "SUBMITTER")
                    .notifyMessage(req.getNotifyMessage())
                    .onApproveHandlerKey(req.getOnApproveHandlerKey())
                    .onReturnHandlerKey(req.getOnReturnHandlerKey())
                    .onRejectHandlerKey(req.getOnRejectHandlerKey())
                    .build();
            step = stepRepository.save(step);

            // Lưu candidates
            if (req.getCandidates() != null && !req.getCandidates().isEmpty()) {
                for (WorkflowStepRequest.StepCandidateRequest cr : req.getCandidates()) {
                    WorkflowStepCandidate candidate = WorkflowStepCandidate.builder()
                            .workflowStepId(step.getId())
                            .subjectOrgCode(cr.getSubjectOrgCode())
                            .subjectPositionCode(cr.getSubjectPositionCode())
                            .build();
                    candidateRepository.save(candidate);
                }
            }
            savedSteps.add(step);
        }
        return savedSteps;
    }

    private void saveSubmitterCandidates(Long definitionId, List<WorkflowStepRequest.StepCandidateRequest> candidates) {
        submitterCandidateRepository.deleteByWorkflowDefinitionId(definitionId);
        if (candidates == null || candidates.isEmpty()) return;
        for (WorkflowStepRequest.StepCandidateRequest cr : candidates) {
            submitterCandidateRepository.save(WorkflowSubmitterCandidate.builder()
                    .workflowDefinitionId(definitionId)
                    .subjectOrgCode(cr.getSubjectOrgCode())
                    .subjectPositionCode(cr.getSubjectPositionCode())
                    .build());
        }
    }

    private WorkflowDefinitionListResponse toListResponse(WorkflowDefinition def) {
        int stepCount = stepRepository.findByWorkflowDefinitionIdOrderByStepOrderAsc(def.getId()).size();
        return WorkflowDefinitionListResponse.builder()
                .id(def.getId())
                .workflowKey(def.getWorkflowKey())
                .name(def.getName())
                .description(def.getDescription())
                .status(def.getStatus())
                .version(def.getVersion())
                .stepCount(stepCount)
                .createdBy(def.getCreatedBy())
                .createdAt(def.getCreatedAt())
                .updatedAt(def.getUpdatedAt())
                .build();
    }

    private WorkflowDefinitionDetailResponse toDetailResponse(WorkflowDefinition def, List<WorkflowStep> steps) {
        return WorkflowDefinitionDetailResponse.builder()
                .id(def.getId())
                .workflowKey(def.getWorkflowKey())
                .name(def.getName())
                .description(def.getDescription())
                .status(def.getStatus())
                .version(def.getVersion())
                .deploymentId(def.getDeploymentId())
                .bpmnXml(def.getBpmnXml())
                .steps(steps.stream().map(this::toStepResponse).toList())
                .submitterCandidates(
                    submitterCandidateRepository.findByWorkflowDefinitionId(def.getId()).stream()
                        .map(c -> WorkflowStepResponse.StepCandidateResponse.builder()
                                .id(c.getId())
                                .subjectOrgCode(c.getSubjectOrgCode())
                                .subjectPositionCode(c.getSubjectPositionCode())
                                .build())
                        .toList()
                )
                .createdBy(def.getCreatedBy())
                .createdAt(def.getCreatedAt())
                .updatedAt(def.getUpdatedAt())
                .build();
    }

    private WorkflowStepResponse toStepResponse(WorkflowStep step) {
        List<WorkflowStepCandidate> candidates = candidateRepository.findByWorkflowStepId(step.getId());
        return WorkflowStepResponse.builder()
                .id(step.getId())
                .stepOrder(step.getStepOrder())
                .stepKey(step.getStepKey())
                .stepName(step.getStepName())
                .candidateActionKey(step.getCandidateActionKey())
                .statusAfterApprove(step.getStatusAfterApprove())
                .returnTarget(step.getReturnTarget())
                .notifyMessage(step.getNotifyMessage())
                .onApproveHandlerKey(step.getOnApproveHandlerKey())
                .onReturnHandlerKey(step.getOnReturnHandlerKey())
                .onRejectHandlerKey(step.getOnRejectHandlerKey())
                .candidates(candidates.stream().map(c -> WorkflowStepResponse.StepCandidateResponse.builder()
                        .id(c.getId())
                        .subjectOrgCode(c.getSubjectOrgCode())
                        .subjectPositionCode(c.getSubjectPositionCode())
                        .build()).toList())
                .build();
    }

    private List<WorkflowStep> replaceAllSteps(Long definitionId, List<WorkflowStepRequest> requests) {
        if (requests == null) requests = List.of();

        // Existing steps keyed by stepKey
        List<WorkflowStep> existing = stepRepository.findByWorkflowDefinitionIdOrderByStepOrderAsc(definitionId);
        java.util.Map<String, WorkflowStep> existingByKey = new java.util.HashMap<>();
        for (WorkflowStep s : existing) {
            if (s.getStepKey() != null) existingByKey.put(s.getStepKey(), s);
        }

        // Track keys in request
        java.util.Set<String> requestKeys = new java.util.HashSet<>();
        List<WorkflowStep> result = new java.util.ArrayList<>();

        for (WorkflowStepRequest req : requests) {
            if (req.getStepKey() == null || req.getStepKey().isBlank()) {
                throw new RuntimeException("stepKey is required");
            }
            requestKeys.add(req.getStepKey());

            WorkflowStep step = existingByKey.get(req.getStepKey());
            boolean isNew = (step == null);
            if (isNew) {
                step = WorkflowStep.builder()
                        .workflowDefinitionId(definitionId)
                        .stepKey(req.getStepKey())
                        .build();
            }

            // Apply updates (only save if changed)
            boolean changed = isNew;
            changed |= !java.util.Objects.equals(step.getStepOrder(), req.getStepOrder());
            changed |= !java.util.Objects.equals(step.getStepName(), req.getStepName());
            String candidateActionKey = req.getCandidateActionKey() != null ? req.getCandidateActionKey() : req.getStepKey();
            changed |= !java.util.Objects.equals(step.getCandidateActionKey(), candidateActionKey);
            changed |= !java.util.Objects.equals(step.getStatusAfterApprove(), req.getStatusAfterApprove());
            String returnTarget = req.getReturnTarget() != null ? req.getReturnTarget() : "SUBMITTER";
            changed |= !java.util.Objects.equals(step.getReturnTarget(), returnTarget);
            changed |= !java.util.Objects.equals(step.getNotifyMessage(), req.getNotifyMessage());
            changed |= !java.util.Objects.equals(step.getOnApproveHandlerKey(), req.getOnApproveHandlerKey());
            changed |= !java.util.Objects.equals(step.getOnReturnHandlerKey(), req.getOnReturnHandlerKey());
            changed |= !java.util.Objects.equals(step.getOnRejectHandlerKey(), req.getOnRejectHandlerKey());

            if (changed) {
                step.setStepOrder(req.getStepOrder());
                step.setStepName(req.getStepName());
                step.setCandidateActionKey(candidateActionKey);
                step.setStatusAfterApprove(req.getStatusAfterApprove());
                step.setReturnTarget(returnTarget);
                step.setNotifyMessage(req.getNotifyMessage());
                step.setOnApproveHandlerKey(req.getOnApproveHandlerKey());
                step.setOnReturnHandlerKey(req.getOnReturnHandlerKey());
                step.setOnRejectHandlerKey(req.getOnRejectHandlerKey());

                step = stepRepository.save(step);
            }

            // Sync candidates for this step (simple strategy: delete + insert)
            candidateRepository.deleteByWorkflowStepId(step.getId());
            if (req.getCandidates() != null && !req.getCandidates().isEmpty()) {
                for (WorkflowStepRequest.StepCandidateRequest cr : req.getCandidates()) {
                    WorkflowStepCandidate candidate = WorkflowStepCandidate.builder()
                            .workflowStepId(step.getId())
                            .subjectOrgCode(cr.getSubjectOrgCode())
                            .subjectPositionCode(cr.getSubjectPositionCode())
                            .build();
                    candidateRepository.save(candidate);
                }
            }

            result.add(step);
        }

        // Delete steps removed from request (and their candidates)
        List<Long> removedStepIds = existing.stream()
                .filter(s -> s.getStepKey() != null && !requestKeys.contains(s.getStepKey()))
                .map(WorkflowStep::getId)
                .toList();
        if (!removedStepIds.isEmpty()) {
            candidateRepository.deleteByWorkflowStepIdIn(removedStepIds);
            stepRepository.deleteAllById(removedStepIds);
        }

        // For response: return current steps ordered
        return stepRepository.findByWorkflowDefinitionIdOrderByStepOrderAsc(definitionId);
    }

    private List<WorkflowStep> replaceAllStepsFromBpmnXml(Long definitionId, String bpmnXml) {
        // Extract from BPMN
        List<WorkflowStepXmlExtractorService.ExtractedStep> extracted = workflowStepXmlExtractorService.extractSteps(bpmnXml);

        List<WorkflowStepRequest> requests = new java.util.ArrayList<>();
        for (WorkflowStepXmlExtractorService.ExtractedStep s : extracted) {
            WorkflowStepRequest req = new WorkflowStepRequest();
            req.setStepOrder(s.getStepOrder());
            req.setStepKey(s.getStepKey());
            req.setStepName(s.getStepName());
            req.setCandidateActionKey(s.getCandidateActionKey());
            req.setStatusAfterApprove(s.getStatusAfterApprove());
            req.setReturnTarget(s.getReturnTarget());
            req.setNotifyMessage(s.getNotifyMessage());
            req.setOnApproveHandlerKey(s.getOnApproveHandlerKey());
            req.setOnReturnHandlerKey(s.getOnReturnHandlerKey());
            req.setOnRejectHandlerKey(s.getOnRejectHandlerKey());

            if (s.getCandidates() != null && !s.getCandidates().isEmpty()) {
                List<WorkflowStepRequest.StepCandidateRequest> candReqs = new java.util.ArrayList<>();
                for (var c : s.getCandidates()) {
                    WorkflowStepRequest.StepCandidateRequest cr = new WorkflowStepRequest.StepCandidateRequest();
                    cr.setSubjectOrgCode(c.getOrgCode());
                    cr.setSubjectPositionCode(c.getPositionCode());
                    candReqs.add(cr);
                }
                req.setCandidates(candReqs);
            }

            requests.add(req);
        }

        return replaceAllSteps(definitionId, requests);
    }

    /**
     * Camunda can enforce history TTL on deploy. Ensure camunda:historyTimeToLive exists on <process>.
     * This runs on save/update so the stored BPMN is always deployable.
     */
    private String ensureHistoryTimeToLive(String bpmnXml, String ttlDays) {
        if (bpmnXml == null || bpmnXml.isBlank()) return bpmnXml;
        // quick check to avoid parsing if already present
        if (bpmnXml.contains("historyTimeToLive")) return bpmnXml;

        try {
            javax.xml.parsers.DocumentBuilderFactory dbf = javax.xml.parsers.DocumentBuilderFactory.newInstance();
            dbf.setFeature(javax.xml.XMLConstants.FEATURE_SECURE_PROCESSING, true);
            dbf.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_DTD, "");
            dbf.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            dbf.setExpandEntityReferences(false);
            dbf.setNamespaceAware(true);

            org.w3c.dom.Document doc = dbf.newDocumentBuilder()
                    .parse(new java.io.ByteArrayInputStream(bpmnXml.getBytes(StandardCharsets.UTF_8)));

            org.w3c.dom.Element root = doc.getDocumentElement();
            if (root == null) return bpmnXml;

            // Ensure camunda namespace declared on <definitions>
            boolean hasCamundaNs = false;
            org.w3c.dom.NamedNodeMap attrs = root.getAttributes();
            if (attrs != null) {
                for (int i = 0; i < attrs.getLength(); i++) {
                    org.w3c.dom.Node a = attrs.item(i);
                    if (a == null) continue;
                    if (CAMUNDA_NS.equals(a.getNodeValue()) && a.getNodeName() != null && a.getNodeName().startsWith("xmlns:")) {
                        hasCamundaNs = true;
                        break;
                    }
                }
            }
            if (!hasCamundaNs) {
                root.setAttribute("xmlns:" + CAMUNDA_PREFIX, CAMUNDA_NS);
            }

            // Add camunda:historyTimeToLive to the first <process>
            org.w3c.dom.NodeList processes = doc.getElementsByTagNameNS("http://www.omg.org/spec/BPMN/20100524/MODEL", "process");
            if (processes == null || processes.getLength() == 0) {
                // fallback no namespace (in case document has no namespace awareness in content)
                processes = doc.getElementsByTagName("process");
            }
            if (processes != null && processes.getLength() > 0) {
                org.w3c.dom.Element p = (org.w3c.dom.Element) processes.item(0);
                if (p != null) {
                    p.setAttributeNS(CAMUNDA_NS, CAMUNDA_PREFIX + ":historyTimeToLive", ttlDays);
                }
            }

            javax.xml.transform.TransformerFactory tf = javax.xml.transform.TransformerFactory.newInstance();
            tf.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_DTD, "");
            tf.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_STYLESHEET, "");
            javax.xml.transform.Transformer t = tf.newTransformer();
            t.setOutputProperty(javax.xml.transform.OutputKeys.OMIT_XML_DECLARATION, "no");
            t.setOutputProperty(javax.xml.transform.OutputKeys.ENCODING, "UTF-8");
            t.setOutputProperty(javax.xml.transform.OutputKeys.INDENT, "yes");

            java.io.StringWriter sw = new java.io.StringWriter();
            t.transform(new javax.xml.transform.dom.DOMSource(doc), new javax.xml.transform.stream.StreamResult(sw));
            return sw.toString();
        } catch (Exception e) {
            // If normalization fails, keep original XML (do not block save)
            log.warn("Cannot ensure historyTimeToLive on BPMN XML: {}", e.getMessage());
            return bpmnXml;
        }
    }

    /**
     * Ensure BPMN <process id> equals workflowKey so Camunda processDefinitionKey is stable.
     * This runs on save/update to prevent submit/startProcessInstanceByKey failing.
     */
    private String ensureProcessIdMatchesWorkflowKey(String bpmnXml, String workflowKey) {
        if (bpmnXml == null || bpmnXml.isBlank() || workflowKey == null || workflowKey.isBlank()) return bpmnXml;

        try {
            javax.xml.parsers.DocumentBuilderFactory dbf = javax.xml.parsers.DocumentBuilderFactory.newInstance();
            dbf.setFeature(javax.xml.XMLConstants.FEATURE_SECURE_PROCESSING, true);
            dbf.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_DTD, "");
            dbf.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            dbf.setExpandEntityReferences(false);
            dbf.setNamespaceAware(true);

            org.w3c.dom.Document doc = dbf.newDocumentBuilder()
                    .parse(new java.io.ByteArrayInputStream(bpmnXml.getBytes(StandardCharsets.UTF_8)));

            org.w3c.dom.Element processEl = null;

            // 1) Preferred: find by localName="process" (works with bpmn:process and default namespace)
            org.w3c.dom.NodeList all = doc.getElementsByTagName("*");
            for (int i = 0; i < all.getLength(); i++) {
                org.w3c.dom.Node n = all.item(i);
                if (!(n instanceof org.w3c.dom.Element e)) continue;
                String local = e.getLocalName();
                String name = e.getNodeName();
                if ("process".equals(local) || "process".equals(name) || name.endsWith(":process")) {
                    processEl = e;
                    break;
                }
            }

            if (processEl == null) {
                log.warn("[workflow.normalize] no <process> element found; cannot set id to {}", workflowKey);
                return bpmnXml;
            }

            String currentId = processEl.getAttribute("id");
            if (!workflowKey.equals(currentId)) {
                log.info("[workflow.normalize] Normalize BPMN process id: '{}' -> '{}'", currentId, workflowKey);
                processEl.setAttribute("id", workflowKey);
            }

            javax.xml.transform.TransformerFactory tf = javax.xml.transform.TransformerFactory.newInstance();
            tf.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_DTD, "");
            tf.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_STYLESHEET, "");
            javax.xml.transform.Transformer t = tf.newTransformer();
            t.setOutputProperty(javax.xml.transform.OutputKeys.OMIT_XML_DECLARATION, "no");
            t.setOutputProperty(javax.xml.transform.OutputKeys.ENCODING, "UTF-8");

            java.io.StringWriter sw = new java.io.StringWriter();
            t.transform(new javax.xml.transform.dom.DOMSource(doc), new javax.xml.transform.stream.StreamResult(sw));
            return sw.toString();
        } catch (Exception e) {
            log.warn("Cannot normalize BPMN process id to workflowKey: {}", e.getMessage());
            return bpmnXml;
        }
    }

    /** Ensure <process isExecutable="true"> so Camunda can start instances. */
    private String ensureProcessIsExecutable(String bpmnXml) {
        if (bpmnXml == null || bpmnXml.isBlank()) return bpmnXml;

        try {
            javax.xml.parsers.DocumentBuilderFactory dbf = javax.xml.parsers.DocumentBuilderFactory.newInstance();
            dbf.setFeature(javax.xml.XMLConstants.FEATURE_SECURE_PROCESSING, true);
            dbf.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_DTD, "");
            dbf.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            dbf.setExpandEntityReferences(false);
            dbf.setNamespaceAware(true);

            org.w3c.dom.Document doc = dbf.newDocumentBuilder()
                    .parse(new java.io.ByteArrayInputStream(bpmnXml.getBytes(StandardCharsets.UTF_8)));

            org.w3c.dom.Element processEl = null;
            org.w3c.dom.NodeList all = doc.getElementsByTagName("*");
            for (int i = 0; i < all.getLength(); i++) {
                org.w3c.dom.Node n = all.item(i);
                if (!(n instanceof org.w3c.dom.Element e)) continue;
                String local = e.getLocalName();
                String name = e.getNodeName();
                if ("process".equals(local) || "process".equals(name) || name.endsWith(":process")) {
                    processEl = e;
                    break;
                }
            }
            if (processEl == null) return bpmnXml;

            String cur = processEl.getAttribute("isExecutable");
            if (!"true".equalsIgnoreCase(cur)) {
                log.info("[workflow.normalize] Normalize BPMN isExecutable: '{}' -> 'true'", (cur == null || cur.isBlank()) ? "<missing>" : cur);
                processEl.setAttribute("isExecutable", "true");
            }

            javax.xml.transform.TransformerFactory tf = javax.xml.transform.TransformerFactory.newInstance();
            tf.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_DTD, "");
            tf.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_STYLESHEET, "");
            javax.xml.transform.Transformer t = tf.newTransformer();
            t.setOutputProperty(javax.xml.transform.OutputKeys.OMIT_XML_DECLARATION, "no");
            t.setOutputProperty(javax.xml.transform.OutputKeys.ENCODING, "UTF-8");

            java.io.StringWriter sw = new java.io.StringWriter();
            t.transform(new javax.xml.transform.dom.DOMSource(doc), new javax.xml.transform.stream.StreamResult(sw));
            return sw.toString();
        } catch (Exception e) {
            log.warn("Cannot normalize BPMN isExecutable: {}", e.getMessage());
            return bpmnXml;
        }
    }

    /**
     * Ensure notification serviceTasks (camunda:delegateExpression contains taskNotificationDelegate)
     * have excelpro:candidates/excelpro:candidate filled.
     *
     * Strategy:
     * - Infer candidates by copying from nearest userTask(s) before and after the notify serviceTask
     *   (graph-based via sequenceFlow; fallback to DOM order in <process>).
     * - Never create/keep an empty excelpro:candidates container, because TaskNotificationDelegate
     *   treats empty container as "send to nobody" and does NOT fallback.
     */
    private String ensureNotificationServiceTasksHaveExcelproCandidates(String bpmnXml) {
        if (bpmnXml == null || bpmnXml.isBlank()) return bpmnXml;
        if (!bpmnXml.contains("taskNotificationDelegate")) return bpmnXml;

        try {
            javax.xml.parsers.DocumentBuilderFactory dbf = javax.xml.parsers.DocumentBuilderFactory.newInstance();
            dbf.setFeature(javax.xml.XMLConstants.FEATURE_SECURE_PROCESSING, true);
            dbf.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_DTD, "");
            dbf.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            dbf.setExpandEntityReferences(false);
            dbf.setNamespaceAware(true);

            org.w3c.dom.Document doc = dbf.newDocumentBuilder()
                    .parse(new java.io.ByteArrayInputStream(bpmnXml.getBytes(StandardCharsets.UTF_8)));

            org.w3c.dom.Element definitions = doc.getDocumentElement();
            if (definitions != null) {
                ensureNamespaceDeclared(definitions, EXCELPRO_PREFIX, EXCELPRO_NS);
            }

            // Iterate over serviceTasks and patch notification tasks only
            org.w3c.dom.NodeList serviceTasks = doc.getElementsByTagNameNS(BPMN_NS, "serviceTask");
            if (serviceTasks == null || serviceTasks.getLength() == 0) {
                serviceTasks = doc.getElementsByTagName("serviceTask");
            }

            // First notification service task in DOM order
            org.w3c.dom.Element firstNotifyTask = null;
            for (int i = 0; i < serviceTasks.getLength(); i++) {
                org.w3c.dom.Node n = serviceTasks.item(i);
                if (n instanceof org.w3c.dom.Element st && isNotificationServiceTask(st)) {
                    firstNotifyTask = st;
                    break;
                }
            }

            // Submitter candidates are only added to the first notification task
            LinkedHashSet<CandidatePair> submitterCandidates = readExcelproSubmitterCandidatePairs(doc);

            int patched = 0;
            int removedEmptyContainers = 0;

            for (int i = 0; i < serviceTasks.getLength(); i++) {
                org.w3c.dom.Node n = serviceTasks.item(i);
                if (!(n instanceof org.w3c.dom.Element st)) continue;
                if (!isNotificationServiceTask(st)) continue;

                boolean isFirstNotify = (firstNotifyTask != null && st == firstNotifyTask);

                org.w3c.dom.Element ext = findDirectChildElement(st, BPMN_NS, "extensionElements");
                if (ext == null) {
                    // Don't create extensionElements unless we actually have candidates to add.
                    ext = null;
                }

                boolean hasAnyCandidateNode = ext != null && hasAnyExcelproCandidateNode(ext);
                LinkedHashSet<CandidatePair> existingPairs = readExcelproCandidatePairs(st);

                // Decide what to add:
                // - First notify task: always merge submitter candidates (if any)
                // - Any notify task missing candidates: infer from nearest userTask before + after
                LinkedHashSet<CandidatePair> wantToAdd = new LinkedHashSet<>();
                if (isFirstNotify && submitterCandidates != null && !submitterCandidates.isEmpty()) {
                    wantToAdd.addAll(submitterCandidates);
                }
                if (!hasAnyCandidateNode) {
                    org.w3c.dom.Element nextUserTask = findNearestSiblingUserTask(st, true);
                    org.w3c.dom.Element prevUserTask = findNearestSiblingUserTask(st, false);
                    if (nextUserTask != null) wantToAdd.addAll(readExcelproCandidatePairs(nextUserTask));
                    if (prevUserTask != null) wantToAdd.addAll(readExcelproCandidatePairs(prevUserTask));
                }

                // Remove already-present pairs
                wantToAdd.removeAll(existingPairs);

                if (wantToAdd.isEmpty()) {
                    // If we still have no candidates and an empty excelpro:candidates container exists, remove it
                    // so notification can fallback to targetGroup if present.
                    if (!hasAnyCandidateNode && ext != null) {
                        removedEmptyContainers += removeEmptyExcelproCandidatesContainers(ext);
                    }
                    continue;
                }

                // We have candidates => ensure extensionElements exists
                if (ext == null) {
                    ext = doc.createElementNS(BPMN_NS, "extensionElements");
                    insertExtensionElementsBeforeFirstIncOut(st, ext);
                }

                // Find or create excelpro:candidates container
                org.w3c.dom.Element candidatesContainer = findExcelproCandidatesContainer(ext);
                if (candidatesContainer == null) {
                    candidatesContainer = doc.createElementNS(EXCELPRO_NS, EXCELPRO_PREFIX + ":candidates");
                    ext.appendChild(candidatesContainer);
                }

                // Add excelpro:candidate nodes
                for (CandidatePair cp : wantToAdd) {
                    org.w3c.dom.Element c = doc.createElementNS(EXCELPRO_NS, EXCELPRO_PREFIX + ":candidate");
                    if (cp.orgCode != null && !cp.orgCode.isBlank()) {
                        c.setAttribute("orgCode", cp.orgCode);
                    }
                    if (cp.positionCode != null && !cp.positionCode.isBlank()) {
                        c.setAttribute("positionCode", cp.positionCode);
                    }
                    candidatesContainer.appendChild(c);
                }
                patched++;
            }

            if (patched == 0 && removedEmptyContainers == 0) {
                return bpmnXml;
            }

            log.info("[workflow.normalize] ensureNotificationCandidates: patchedTasks={}, removedEmptyContainers={}", patched, removedEmptyContainers);

            javax.xml.transform.TransformerFactory tf = javax.xml.transform.TransformerFactory.newInstance();
            tf.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_DTD, "");
            tf.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_STYLESHEET, "");
            javax.xml.transform.Transformer t = tf.newTransformer();
            t.setOutputProperty(javax.xml.transform.OutputKeys.OMIT_XML_DECLARATION, "no");
            t.setOutputProperty(javax.xml.transform.OutputKeys.ENCODING, "UTF-8");

            java.io.StringWriter sw = new java.io.StringWriter();
            t.transform(new javax.xml.transform.dom.DOMSource(doc), new javax.xml.transform.stream.StreamResult(sw));
            return sw.toString();
        } catch (Exception e) {
            log.warn("Cannot ensure excelpro candidates for notification serviceTasks: {}", e.getMessage());
            return bpmnXml;
        }
    }

    private boolean isNotificationServiceTask(org.w3c.dom.Element serviceTask) {
        if (serviceTask == null) return false;
        String del = serviceTask.getAttributeNS(CAMUNDA_NS, "delegateExpression");
        if (del == null || del.isBlank()) {
            del = serviceTask.getAttribute("camunda:delegateExpression");
        }
        if (del == null) return false;
        String d = del.trim();
        return d.contains("taskNotificationDelegate");
    }

    private org.w3c.dom.Element findNearestSiblingUserTask(org.w3c.dom.Element el, boolean forward) {
        if (el == null) return null;
        org.w3c.dom.Node parent = el.getParentNode();
        if (!(parent instanceof org.w3c.dom.Element parentEl)) return null;

        List<org.w3c.dom.Element> siblings = listChildElements(parentEl);
        int idx = -1;
        for (int i = 0; i < siblings.size(); i++) {
            if (siblings.get(i) == el) {
                idx = i;
                break;
            }
        }
        if (idx < 0) return null;

        if (forward) {
            for (int i = idx + 1; i < siblings.size(); i++) {
                if (isUserTaskElement(siblings.get(i))) return siblings.get(i);
            }
        } else {
            for (int i = idx - 1; i >= 0; i--) {
                if (isUserTaskElement(siblings.get(i))) return siblings.get(i);
            }
        }
        return null;
    }

    private boolean isUserTaskElement(org.w3c.dom.Element el) {
        if (el == null) return false;
        String local = el.getLocalName();
        String name = el.getNodeName();
        return "userTask".equalsIgnoreCase(local) || "userTask".equalsIgnoreCase(name) || (name != null && name.toLowerCase(java.util.Locale.ROOT).endsWith(":usertask"));
    }

    private LinkedHashSet<CandidatePair> readExcelproCandidatePairs(org.w3c.dom.Element taskElement) {
        LinkedHashSet<CandidatePair> out = new LinkedHashSet<>();
        if (taskElement == null) return out;

        org.w3c.dom.Element ext = findDirectChildElement(taskElement, BPMN_NS, "extensionElements");
        if (ext == null) {
            // fallback (no namespace)
            ext = findDirectChildElement(taskElement, null, "extensionElements");
        }
        if (ext == null) return out;

        // Find excelpro:candidates containers
        for (org.w3c.dom.Element container : findExcelproCandidatesContainers(ext)) {
            List<org.w3c.dom.Element> candidates = listChildElements(container);
            for (org.w3c.dom.Element c : candidates) {
                if (c == null) continue;
                String ns = c.getNamespaceURI();
                String ln = c.getLocalName();
                if (!EXCELPRO_NS.equals(ns)) continue;
                if (ln == null || !"candidate".equalsIgnoreCase(ln)) continue;

                String orgCode = emptyToNull(c.getAttribute("orgCode"));
                String positionCode = emptyToNull(c.getAttribute("positionCode"));
                if (orgCode == null && positionCode == null) continue;

                out.add(new CandidatePair(orgCode, positionCode));
            }
        }

        return out;
    }

    private LinkedHashSet<CandidatePair> readExcelproSubmitterCandidatePairs(org.w3c.dom.Document doc) {
        LinkedHashSet<CandidatePair> out = new LinkedHashSet<>();
        if (doc == null) return out;

        org.w3c.dom.Element processEl = findFirstProcessElement(doc);
        if (processEl == null) return out;

        org.w3c.dom.Element ext = findDirectChildElement(processEl, BPMN_NS, "extensionElements");
        if (ext == null) {
            ext = findDirectChildElement(processEl, null, "extensionElements");
        }
        if (ext == null) return out;

        for (org.w3c.dom.Element container : listChildElements(ext)) {
            if (container == null) continue;
            if (!EXCELPRO_NS.equals(container.getNamespaceURI())) continue;
            String ln = container.getLocalName();
            if (ln == null) continue;
            if (!"submitterCandidates".equalsIgnoreCase(ln)) continue;

            for (org.w3c.dom.Element c : listChildElements(container)) {
                if (c == null) continue;
                if (!EXCELPRO_NS.equals(c.getNamespaceURI())) continue;
                if (c.getLocalName() == null || !"candidate".equalsIgnoreCase(c.getLocalName())) continue;

                String orgCode = emptyToNull(c.getAttribute("orgCode"));
                String positionCode = emptyToNull(c.getAttribute("positionCode"));
                if (orgCode == null && positionCode == null) continue;
                out.add(new CandidatePair(orgCode, positionCode));
            }
        }

        return out;
    }

    private org.w3c.dom.Element findFirstProcessElement(org.w3c.dom.Document doc) {
        if (doc == null) return null;
        org.w3c.dom.NodeList ps = doc.getElementsByTagNameNS(BPMN_NS, "process");
        if (ps == null || ps.getLength() == 0) {
            ps = doc.getElementsByTagName("process");
        }
        if (ps != null && ps.getLength() > 0 && ps.item(0) instanceof org.w3c.dom.Element e) {
            return e;
        }
        // Fallback: scan all elements
        org.w3c.dom.NodeList all = doc.getElementsByTagName("*");
        for (int i = 0; i < all.getLength(); i++) {
            org.w3c.dom.Node n = all.item(i);
            if (!(n instanceof org.w3c.dom.Element e)) continue;
            String local = e.getLocalName();
            String name = e.getNodeName();
            if ("process".equalsIgnoreCase(local) || "process".equalsIgnoreCase(name) || (name != null && name.toLowerCase(java.util.Locale.ROOT).endsWith(":process"))) {
                return e;
            }
        }
        return null;
    }

    private boolean hasAnyExcelproCandidateNode(org.w3c.dom.Element extensionElements) {
        if (extensionElements == null) return false;
        for (org.w3c.dom.Element container : findExcelproCandidatesContainers(extensionElements)) {
            for (org.w3c.dom.Element child : listChildElements(container)) {
                if (child == null) continue;
                if (EXCELPRO_NS.equals(child.getNamespaceURI()) && "candidate".equalsIgnoreCase(child.getLocalName())) {
                    return true;
                }
            }
        }
        return false;
    }

    private int removeEmptyExcelproCandidatesContainers(org.w3c.dom.Element extensionElements) {
        if (extensionElements == null) return 0;
        int removed = 0;
        List<org.w3c.dom.Element> containers = findExcelproCandidatesContainers(extensionElements);
        for (org.w3c.dom.Element c : containers) {
            boolean hasCandidate = false;
            for (org.w3c.dom.Element child : listChildElements(c)) {
                if (child == null) continue;
                if (EXCELPRO_NS.equals(child.getNamespaceURI()) && "candidate".equalsIgnoreCase(child.getLocalName())) {
                    hasCandidate = true;
                    break;
                }
            }
            if (!hasCandidate) {
                org.w3c.dom.Node parent = c.getParentNode();
                if (parent != null) {
                    parent.removeChild(c);
                    removed++;
                }
            }
        }
        return removed;
    }

    private org.w3c.dom.Element findExcelproCandidatesContainer(org.w3c.dom.Element extensionElements) {
        List<org.w3c.dom.Element> all = findExcelproCandidatesContainers(extensionElements);
        if (all.isEmpty()) return null;
        // Prefer a container that already has candidate nodes (even though caller usually checks)
        for (org.w3c.dom.Element c : all) {
            for (org.w3c.dom.Element child : listChildElements(c)) {
                if (child != null && EXCELPRO_NS.equals(child.getNamespaceURI()) && "candidate".equalsIgnoreCase(child.getLocalName())) {
                    return c;
                }
            }
        }
        return all.get(0);
    }

    private List<org.w3c.dom.Element> findExcelproCandidatesContainers(org.w3c.dom.Element extensionElements) {
        List<org.w3c.dom.Element> out = new java.util.ArrayList<>();
        if (extensionElements == null) return out;
        for (org.w3c.dom.Element child : listChildElements(extensionElements)) {
            if (child == null) continue;
            String ns = child.getNamespaceURI();
            String ln = child.getLocalName();
            if (!EXCELPRO_NS.equals(ns)) continue;
            if (ln == null || !"candidates".equalsIgnoreCase(ln)) continue;
            out.add(child);
        }
        return out;
    }

    private void ensureNamespaceDeclared(org.w3c.dom.Element root, String prefix, String ns) {
        if (root == null || prefix == null || prefix.isBlank() || ns == null || ns.isBlank()) return;
        String attrName = "xmlns:" + prefix;
        String existing = root.getAttribute(attrName);
        if (existing != null && !existing.isBlank()) return;
        root.setAttribute(attrName, ns);
    }

    private org.w3c.dom.Element findDirectChildElement(org.w3c.dom.Element parent, String namespaceUri, String localName) {
        if (parent == null || localName == null) return null;
        org.w3c.dom.NodeList kids = parent.getChildNodes();
        for (int i = 0; i < kids.getLength(); i++) {
            org.w3c.dom.Node n = kids.item(i);
            if (!(n instanceof org.w3c.dom.Element e)) continue;
            String ln = e.getLocalName();
            String nn = e.getNodeName();
            boolean nameOk = localName.equalsIgnoreCase(ln) || localName.equalsIgnoreCase(nn) || (nn != null && nn.toLowerCase(java.util.Locale.ROOT).endsWith(":" + localName.toLowerCase(java.util.Locale.ROOT)));
            if (!nameOk) continue;
            if (namespaceUri == null) return e;
            if (namespaceUri.equals(e.getNamespaceURI())) return e;
        }
        return null;
    }

    private void insertExtensionElementsBeforeFirstIncOut(org.w3c.dom.Element task, org.w3c.dom.Element ext) {
        // Insert before first incoming/outgoing to keep BPMN readable
        org.w3c.dom.NodeList kids = task.getChildNodes();
        for (int i = 0; i < kids.getLength(); i++) {
            org.w3c.dom.Node n = kids.item(i);
            if (!(n instanceof org.w3c.dom.Element e)) continue;
            String ln = e.getLocalName();
            String nn = e.getNodeName();
            if ("incoming".equalsIgnoreCase(ln) || "outgoing".equalsIgnoreCase(ln)
                    || "incoming".equalsIgnoreCase(nn) || "outgoing".equalsIgnoreCase(nn)
                    || (nn != null && (nn.toLowerCase(java.util.Locale.ROOT).endsWith(":incoming") || nn.toLowerCase(java.util.Locale.ROOT).endsWith(":outgoing")))) {
                task.insertBefore(ext, e);
                return;
            }
        }
        task.appendChild(ext);
    }

    private List<org.w3c.dom.Element> listChildElements(org.w3c.dom.Element parent) {
        List<org.w3c.dom.Element> out = new java.util.ArrayList<>();
        if (parent == null) return out;
        org.w3c.dom.NodeList kids = parent.getChildNodes();
        for (int i = 0; i < kids.getLength(); i++) {
            org.w3c.dom.Node n = kids.item(i);
            if (n instanceof org.w3c.dom.Element e) out.add(e);
        }
        return out;
    }

    private String emptyToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private record CandidatePair(String orgCode, String positionCode) {}
}
