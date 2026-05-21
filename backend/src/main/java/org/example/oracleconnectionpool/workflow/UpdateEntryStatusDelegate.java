package org.example.oracleconnectionpool.workflow;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.camunda.bpm.engine.delegate.DelegateExecution;
import org.camunda.bpm.engine.delegate.Expression;
import org.camunda.bpm.engine.delegate.JavaDelegate;
import org.example.oracleconnectionpool.entity.GridDataEntry;
import org.example.oracleconnectionpool.repository.GridDataEntryRepository;
import org.springframework.stereotype.Component;

@Slf4j
@Component("updateEntryStatusDelegate")
@RequiredArgsConstructor
public class UpdateEntryStatusDelegate implements JavaDelegate {

    private final GridDataEntryRepository entryRepository;

    private Expression targetStatus;

    @Override
    public void execute(DelegateExecution execution) throws Exception {
        Long entryId = (Long) execution.getVariable("entryId");
        String status = (String) targetStatus.getValue(execution);

        GridDataEntry entry = entryRepository.findById(entryId)
                .orElseThrow(() -> new RuntimeException("Entry not found: " + entryId));

        entry.setStatus(status);
        entryRepository.save(entry);

        log.info("Updated entry {} status to {}", entryId, status);
    }
}
