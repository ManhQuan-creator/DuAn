package org.example.oracleconnectionpool.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.entity.EntryFile;
import org.example.oracleconnectionpool.exceptions.NotFoundException;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.request.comment.CommentsEditDTO;
import org.example.oracleconnectionpool.model.request.comment.CommentsRequestDTO;
import org.example.oracleconnectionpool.model.request.comment.CommentsSendDTO;
import org.example.oracleconnectionpool.model.response.EntryFileResponse;
import org.example.oracleconnectionpool.model.response.comment.CommentsResponseDTO;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.example.oracleconnectionpool.service.CommentsService;
import org.example.oracleconnectionpool.service.EntryFileService;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping(Api.V1.COMMENTS)
@RequiredArgsConstructor
public class CommentsController {

    private final CommentsService service;
    private final EntryFileService entryFileService;

    // ================== GET COMMENT ==================
    @PostMapping()
    public ResponseEntity<ResponseData<CommentsResponseDTO>> getComments(
            @AuthenticationPrincipal AppUserDetails userDetail,
            @RequestBody CommentsRequestDTO request) {

        return ResponseEntity.ok(
                new ResponseData<CommentsResponseDTO>()
                        .success(service.getComment(userDetail, request))
        );
    }

    // ================== SEND COMMENT ==================
    @PostMapping(value = "send", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ResponseData<?>> sendComment(
            @AuthenticationPrincipal AppUserDetails userDetail,
            @RequestPart(value = "files", required = false) List<MultipartFile> files,
            @RequestPart("request") @Valid CommentsSendDTO request) {

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new ResponseData<>()
                        .success(service.sendComment(userDetail, files, request)));
    }

    // ================== EDIT COMMENT ==================
    @PostMapping("edit")
    public ResponseEntity<ResponseData<Void>> editComment(
            @AuthenticationPrincipal AppUserDetails userDetail,
            @Valid @RequestBody CommentsEditDTO request) {

        service.editComment(userDetail, request);

        return ResponseEntity.ok(new ResponseData<Void>().success());
    }

    // ================== DELETE COMMENT ==================
    @PostMapping("delete/{id}")
    public ResponseEntity<ResponseData<Void>> deleteComment(@PathVariable Long id) {

        service.delete(id);

        return ResponseEntity.ok(new ResponseData<Void>().success());
    }

    // ================== ATTACH COMMENT ==================

    @GetMapping("attach/{entryId}/download/{fileId}")
    public ResponseEntity<Resource> downloadAttachComment(
            @PathVariable Long entryId,
            @PathVariable Long fileId) {
        EntryFile file = entryFileService.getForDownloadFolderFile(entryId, fileId);
        InputStream in;
        try {
            in = entryFileService.openStream(file);
        } catch (IOException e) {
            throw new NotFoundException("Không đọc được file: " + file.getOriginalFileName());
        }

        String encodedName = URLEncoder.encode(file.getOriginalFileName(), StandardCharsets.UTF_8)
                .replace("+", "%20");
        String contentType = file.getFileType() != null && !file.getFileType().isBlank()
                ? file.getFileType() : MediaType.APPLICATION_OCTET_STREAM_VALUE;

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename*=UTF-8''" + encodedName)
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .contentLength(file.getFileSize() != null ? file.getFileSize() : -1L)
                .body(new InputStreamResource(in));
    }
}
