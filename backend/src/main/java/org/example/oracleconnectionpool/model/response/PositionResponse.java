package org.example.oracleconnectionpool.model.response;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PositionResponse {
    private Long id;
    private String positionCode;
    private String positionName;
    private Integer positionRank;
    private String orgLevelScope;
    private Boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
