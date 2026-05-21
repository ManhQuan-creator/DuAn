package org.example.oracleconnectionpool.model.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.example.oracleconnectionpool.model.base.OptionDTO;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class IdsDTO {
    private List<Long> ids;
    private List<OptionDTO> assessmentUnit;
    private String rejectReason;
    private String status;
}
