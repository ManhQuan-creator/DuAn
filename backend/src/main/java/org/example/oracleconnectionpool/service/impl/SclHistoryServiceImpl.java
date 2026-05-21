package org.example.oracleconnectionpool.service.impl;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.entity.SclHistoryEntity;
import org.example.oracleconnectionpool.model.request.sqlhistory.FilterSclHistoryRequest;
import org.example.oracleconnectionpool.model.response.sqlhistory.SclHistoryResponse;
import org.example.oracleconnectionpool.repository.SclHistoryRepository;
import org.example.oracleconnectionpool.service.SclHistoryService;
import org.example.oracleconnectionpool.utils.ObjectMapperUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;


@Service
@RequiredArgsConstructor
public class SclHistoryServiceImpl implements SclHistoryService {
    private final SclHistoryRepository sclHistoryRepository;

    @Override
    public Page<SclHistoryResponse> searchHistory(FilterSclHistoryRequest request) {
        Specification<SclHistoryEntity> spec = getSearchSpecification(request);

        Pageable pageable = PageRequest.of(
                request.getPageNum(),
                request.getPageSize(),
                Sort.by("updatedAt").descending()
        );

        return sclHistoryRepository.findAll(spec, pageable)
                .map(entity -> ObjectMapperUtils.map(entity, SclHistoryResponse.class));
    }

    private Specification<SclHistoryEntity> getSearchSpecification(FilterSclHistoryRequest request) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (request.getSclCategoryId() != null) {
                predicates.add(cb.equal(root.get("sclCategoryId"), request.getSclCategoryId()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
