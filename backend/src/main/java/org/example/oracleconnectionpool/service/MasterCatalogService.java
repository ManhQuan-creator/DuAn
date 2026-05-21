package org.example.oracleconnectionpool.service;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.entity.MasterCatalog;
import org.example.oracleconnectionpool.entity.MasterCatalogType;
import org.example.oracleconnectionpool.exceptions.NotFoundException;
import org.example.oracleconnectionpool.model.request.catalogitem.CreateCatalogItemRequest;
import org.example.oracleconnectionpool.model.request.catalogitem.UpdateCatalogItemRequest;
import org.example.oracleconnectionpool.model.request.catalogtype.CreateCatalogTypeRequest;
import org.example.oracleconnectionpool.model.request.catalogtype.FilterCatalogRequest;
import org.example.oracleconnectionpool.model.request.catalogtype.UpdateCatalogTypeRequest;
import org.example.oracleconnectionpool.model.response.CatalogItemResponse;
import org.example.oracleconnectionpool.model.response.CatalogTypeResponse;
import org.example.oracleconnectionpool.repository.MasterCatalogRepository;
import org.example.oracleconnectionpool.repository.MasterCatalogTypeRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class MasterCatalogService {

    private final MasterCatalogRepository catalogRepository;
    private final MasterCatalogTypeRepository catalogTypeRepository;

    // === Catalog Items ===

    public List<CatalogItemResponse> getCatalogs(String type, boolean includeInactive) {
        List<MasterCatalog> entities = includeInactive
                ? catalogRepository.findByTypeOrderBySortOrderAsc(type)
                : catalogRepository.findByTypeAndActiveTrueOrderBySortOrderAsc(type);

        return entities.stream().map(this::toCatalogItemResponse).toList();
    }

    public Page<CatalogItemResponse> search(FilterCatalogRequest request) {
        Specification<MasterCatalog> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (request.getKeyword() != null && !request.getKeyword().isBlank()) {
                String pattern = "%" + request.getKeyword().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), pattern),
                        cb.like(cb.lower(root.get("note")), pattern)
                ));
            }

            if (request.getType() != null && !request.getType().isBlank()) {
                predicates.add(cb.equal(root.get("type"), request.getType()));
            }

            if (request.getActive() != null) {
                predicates.add(cb.equal(root.get("active"), request.getActive()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Pageable pageable = PageRequest.of(request.getPageNum(), request.getPageSize(), Sort.by("sortOrder").ascending());

        return catalogRepository.findAll(spec, pageable).map(catalog -> CatalogItemResponse.builder()
                .id(catalog.getId())
                .name(catalog.getName())
                .parentId(catalog.getParentId())
                .note(catalog.getNote())
                .type(catalog.getType())
                .sortOrder(catalog.getSortOrder())
                .active(catalog.getActive())
                .build());
    }

    // === Catalog Types ===

    public List<CatalogTypeResponse> getCatalogTypes(boolean includeInactive) {
        List<MasterCatalogType> entities = includeInactive
                ? catalogTypeRepository.findAllByOrderBySortOrderAsc()
                : catalogTypeRepository.findByActiveTrueOrderBySortOrderAsc();

        return entities.stream().map(this::toCatalogTypeResponse).toList();
    }

    public CatalogTypeResponse createCatalogType(CreateCatalogTypeRequest request) {
        if (catalogTypeRepository.existsByType(request.getType())) {
            throw new RuntimeException("Catalog type '" + request.getType() + "' already exists");
        }

        Integer maxSort = catalogTypeRepository.findAllByOrderBySortOrderAsc().stream()
                .map(MasterCatalogType::getSortOrder)
                .filter(s -> s != null)
                .max(Integer::compareTo)
                .orElse(0);

        MasterCatalogType entity = MasterCatalogType.builder()
                .type(request.getType())
                .name(request.getName())
                .description(request.getDescription())
                .icon(request.getIcon())
                .sortOrder(maxSort + 1)
                .active(true)
                .build();

        return toCatalogTypeResponse(catalogTypeRepository.save(entity));
    }

    public CatalogTypeResponse updateCatalogType(Long id, UpdateCatalogTypeRequest request) {
        MasterCatalogType entity = catalogTypeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Catalog type not found with id: " + id));

        if (request.getName() != null) entity.setName(request.getName());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getIcon() != null) entity.setIcon(request.getIcon());
        if (request.getSortOrder() != null) entity.setSortOrder(request.getSortOrder());
        if (request.getActive() != null) entity.setActive(request.getActive());

        return toCatalogTypeResponse(catalogTypeRepository.save(entity));
    }

    public CatalogItemResponse createCatalogItem(CreateCatalogItemRequest request) {
        if (catalogRepository.existsById(request.getId())) {
            throw new NotFoundException("Catalog item with id '" + request.getId() + "' does not exist");
        }

        if (!catalogTypeRepository.existsByType(request.getType())) {
            throw new NotFoundException("Catalog type '" + request.getType() + "' does not exist");
        }

        Integer sortOrder = request.getSortOrder();
        if (sortOrder == null) {
            sortOrder = (int) catalogRepository.countByTypeAndActiveTrue(request.getType()) + 1;
        }

        MasterCatalog entity = MasterCatalog.builder()
                .id(request.getId())
                .name(request.getName())
                .type(request.getType())
                .parentId(request.getParentId())
                .note(request.getNote())
                .sortOrder(sortOrder)
                .active(true)
                .build();

        return toCatalogItemResponse(catalogRepository.save(entity));
    }

    public CatalogItemResponse updateCatalogItem(String id, UpdateCatalogItemRequest request) {
        MasterCatalog entity = catalogRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Catalog item not found with id: " + id));

        if (request.getName() != null) entity.setName(request.getName());
        if (request.getParentId() != null) entity.setParentId(request.getParentId());
        if (request.getNote() != null) entity.setNote(request.getNote());
        if (request.getSortOrder() != null) entity.setSortOrder(request.getSortOrder());
        if (request.getActive() != null) entity.setActive(request.getActive());

        return toCatalogItemResponse(catalogRepository.save(entity));
    }

    public void deleteCatalogItem(String id) {
        MasterCatalog entity = catalogRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Catalog item not found with id: " + id));

        entity.setActive(false);
        catalogRepository.delete(entity);
    }

    public long countItemsByType(String type) {
        return catalogRepository.countByTypeAndActiveTrue(type);
    }

    /**
     * Lookup map id → name cho catalog active của 1 type (vd {@code CT_DIEN_LUC}).
     * Dùng khi caller cần tra tên đầy đủ từ id (vd "PCHP" → "Công ty Điện lực Hải Phòng")
     * mà không cần load full {@link CatalogItemResponse}. Trả {@link LinkedHashMap} giữ
     * thứ tự sortOrder để consumer iterate có thứ tự ổn định.
     */
    public Map<String, String> getCatalogNameMap(String type) {
        List<MasterCatalog> entities = catalogRepository.findByTypeAndActiveTrueOrderBySortOrderAsc(type);
        Map<String, String> map = new LinkedHashMap<>(entities.size());
        for (MasterCatalog e : entities) {
            map.put(e.getId(), e.getName());
        }
        return map;
    }

    // === Mappers ===

    private CatalogItemResponse toCatalogItemResponse(MasterCatalog entity) {
        return CatalogItemResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .parentId(entity.getParentId())
                .note(entity.getNote())
                .type(entity.getType())
                .sortOrder(entity.getSortOrder())
                .active(entity.getActive())
                .build();
    }

    private CatalogTypeResponse toCatalogTypeResponse(MasterCatalogType entity) {
        return CatalogTypeResponse.builder()
                .id(entity.getId())
                .type(entity.getType())
                .name(entity.getName())
                .description(entity.getDescription())
                .icon(entity.getIcon())
                .sortOrder(entity.getSortOrder())
                .active(entity.getActive())
                .build();
    }
    public void deleteCatalogType(Long id) {
    	 MasterCatalogType entity = catalogTypeRepository.findById(id)
    	            .orElseThrow(() -> new RuntimeException("Not found"));
    
		
		entity.setActive(false);
		catalogTypeRepository.delete(entity);
		
	}
}
