package org.example.oracleconnectionpool.model.request.workflow;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class XmlBpmnRequest {

    @NotBlank(message = "bpmnXml không được để trống")
    private String bpmnXml;
}
