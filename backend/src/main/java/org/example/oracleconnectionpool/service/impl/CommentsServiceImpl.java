package org.example.oracleconnectionpool.service.impl;

import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.entity.CommentsEntity;
import org.example.oracleconnectionpool.exceptions.BadRequestException;
import org.example.oracleconnectionpool.exceptions.NotFoundException;
import org.example.oracleconnectionpool.model.request.comment.CommentsEditDTO;
import org.example.oracleconnectionpool.model.request.comment.CommentsRequestDTO;
import org.example.oracleconnectionpool.model.request.comment.CommentsSendDTO;
import org.example.oracleconnectionpool.model.response.EntryFileResponse;
import org.example.oracleconnectionpool.model.response.comment.CommentContentDTO;
import org.example.oracleconnectionpool.model.response.comment.CommentsResponseDTO;
import org.example.oracleconnectionpool.model.response.comment.UserCommentDTO;
import org.example.oracleconnectionpool.repository.AppUserRepository;
import org.example.oracleconnectionpool.repository.CommentsRepository;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.example.oracleconnectionpool.service.CommentsService;
import org.example.oracleconnectionpool.service.EntryFileService;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class CommentsServiceImpl implements CommentsService {
    private final CommentsRepository commentsRepository;
    private final AppUserRepository appUserRepository;
    private final EntryFileService entryFileService;

    private final String ID_KHONG_DUOC_BO_TRONG = "Id không được bỏ trống";
    private final String CONTENT_KHONG_DUOC_BO_TRONG = "Content không được bỏ trống";
    private final String KHONG_NGUOI_COMMENT = "Không phải người comment";
    private final String KHONG_TIM_THAY_DU_LIEU_VOI_ID_TUONG_UNG = "Không tìm thấy dữ liệu với id tương ứng";
    private final String COMMNETS = "COMMENTS";

    @Override
    public CommentsResponseDTO getComment(AppUserDetails userDetail, CommentsRequestDTO requestDTO) {
        UserCommentDTO currentUser =
                new UserCommentDTO(
                        userDetail.getId(),
                        userDetail.getUsername(),
                        userDetail.getFullName(),
                        userDetail.getOrgGroupCode(),
                        userDetail.getCompanyCode(),
                        userDetail.getDeptCode(),
                        userDetail.getPositionCode()
                );

        List<CommentContentDTO> commentContents =
                commentsRepository.findAllByTypeAndGroupIdOrderByCreatedAtDesc(
                                requestDTO.getType(),
                                requestDTO.getGroupId()
                        ).stream()
                        .map(entity -> new CommentContentDTO(
                                entity.getId(),
                                entity.getUserId(),
                                entity.getIsDeleted(),
                                entity.getContent(),
                                entity.getTag(),
                                entity.getTagName(),
                                entity.getType(),
                                entity.getGroupId(),
                                entity.getCreatedAt(),
                                entity.getUpdatedAt()
                        ))
                        .toList();

        List<Long> userIds = commentContents.stream()
                .map(CommentContentDTO::getUserId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        List<UserCommentDTO> userComments =
                appUserRepository.findAllById(userIds)
                        .stream()
                        .map(user -> new UserCommentDTO(
                                user.getId(),
                                user.getUsername(),
                                user.getFullName(),
                                user.getOrgGroupCode(),
                                user.getCompanyCode(),
                                user.getDeptCode(),
                                user.getPositionCode()
                        ))
                        .toList();

        List<Long> ids = commentContents.stream()
                .filter(c -> "N".equals(c.getIsDeleted()))
                .map(CommentContentDTO::getId)
                .toList();

        List<EntryFileResponse> attachComments =  entryFileService.listByEntryFolder(ids, COMMNETS);

        return new CommentsResponseDTO(currentUser, userComments, commentContents, attachComments);
    }

    @Override
    public CommentsEntity sendComment(AppUserDetails userDetail, List<MultipartFile> files, CommentsSendDTO request) {
        CommentsEntity entity = new CommentsEntity();

        entity.setContent(request.getContent());
        entity.setTag(request.getTag());
        entity.setTagName(request.getTagName());
        entity.setType(request.getType());
        entity.setGroupId(request.getGroupId());
        entity.setUserId(userDetail.getId());

        commentsRepository.save(entity);
        if (files != null && !files.isEmpty()) {
            entryFileService.uploadFolderFile(entity.getId(), COMMNETS, files);
        }

        return entity;
    }

    @Override
    public void editComment(AppUserDetails userDetail, CommentsEditDTO request) {
        if (request.getId() == null) {
            throw new BadRequestException(ID_KHONG_DUOC_BO_TRONG);
        }

        if (request.getContent().trim().isEmpty()) {
            throw new BadRequestException(CONTENT_KHONG_DUOC_BO_TRONG);
        }

        CommentsEntity entity = commentsRepository.findById(request.getId())
                .orElseThrow(() -> new NotFoundException(KHONG_TIM_THAY_DU_LIEU_VOI_ID_TUONG_UNG));

        if (!entity.getUserId().equals(userDetail.getId())) {
            throw new BadRequestException(KHONG_NGUOI_COMMENT);
        }
        entity.setContent(request.getContent());

        commentsRepository.save(entity);
    }

    @Override
    public void delete(Long id) {
        if (id == null) {
            throw new BadRequestException(ID_KHONG_DUOC_BO_TRONG);
        }

        CommentsEntity entity = commentsRepository.findById(id)
                .orElseThrow(() -> new NotFoundException(KHONG_TIM_THAY_DU_LIEU_VOI_ID_TUONG_UNG));
        entity.setIsDeleted("Y");
        commentsRepository.save(entity);
    }

//    @Override
//    public List<EntryFileResponse> listAttachFile(Long id) {
//        List<Long> ids = commentsRepository.findIdsByGroupId(id);
//        entryFileService.listByEntryFolder(ids);
//        return List.of();
//    }
//
//    @Override
//    public List<EntryFileResponse> attachFile(AppUserDetails userDetails, List<MultipartFile> files, Long id) {
//        CommentsEntity entity = commentsRepository.findById(id)
//                .orElseThrow(() -> new NotFoundException(KHONG_TIM_THAY_DU_LIEU_VOI_ID_TUONG_UNG));
//        return entryFileService.uploadFolderFile(entity.getId(), COMMNETS, files);
//    }

//    @Override
//    public void deleteAttachFile(Long fileId) {
//
//    }
}
