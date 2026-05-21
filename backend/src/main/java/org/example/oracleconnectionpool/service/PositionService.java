package org.example.oracleconnectionpool.service;

import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.entity.Position;
import org.example.oracleconnectionpool.model.request.position.CreatePositionRequest;
import org.example.oracleconnectionpool.model.request.position.UpdatePositionRequest;
import org.example.oracleconnectionpool.model.response.PositionResponse;
import org.example.oracleconnectionpool.repository.PositionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PositionService {

    private final PositionRepository positionRepository;

    public List<PositionResponse> getAll() {
        return positionRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    public List<PositionResponse> getAllActive() {
        return positionRepository.findByActiveTrueOrderByPositionRankAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    public PositionResponse getById(Long id) {
        Position position = positionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy chức danh với ID: " + id));
        return toResponse(position);
    }

    @Transactional
    public PositionResponse create(CreatePositionRequest request) {
        if (positionRepository.existsByPositionCode(request.getPositionCode())) {
            throw new RuntimeException("Mã chức danh đã tồn tại: " + request.getPositionCode());
        }
        Position position = Position.builder()
                .positionCode(request.getPositionCode().toUpperCase())
                .positionName(request.getPositionName())
                .positionRank(request.getPositionRank())
                .orgLevelScope(request.getOrgLevelScope())
                .active(true)
                .build();
        return toResponse(positionRepository.save(position));
    }

    @Transactional
    public PositionResponse update(Long id, UpdatePositionRequest request) {
        Position position = positionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy chức danh với ID: " + id));

        if (request.getPositionName() != null) position.setPositionName(request.getPositionName());
        if (request.getPositionRank() != null) position.setPositionRank(request.getPositionRank());
        if (request.getOrgLevelScope() != null) position.setOrgLevelScope(request.getOrgLevelScope());
        if (request.getActive() != null) position.setActive(request.getActive());

        return toResponse(positionRepository.save(position));
    }

    @Transactional
    public void delete(Long id) {
        Position position = positionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy chức danh với ID: " + id));
        position.setActive(false);
        positionRepository.save(position);
    }

    private PositionResponse toResponse(Position p) {
        return PositionResponse.builder()
                .id(p.getId())
                .positionCode(p.getPositionCode())
                .positionName(p.getPositionName())
                .positionRank(p.getPositionRank())
                .orgLevelScope(p.getOrgLevelScope())
                .active(p.getActive())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}
