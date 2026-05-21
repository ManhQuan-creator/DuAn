package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.EntryFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface EntryFileRepository extends JpaRepository<EntryFile, Long> {

    List<EntryFile> findByEntryIdOrderByCreatedAtDesc(Long entryId);

    @Query("""
        SELECT e FROM EntryFile e
        WHERE e.entryId IN :entryIds
        AND (:type IS NULL OR LOWER(e.filePath) LIKE LOWER(CONCAT('%', :type, '%')))
        ORDER BY e.entryId DESC
    """)
    List<EntryFile> searchByEntryIdsAndType(
            List<Long> entryIds,
            String type
    );
}
