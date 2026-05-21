package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.*;
import org.example.oracleconnectionpool.constant.WorkflowDefinitionStatus;

@Entity
@Table(name = "WORKFLOW_DEFINITION")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkflowDefinition extends AbstractAuditingUserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Long id;

    @Column(name = "WORKFLOW_KEY", nullable = false, unique = true, length = 50)
    private String workflowKey;

    @Column(name = "NAME", nullable = false, length = 200)
    private String name;

    @Column(name = "DESCRIPTION", length = 1000)
    private String description;

    @Column(name = "STATUS", length = 20)
    @Builder.Default
    private String status = WorkflowDefinitionStatus.DRAFT;

    @Column(name = "VERSION")
    @Builder.Default
    private Integer version = 1;

    @Column(name = "DEPLOYMENT_ID", length = 64)
    private String deploymentId;

    @Column(name = "BPMN_XML", columnDefinition = "CLOB")
    private String bpmnXml;
}
