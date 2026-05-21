package org.example.oracleconnectionpool.service;

import lombok.Builder;
import lombok.Data;
import org.w3c.dom.*;

import javax.xml.XMLConstants;
import javax.xml.namespace.NamespaceContext;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPath;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Extract workflow steps + candidates from BPMN XML.
 *
 * Current conventions (based on frontend bpmn-js editor):
 * - Each bpmn:UserTask has camunda:Properties containing:
 *   - statusAfterApprove, returnTarget, notifyMessage
 *   - onApproveHandlerKey, onReturnHandlerKey, onRejectHandlerKey
 * - Each bpmn:UserTask may have extension excelpro:Candidates/excelpro:Candidate with attrs orgCode/positionCode.
 * - Step key = userTask @id (or without "_task" suffix)
 */
public class WorkflowStepXmlExtractorService {

    private static final String NS_BPMN = "http://www.omg.org/spec/BPMN/20100524/MODEL";
    private static final String NS_CAMUNDA = "http://camunda.org/schema/1.0/bpmn";
    private static final String NS_EXCELPRO = "http://evnnpc.vn/workflow/excelpro";

    @Data
    @Builder
    public static class ExtractedCandidate {
        private String orgCode;
        private String positionCode;
    }

    /** Submitter candidate has the same attributes as normal candidate. */
    @Data
    @Builder
    public static class ExtractedSubmitterCandidate {
        private String orgCode;
        private String positionCode;
    }

    @Data
    @Builder
    public static class ExtractedStep {
        private int stepOrder;
        private String stepKey;
        private String stepName;
        private String candidateActionKey;
        private String statusAfterApprove;
        private String returnTarget;
        private String notifyMessage;
        private String onApproveHandlerKey;
        private String onReturnHandlerKey;
        private String onRejectHandlerKey;
        private List<ExtractedCandidate> candidates;
    }

    public List<ExtractedStep> extractSteps(String bpmnXml) {
        if (bpmnXml == null || bpmnXml.trim().isEmpty()) return List.of();

        Document doc = parseXmlSecurely(bpmnXml);
        XPath xp = newXPath();

        NodeList userTasks = (NodeList) eval(xp, doc, "//bpmn:userTask", XPathConstants.NODESET);
        List<ExtractedStep> steps = new ArrayList<>();

        for (int i = 0; i < userTasks.getLength(); i++) {
            Element ut = (Element) userTasks.item(i);

            String rawId = attr(ut, "id");
            String stepKey = normalizeStepKey(rawId);
            String stepName = attr(ut, "name");

            Map<String, String> camundaProps = readCamundaProperties(ut);

            // Candidates (excelpro namespace)
            List<ExtractedCandidate> candidates = readExcelproCandidates(ut);

            ExtractedStep step = ExtractedStep.builder()
                    .stepOrder(i + 1)
                    .stepKey(stepKey)
                    .stepName(stepName)
                    .candidateActionKey(camundaProps.getOrDefault("candidateActionKey", stepKey))
                    .statusAfterApprove(camundaProps.get("statusAfterApprove"))
                    .returnTarget(camundaProps.getOrDefault("returnTarget", "SUBMITTER"))
                    .notifyMessage(camundaProps.get("notifyMessage"))
                    .onApproveHandlerKey(emptyToNull(camundaProps.get("onApproveHandlerKey")))
                    .onReturnHandlerKey(emptyToNull(camundaProps.get("onReturnHandlerKey")))
                    .onRejectHandlerKey(emptyToNull(camundaProps.get("onRejectHandlerKey")))
                    .candidates(candidates)
                    .build();

            // Skip tasks that are not configured as workflow steps
            // (statusAfterApprove is required by current UI)
            if (step.getStatusAfterApprove() == null || step.getStatusAfterApprove().isBlank()) {
                continue;
            }

            steps.add(step);
        }

        // Order by stepOrder (already in XML order)
        return steps;
    }

    /**
     * Extract submitter candidates from BPMN XML.
     * Expected shape (as produced by frontend moddle excelpro:SubmitterCandidates):
     * <excelpro:submitterCandidates>
     *   <excelpro:candidate orgCode="..." positionCode="..." />
     * </excelpro:submitterCandidates>
     */
    public List<ExtractedSubmitterCandidate> extractSubmitterCandidates(String bpmnXml) {
        if (bpmnXml == null || bpmnXml.trim().isEmpty()) return List.of();

        Document doc = parseXmlSecurely(bpmnXml);
        XPath xp = newXPath();

        // Usually under bpmn:process/bpmn:extensionElements
        NodeList containers = (NodeList) eval(
                xp,
                doc,
                "//bpmn:process/bpmn:extensionElements/excelpro:submitterCandidates | //bpmn:process/bpmn:extensionElements/excelpro:SubmitterCandidates",
                XPathConstants.NODESET
        );

        if (containers == null || containers.getLength() == 0) return List.of();

        List<ExtractedSubmitterCandidate> out = new ArrayList<>();
        for (int i = 0; i < containers.getLength(); i++) {
            Element container = (Element) containers.item(i);
            NodeList items = container.getElementsByTagNameNS(NS_EXCELPRO, "candidate");
            for (int j = 0; j < items.getLength(); j++) {
                Element c = (Element) items.item(j);
                String orgCode = emptyToNull(attr(c, "orgCode"));
                String positionCode = emptyToNull(attr(c, "positionCode"));
                out.add(ExtractedSubmitterCandidate.builder().orgCode(orgCode).positionCode(positionCode).build());
            }
        }

        return out;
    }

    private static String normalizeStepKey(String rawId) {
        if (rawId == null) return null;
        return rawId.endsWith("_task") ? rawId.substring(0, rawId.length() - 5) : rawId;
    }

    private static Map<String, String> readCamundaProperties(Element userTask) {
        Map<String, String> out = new HashMap<>();

        NodeList ext = userTask.getElementsByTagNameNS(NS_BPMN, "extensionElements");
        if (ext.getLength() == 0) return out;

        Element extEl = (Element) ext.item(0);

        NodeList propsList = extEl.getElementsByTagNameNS(NS_CAMUNDA, "properties");
        if (propsList.getLength() == 0) return out;

        for (int i = 0; i < propsList.getLength(); i++) {
            Element props = (Element) propsList.item(i);
            NodeList values = props.getElementsByTagNameNS(NS_CAMUNDA, "property");
            for (int j = 0; j < values.getLength(); j++) {
                Element p = (Element) values.item(j);
                String name = attr(p, "name");
                String value = attr(p, "value");
                if (name != null) out.put(name, value);
            }
        }

        return out;
    }

    private static List<ExtractedCandidate> readExcelproCandidates(Element userTask) {
        List<ExtractedCandidate> out = new ArrayList<>();

        NodeList ext = userTask.getElementsByTagNameNS(NS_BPMN, "extensionElements");
        if (ext.getLength() == 0) return out;
        Element extEl = (Element) ext.item(0);

        NodeList candidatesContainers = extEl.getElementsByTagNameNS(NS_EXCELPRO, "candidates");
        if (candidatesContainers.getLength() == 0) return out;

        for (int i = 0; i < candidatesContainers.getLength(); i++) {
            Element container = (Element) candidatesContainers.item(i);
            NodeList items = container.getElementsByTagNameNS(NS_EXCELPRO, "candidate");
            for (int j = 0; j < items.getLength(); j++) {
                Element c = (Element) items.item(j);
                String orgCode = emptyToNull(attr(c, "orgCode"));
                String positionCode = emptyToNull(attr(c, "positionCode"));
                out.add(ExtractedCandidate.builder().orgCode(orgCode).positionCode(positionCode).build());
            }
        }

        return out;
    }

    private static Document parseXmlSecurely(String xml) {
        try {
            DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
            dbf.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            dbf.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            dbf.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            dbf.setExpandEntityReferences(false);
            dbf.setNamespaceAware(true);
            return dbf.newDocumentBuilder().parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new RuntimeException("Invalid BPMN XML: " + ex.getMessage(), ex);
        }
    }

    private static XPath newXPath() {
        XPath xp = XPathFactory.newInstance().newXPath();
        xp.setNamespaceContext(new NamespaceContext() {
            @Override
            public String getNamespaceURI(String prefix) {
                return switch (prefix) {
                    case "bpmn" -> NS_BPMN;
                    case "camunda" -> NS_CAMUNDA;
                    case "excelpro" -> NS_EXCELPRO;
                    default -> XMLConstants.NULL_NS_URI;
                };
            }

            @Override
            public String getPrefix(String namespaceURI) { return null; }

            @Override
            public Iterator<String> getPrefixes(String namespaceURI) { return Collections.emptyIterator(); }
        });
        return xp;
    }

    private static Object eval(XPath xp, Object item, String expr, javax.xml.namespace.QName type) {
        try {
            return xp.evaluate(expr, item, type);
        } catch (Exception ex) {
            throw new RuntimeException("XPath error: " + ex.getMessage(), ex);
        }
    }

    private static String attr(Element el, String name) {
        if (el == null || name == null) return null;
        String v = el.getAttribute(name);
        return v != null && !v.isBlank() ? v : null;
    }

    private static String emptyToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}

