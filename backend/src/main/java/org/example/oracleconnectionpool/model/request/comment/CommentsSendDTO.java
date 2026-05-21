package org.example.oracleconnectionpool.model.request.comment;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class CommentsSendDTO {
    private String content;
    private String tag;
    private String tagName;
    private String type;
    private Long groupId;
}
