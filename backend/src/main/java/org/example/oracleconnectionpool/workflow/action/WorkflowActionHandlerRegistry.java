package org.example.oracleconnectionpool.workflow.action;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Gom tất cả bean implement {@link WorkflowActionHandler} thành map theo key để dispatcher
 * lookup nhanh, và để controller expose list ra API cho FE.
 */
@Slf4j
@Component
public class WorkflowActionHandlerRegistry {

    private final Map<String, WorkflowActionHandler> handlers = new LinkedHashMap<>();
    private final List<WorkflowActionHandler> rawHandlers;

    public WorkflowActionHandlerRegistry(List<WorkflowActionHandler> rawHandlers) {
        this.rawHandlers = rawHandlers;
    }

    @PostConstruct
    void init() {
        for (WorkflowActionHandler h : rawHandlers) {
            if (h.getKey() == null || h.getKey().isBlank()) {
                log.warn("Skip handler {} vì getKey() null/blank", h.getClass().getName());
                continue;
            }
            WorkflowActionHandler existed = handlers.put(h.getKey(), h);
            if (existed != null) {
                log.warn("Trùng key handler '{}' — {} ghi đè {}",
                        h.getKey(), h.getClass().getName(), existed.getClass().getName());
            }
        }
        log.info("Registered {} workflow action handler(s): {}", handlers.size(), handlers.keySet());
    }

    public Optional<WorkflowActionHandler> find(String key) {
        if (key == null || key.isBlank()) return Optional.empty();
        return Optional.ofNullable(handlers.get(key));
    }

    public Collection<WorkflowActionHandler> all() {
        return handlers.values();
    }
}
