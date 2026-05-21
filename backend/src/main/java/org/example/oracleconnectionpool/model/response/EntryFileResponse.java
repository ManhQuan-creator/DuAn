package org.example.oracleconnectionpool.model.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class EntryFileResponse {
    private Long id;
    private Long entryId;
    private String fileName;
    private String originalFileName;
    private Long fileSize;
    private String fileType;
    private String createdBy;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;
}
