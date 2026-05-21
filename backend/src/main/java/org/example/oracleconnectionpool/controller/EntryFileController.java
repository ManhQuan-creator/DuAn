package org.example.oracleconnectionpool.controller;

import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.entity.EntryFile;
import org.example.oracleconnectionpool.exceptions.NotFoundException;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.response.EntryFileResponse;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.example.oracleconnectionpool.service.EntryFileService;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
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
@RequestMapping(Api.V1.GRID_TEMPLATE + "/{templateId}/entries/{entryId}/files")
@RequiredArgsConstructor
public class EntryFileController {

    private final EntryFileService entryFileService;

    @GetMapping
    public ResponseEntity<ResponseData<List<EntryFileResponse>>> list(
            @PathVariable Long templateId,
            @PathVariable Long entryId,
            @AuthenticationPrincipal AppUserDetails currentUser) {
        return ResponseEntity.ok(new ResponseData<List<EntryFileResponse>>()
                .success(entryFileService.listByEntry(templateId, entryId, currentUser)));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ResponseData<List<EntryFileResponse>>> upload(
            @PathVariable Long templateId,
            @PathVariable Long entryId,
            @RequestPart("files") List<MultipartFile> files,
            @AuthenticationPrincipal AppUserDetails currentUser) {
        return ResponseEntity.ok(new ResponseData<List<EntryFileResponse>>()
                .success(entryFileService.upload(templateId, entryId, files, currentUser)));
    }

    @DeleteMapping("/{fileId}")
    public ResponseEntity<ResponseData<Void>> delete(
            @PathVariable Long templateId,
            @PathVariable Long entryId,
            @PathVariable Long fileId,
            @AuthenticationPrincipal AppUserDetails currentUser) {
        entryFileService.delete(templateId, entryId, fileId, currentUser);
        return ResponseEntity.ok(new ResponseData<Void>().success());
    }

    @GetMapping("/{fileId}/download")
    public ResponseEntity<Resource> download(
            @PathVariable Long templateId,
            @PathVariable Long entryId,
            @PathVariable Long fileId,
            @AuthenticationPrincipal AppUserDetails currentUser) {
        EntryFile file = entryFileService.getForDownload(templateId, entryId, fileId, currentUser);
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
