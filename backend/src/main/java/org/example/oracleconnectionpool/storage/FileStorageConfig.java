package org.example.oracleconnectionpool.storage;

import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.config.FileStorageProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
public class FileStorageConfig {

    @Bean
    public FileStorage fileStorage(FileStorageProperties properties) {
        FileStorage impl = switch (properties.getStorageMode()) {
            case SFTP  -> new SftpFileStorage(properties);
            case LOCAL -> new LocalFileStorage(properties);
        };
        log.info("FileStorage mode = {} — {}", properties.getStorageMode(), impl.describe());
        return impl;
    }
}
