package org.example.oracleconnectionpool.service;

import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.entity.GridPermission;
import org.example.oracleconnectionpool.model.request.gridpermission.GridPermissionRequest;
import org.example.oracleconnectionpool.model.response.GridPermissionResponse;
import org.example.oracleconnectionpool.model.response.grid.GridPermissionUpdateResponse;
import org.example.oracleconnectionpool.repository.GridPermissionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GridPermissionService {

    private final GridPermissionRepository repository;

    public List<GridPermissionResponse> getPermissions(Long templateId) {
        return repository.findByTemplateId(templateId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(rollbackFor = Exception.class)
    public GridPermissionUpdateResponse savePermission(Long templateId, GridPermissionRequest request) {

        GridPermissionUpdateResponse response = new GridPermissionUpdateResponse();

        List<GridPermissionUpdateResponse.GridPermission> addedPermissions = new ArrayList<>();

        // ===== ADD =====
        if (request.getAddPermissionRequest() != null) {
            for (GridPermissionRequest.AddPermissionRequest addRequest : request.getAddPermissionRequest()) {
                try {
                    GridPermission entity = repository.save(GridPermission.builder()
                            .templateId(templateId)
                            .level(addRequest.getLevel())
                            .targetField(addRequest.getTargetField())
                            .targetRowCode(addRequest.getTargetRowCode())
                            .permissionType(addRequest.getPermissionType() != null
                                    ? addRequest.getPermissionType()
                                    : "ALLOW")
                            .userId(addRequest.getUserId())
                            .roleCode(addRequest.getRoleCode())
                            .build());

                    // 👉 MAP entity → response DTO
                    GridPermissionUpdateResponse.GridPermission dto =
                            new GridPermissionUpdateResponse.GridPermission();

                    dto.setId(entity.getId());
                    dto.setLevel(entity.getLevel());
                    dto.setTargetField(entity.getTargetField());
                    dto.setTargetRowCode(entity.getTargetRowCode());
                    dto.setPermissionType(entity.getPermissionType());
                    dto.setUserId(entity.getUserId());
                    dto.setRoleCode(entity.getRoleCode());
                    dto.setCreatedBy(entity.getCreatedBy());
                    dto.setCreatedAt(entity.getCreatedAt());

                    addedPermissions.add(dto);

                } catch (Exception e) {
                    throw new RuntimeException("Error while saving permission", e);
                }
            }
        }

        // ===== DELETE =====
        List<Long> deletedIds = new ArrayList<>();

        if (request.getIdDeleted() != null && !request.getIdDeleted().isEmpty()) {
            for (Long id : request.getIdDeleted()) {

                GridPermission permission = repository.findById(id)
                        .orElseThrow(() -> new RuntimeException("Permission not found with id: " + id));

                repository.delete(permission);

                deletedIds.add(id); // 👉 lưu lại id đã xóa
            }
        }

        // ===== SET RESPONSE =====
        response.setGridPermissions(addedPermissions);
        response.setIdDeleted(deletedIds);

        return response;
    }

    @Transactional
    public void deletePermission(Long id) {
        repository.deleteById(id);
    }

    @Transactional
    public void deleteAllByTemplate(Long templateId) {
        repository.deleteByTemplateId(templateId);
    }

    private GridPermissionResponse toResponse(GridPermission p) {
        return GridPermissionResponse.builder()
                .id(p.getId())
                .level(p.getLevel())
                .targetField(p.getTargetField())
                .targetRowCode(p.getTargetRowCode())
                .permissionType(p.getPermissionType())
                .userId(p.getUserId())
                .roleCode(p.getRoleCode())
                .createdBy(p.getCreatedBy())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
