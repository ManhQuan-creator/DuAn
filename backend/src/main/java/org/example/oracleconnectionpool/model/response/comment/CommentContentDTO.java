package org.example.oracleconnectionpool.model.response.comment;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class CommentContentDTO {
    private Long id;
    private Long userId;// reference tới UserDto
    private String isDeleted;
    private String content;
    private String tag;
    private String tagName;
    private String type;
    private Long groupId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

