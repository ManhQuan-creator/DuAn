package org.example.oracleconnectionpool.model.request.workflow;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowActionRequest {

    @NotBlank(message = "Action không được để trống")
    private String action; // APPROVE, RETURN, REJECT, RESUBMIT, CANCEL

    private String comment; // Bắt buộc khi RETURN/REJECT
}
