package org.example.oracleconnectionpool.model.response.comment;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.example.oracleconnectionpool.model.response.EntryFileResponse;

import java.time.LocalDateTime;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class CommentsResponseDTO {
    private UserCommentDTO currentUser;
    private List<UserCommentDTO> userComments;
    private List<CommentContentDTO> commentContents;
    private List<EntryFileResponse> attachComments;
}
