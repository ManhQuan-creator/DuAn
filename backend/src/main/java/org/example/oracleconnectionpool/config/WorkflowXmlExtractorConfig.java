package org.example.oracleconnectionpool.config;

import org.example.oracleconnectionpool.service.WorkflowStepXmlExtractorService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class WorkflowXmlExtractorConfig {

    @Bean
    public WorkflowStepXmlExtractorService workflowStepXmlExtractorService() {
        return new WorkflowStepXmlExtractorService();
    }
}

