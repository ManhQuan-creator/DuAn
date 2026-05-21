package org.example.oracleconnectionpool.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.oracleconnectionpool.entity.SidebarMenu;
import org.example.oracleconnectionpool.model.request.sidebarmenu.CreateSidebarMenuRequest;
import org.example.oracleconnectionpool.model.request.sidebarmenu.UpdateSidebarMenuRequest;
import org.example.oracleconnectionpool.model.response.sidebarmenu.PermissionRule;
import org.example.oracleconnectionpool.model.response.sidebarmenu.SidebarMenuNode;
import org.example.oracleconnectionpool.repository.SidebarMenuRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class SidebarMenuService {

    private final SidebarMenuRepository repository;
    private final ObjectMapper objectMapper;

    private static final TypeReference<List<PermissionRule>> RULES_TYPE_REF =
            new TypeReference<List<PermissionRule>>() {};

    /** Trả về danh sách menu phẳng (mọi trạng thái), sắp xếp theo SORT_ORDER */
    public List<SidebarMenu> findAll() {
        return repository.findAllByOrderBySortOrderAscIdAsc();
    }

    /** Trả về cây menu chỉ chứa item active — dùng cho sidebar runtime */
    public List<SidebarMenuNode> getActiveTree() {
        List<SidebarMenu> all = repository.findByActiveTrueOrderBySortOrderAscIdAsc();
        return buildTree(all);
    }

    /** Trả về cây menu đầy đủ (cả inactive) — dùng cho admin manager */
    public List<SidebarMenuNode> getFullTree() {
        List<SidebarMenu> all = repository.findAllByOrderBySortOrderAscIdAsc();
        return buildTree(all);
    }

    public SidebarMenu getById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy menu với ID: " + id));
    }

    @Transactional
    public SidebarMenu create(CreateSidebarMenuRequest request) {
        String key = request.getMenuKey().trim();
        if (repository.existsByMenuKey(key)) {
            throw new RuntimeException("Menu key '" + key + "' đã tồn tại");
        }
        if (request.getParentId() != null && !repository.existsById(request.getParentId())) {
            throw new RuntimeException("Menu cha không tồn tại");
        }
        SidebarMenu entity = SidebarMenu.builder()
                .parentId(request.getParentId())
                .menuKey(key)
                .label(request.getLabel().trim())
                .path(trimOrNull(request.getPath()))
                .icon(trimOrNull(request.getIcon()))
                .sortOrder(request.getSortOrder() != null ? request.getSortOrder() : nextSortOrder(request.getParentId()))
                .orgGroupCode(trimOrNull(request.getOrgGroupCode()))
                .permissionRules(serializeRules(normalizeRules(request.getPermissionRules())))
                .active(true)
                .build();
        return repository.save(entity);
    }

    @Transactional
    public SidebarMenu update(Long id, UpdateSidebarMenuRequest request) {
        SidebarMenu entity = getById(id);

        if (request.getMenuKey() != null) {
            String newKey = request.getMenuKey().trim();
            if (!newKey.equals(entity.getMenuKey()) && repository.existsByMenuKey(newKey)) {
                throw new RuntimeException("Menu key '" + newKey + "' đã tồn tại");
            }
            entity.setMenuKey(newKey);
        }
        if (request.getLabel() != null) entity.setLabel(request.getLabel().trim());
        if (request.getPath() != null) entity.setPath(trimOrNull(request.getPath()));
        if (request.getIcon() != null) entity.setIcon(trimOrNull(request.getIcon()));
        if (request.getSortOrder() != null) entity.setSortOrder(request.getSortOrder());
        if (request.getActive() != null) entity.setActive(request.getActive());

        // Permission scope
        if (Boolean.TRUE.equals(request.getUpdateOrgGroupCode()) || request.getOrgGroupCode() != null) {
            entity.setOrgGroupCode(trimOrNull(request.getOrgGroupCode()));
        }
        if (Boolean.TRUE.equals(request.getUpdatePermissionRules()) || request.getPermissionRules() != null) {
            entity.setPermissionRules(serializeRules(normalizeRules(request.getPermissionRules())));
        }

        if (request.getParentId() != null) {
            // 0 hoặc -1 → null (chuyển về root)
            Long newParent = request.getParentId() <= 0 ? null : request.getParentId();
            if (newParent != null) {
                if (newParent.equals(id)) {
                    throw new RuntimeException("Menu không thể là cha của chính nó");
                }
                if (!repository.existsById(newParent)) {
                    throw new RuntimeException("Menu cha không tồn tại");
                }
                if (isDescendant(id, newParent)) {
                    throw new RuntimeException("Không thể di chuyển menu vào dưới menu con của chính nó");
                }
            }
            entity.setParentId(newParent);
        }
        return repository.save(entity);
    }

    /** Hard delete — kèm cascade theo từng nhánh con */
    @Transactional
    public void delete(Long id) {
        SidebarMenu entity = getById(id);
        deleteRecursive(entity.getId());
    }

    private void deleteRecursive(Long id) {
        List<SidebarMenu> children = repository.findByParentId(id);
        for (SidebarMenu child : children) {
            deleteRecursive(child.getId());
        }
        repository.deleteById(id);
    }

    // ===== helpers =====

    private boolean isDescendant(Long ancestorId, Long candidateId) {
        Long current = candidateId;
        Map<Long, SidebarMenu> byId = new HashMap<>();
        for (SidebarMenu m : repository.findAll()) byId.put(m.getId(), m);
        while (current != null) {
            SidebarMenu m = byId.get(current);
            if (m == null) return false;
            if (m.getId().equals(ancestorId)) return true;
            current = m.getParentId();
        }
        return false;
    }

    private Integer nextSortOrder(Long parentId) {
        List<SidebarMenu> siblings = repository.findByParentId(parentId);
        return siblings.stream()
                .map(SidebarMenu::getSortOrder)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .map(max -> max + 1)
                .orElse(1);
    }

    private String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    /**
     * Chuẩn hóa quy tắc phân quyền:
     *  - Trim & uppercase mã.
     *  - Gộp rule trùng deptCode (union positions).
     *  - Distinct positions.
     *  - Hỗ trợ rule cho lãnh đạo cấp cao (deptCode = null) — chỉ giữ nếu có ít nhất 1 position.
     *  - Top-level rule luôn được xếp đầu danh sách trả về.
     */
    private List<PermissionRule> normalizeRules(List<PermissionRule> rules) {
        if (rules == null || rules.isEmpty()) return Collections.emptyList();

        java.util.LinkedHashSet<String> topLevelPositions = new java.util.LinkedHashSet<>();
        Map<String, LinkedHashMap<String, Boolean>> deptRules = new LinkedHashMap<>();

        for (PermissionRule r : rules) {
            if (r == null) continue;
            String dept = (r.getDeptCode() == null || r.getDeptCode().isBlank())
                    ? null
                    : r.getDeptCode().trim().toUpperCase();

            if (dept == null) {
                // Top-level rule (lãnh đạo cấp cao) — gom positions vào set chung
                if (r.getPositionCodes() != null) {
                    for (String p : r.getPositionCodes()) {
                        if (p == null) continue;
                        String pc = p.trim().toUpperCase();
                        if (!pc.isEmpty()) topLevelPositions.add(pc);
                    }
                }
            } else {
                LinkedHashMap<String, Boolean> positions = deptRules.computeIfAbsent(dept, k -> new LinkedHashMap<>());
                if (r.getPositionCodes() != null) {
                    for (String p : r.getPositionCodes()) {
                        if (p == null) continue;
                        String pc = p.trim().toUpperCase();
                        if (!pc.isEmpty()) positions.put(pc, Boolean.TRUE);
                    }
                }
            }
        }

        List<PermissionRule> result = new ArrayList<>();
        // Top-level rule chỉ giữ khi có position (không cho phép wildcard "mọi lãnh đạo")
        if (!topLevelPositions.isEmpty()) {
            result.add(PermissionRule.builder()
                    .deptCode(null)
                    .positionCodes(new ArrayList<>(topLevelPositions))
                    .build());
        }
        for (Map.Entry<String, LinkedHashMap<String, Boolean>> e : deptRules.entrySet()) {
            result.add(PermissionRule.builder()
                    .deptCode(e.getKey())
                    .positionCodes(new ArrayList<>(e.getValue().keySet()))
                    .build());
        }
        return result;
    }

    private String serializeRules(List<PermissionRule> rules) {
        if (rules == null || rules.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(rules);
        } catch (JsonProcessingException e) {
            log.error("Lỗi serialize permissionRules", e);
            throw new RuntimeException("Không thể serialize permissionRules");
        }
    }

    private List<PermissionRule> deserializeRules(String json) {
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            List<PermissionRule> list = objectMapper.readValue(json, RULES_TYPE_REF);
            return list != null ? list : new ArrayList<>();
        } catch (JsonProcessingException e) {
            log.warn("permissionRules JSON không hợp lệ, bỏ qua: {}", json);
            return new ArrayList<>();
        }
    }

    private List<SidebarMenuNode> buildTree(List<SidebarMenu> all) {
        Map<Long, SidebarMenuNode> byId = new HashMap<>();
        for (SidebarMenu e : all) {
            byId.put(e.getId(), toNode(e));
        }
        List<SidebarMenuNode> roots = new ArrayList<>();
        for (SidebarMenu e : all) {
            SidebarMenuNode node = byId.get(e.getId());
            if (e.getParentId() == null) {
                roots.add(node);
            } else {
                SidebarMenuNode parent = byId.get(e.getParentId());
                if (parent != null) {
                    parent.getChildren().add(node);
                } else {
                    roots.add(node);
                }
            }
        }
        sortTree(roots);
        return roots;
    }

    private void sortTree(List<SidebarMenuNode> nodes) {
        nodes.sort(Comparator
                .comparing(SidebarMenuNode::getSortOrder, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(SidebarMenuNode::getId, Comparator.nullsLast(Comparator.naturalOrder())));
        for (SidebarMenuNode n : nodes) {
            if (n.getChildren() != null && !n.getChildren().isEmpty()) {
                sortTree(n.getChildren());
            }
        }
    }

    private SidebarMenuNode toNode(SidebarMenu e) {
        return SidebarMenuNode.builder()
                .id(e.getId())
                .parentId(e.getParentId())
                .menuKey(e.getMenuKey())
                .label(e.getLabel())
                .path(e.getPath())
                .icon(e.getIcon())
                .sortOrder(e.getSortOrder())
                .orgGroupCode(e.getOrgGroupCode())
                .permissionRules(deserializeRules(e.getPermissionRules()))
                .active(e.getActive())
                .children(new ArrayList<>())
                .build();
    }
}
