package org.example.oracleconnectionpool.service;

import org.example.oracleconnectionpool.entity.CommentsEntity;
import org.example.oracleconnectionpool.model.request.comment.CommentsEditDTO;
import org.example.oracleconnectionpool.model.request.comment.CommentsRequestDTO;
import org.example.oracleconnectionpool.model.request.comment.CommentsSendDTO;
import org.example.oracleconnectionpool.model.response.EntryFileResponse;
import org.example.oracleconnectionpool.model.response.comment.CommentsResponseDTO;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface CommentsService {
    CommentsResponseDTO getComment (AppUserDetails userDetails, CommentsRequestDTO commentsRequestDTO);

    CommentsEntity sendComment (AppUserDetails userDetail, List<MultipartFile> files, CommentsSendDTO commentsSendDTO);

    void editComment (AppUserDetails userDetail, CommentsEditDTO commentsEditDTO);

    void delete (Long id);
}
