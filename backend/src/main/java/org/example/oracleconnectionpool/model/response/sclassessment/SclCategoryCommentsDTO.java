package org.example.oracleconnectionpool.model.response.sclassessment;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.example.oracleconnectionpool.model.response.EntryFileResponse;
import org.example.oracleconnectionpool.model.response.comment.UserCommentDTO;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SclCategoryCommentsDTO {
    private UserCommentDTO currentUser;
    private List<UserCommentDTO> userComments;
    private List<UnitAssessmentDTO> listUnitAssessment;
    private List<EntryFileResponse> attachComments;
}
