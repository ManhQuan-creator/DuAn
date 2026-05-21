package org.example.oracleconnectionpool.model.response.sclassessment;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.example.oracleconnectionpool.model.response.comment.CommentContentDTO;
import org.example.oracleconnectionpool.model.response.comment.UserCommentDTO;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class UnitAssessmentDTO {
    private Long id;
    private String status;
    private String assessmentDeptCode;
    private String assessmentDeptName;
    private List<CommentContentDTO> commentContents;
}
