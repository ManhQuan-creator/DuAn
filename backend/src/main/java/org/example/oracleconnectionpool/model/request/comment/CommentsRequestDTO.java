package org.example.oracleconnectionpool.model.request.comment;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class CommentsRequestDTO {
    private String type;
    private Long groupId;
}
