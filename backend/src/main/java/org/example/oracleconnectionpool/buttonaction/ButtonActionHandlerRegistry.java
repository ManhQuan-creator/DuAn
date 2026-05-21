package org.example.oracleconnectionpool.buttonaction;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Auto-discovers tất cả @Component implement {@link ButtonActionHandler},
 * gom thành map theo key để dispatch nhanh.
 */
@Slf4j
@Component
public class ButtonActionHandlerRegistry {

    private final Map<String, ButtonActionHandler> handlers = new LinkedHashMap<>();
    private final List<ButtonActionHandler> rawHandlers;

    public ButtonActionHandlerRegistry(List<ButtonActionHandler> rawHandlers) {
        this.rawHandlers = rawHandlers;
    }

    @PostConstruct
    void init() {
        for (ButtonActionHandler h : rawHandlers) {
            if (h.getKey() == null || h.getKey().isBlank()) {
                log.warn("Skip button handler {} vì getKey() null/blank", h.getClass().getName());
                continue;
            }
            ButtonActionHandler existed = handlers.put(h.getKey(), h);
            if (existed != null) {
                log.warn("Trùng button handler key '{}' — {} ghi đè {}",
                        h.getKey(), h.getClass().getName(), existed.getClass().getName());
            }
        }
        log.info("Registered {} button action handler(s): {}", handlers.size(), handlers.keySet());
    }

    public Optional<ButtonActionHandler> find(String key) {
        if (key == null || key.isBlank()) return Optional.empty();
        return Optional.ofNullable(handlers.get(key));
    }

    public Collection<ButtonActionHandler> all() {
        return handlers.values();
    }
}
