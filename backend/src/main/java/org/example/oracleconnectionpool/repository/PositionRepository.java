package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.Position;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PositionRepository extends JpaRepository<Position, Long> {
    Optional<Position> findByPositionCode(String positionCode);
    boolean existsByPositionCode(String positionCode);
    List<Position> findByActiveTrueOrderByPositionRankAsc();
    List<Position> findByOrgLevelScopeInAndActiveTrueOrderByPositionRankAsc(List<String> scopes);
}
