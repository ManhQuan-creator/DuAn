package org.example.oracleconnectionpool.service.impl;

import io.micrometer.common.lang.NonNull;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.logging.log4j.util.Strings;
import org.example.oracleconnectionpool.entity.SuggestedCategoryEntity;
import org.example.oracleconnectionpool.enums.StatusSclCategoryEnum;
import org.example.oracleconnectionpool.exceptions.BadRequestException;
import org.example.oracleconnectionpool.exceptions.NotFoundException;
import org.example.oracleconnectionpool.model.request.IdsDTO;
import org.example.oracleconnectionpool.model.request.suggestedcategory.SuggestedCategoryFilterDTO;
import org.example.oracleconnectionpool.model.request.suggestedcategory.SuggestedCategoryRequestDTO;
import org.example.oracleconnectionpool.model.response.EntryFileResponse;
import org.example.oracleconnectionpool.model.response.suggestedcategory.SuggestedCategoryResponseDTO;
import org.example.oracleconnectionpool.repository.SuggestedCategoryRepository;
import org.example.oracleconnectionpool.service.EntryFileService;
import org.example.oracleconnectionpool.service.SuggestedCategoryService;
import org.example.oracleconnectionpool.utils.ExcelUtils;
import org.example.oracleconnectionpool.utils.ObjectMapperUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.lang.Nullable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SuggestedCategoryServiceImpl implements SuggestedCategoryService {
    private final SuggestedCategoryRepository suggestedCategoryRepository;

    private final EntryFileService entryFileService;
    private final String SUGGESTED = "SUGGESTED";

    private final String DANH_SACH_TRONG = "Danh sách trống";
    private final String KHONG_TIM_THAY_DU_LIEU_VOI_ID_TUONG_UNG = "Không tìm thấy dữ liệu với id tương ứng";
    private final String BAN_GHI_DA_TON_TAI = "Bản ghi đã tồn tại";
    private final String DANH_SACH_ID_KHONG_DUOC_DE_TRONG = "Danh sách ID không được để trống";
    private final String KHONG_TIM_THAY_BAN_GHI_VOI_DANH_SACH_ID_CUNG_CAP = "Không tìm thấy bản ghi tương ứng với danh sách ID cung cấp";

    @Override
    public List<SuggestedCategoryResponseDTO> getAll() {
        List<SuggestedCategoryEntity> entityList = suggestedCategoryRepository.findAll();

        if (entityList.isEmpty()) {
            throw new NotFoundException(DANH_SACH_TRONG);
        }

        return ObjectMapperUtils.mapAll(entityList, SuggestedCategoryResponseDTO.class);
    }

    @Override
    public Page<SuggestedCategoryResponseDTO> search(SuggestedCategoryFilterDTO request) {

        Authentication user = SecurityContextHolder.getContext().getAuthentication();

        Specification<SuggestedCategoryEntity> spec = getSearchSpecification(request);

        Pageable pageable = PageRequest.of(
                request.getPageNum(),
                request.getPageSize(),
                Sort.by("updatedAt").descending()
        );

        Page<SuggestedCategoryEntity> page = suggestedCategoryRepository.findAll(spec, pageable);

        // 1. Lấy list id
        List<Long> ids = page.getContent()
                .stream()
                .map(SuggestedCategoryEntity::getId)
                .toList();

        // 2. Lấy attach
        List<EntryFileResponse> attachComments = entryFileService.listByEntryFolder(ids, SUGGESTED);

        // 3. Group theo entryId
        Map<Long, List<EntryFileResponse>> attachMap = attachComments.stream()
                .collect(Collectors.groupingBy(EntryFileResponse::getEntryId));

        // 4. Map sang DTO + set attach
        return page.map(entity -> {
            SuggestedCategoryResponseDTO dto =
                    ObjectMapperUtils.map(entity, SuggestedCategoryResponseDTO.class);

            List<EntryFileResponse> files =
                    attachMap.getOrDefault(entity.getId(), Collections.emptyList());

            dto.setAttachmentFile(files);

            return dto;
        });
    }

    @Override
    public SuggestedCategoryResponseDTO getById(Long id) {
        SuggestedCategoryEntity entity = suggestedCategoryRepository.findById(id).orElseThrow(() -> new BadRequestException(DANH_SACH_TRONG));
        return ObjectMapperUtils.map(entity, SuggestedCategoryResponseDTO.class);
    }

    @Transactional
    @Override
    public Long save(SuggestedCategoryRequestDTO request) {
        try {
            // check trùng
            checkUnique(request.getCategoryCode(), null);

            // map dto -> entity
            SuggestedCategoryEntity entity = ObjectMapperUtils.map(request, SuggestedCategoryEntity.class);

            // save
            SuggestedCategoryEntity save = suggestedCategoryRepository.save(entity);

            return save.getId();
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    @Transactional
    @Override
    public Long update(SuggestedCategoryRequestDTO request) {
        try {
            SuggestedCategoryEntity entity = suggestedCategoryRepository.findById(request.getId()).orElseThrow(() -> new NotFoundException(KHONG_TIM_THAY_DU_LIEU_VOI_ID_TUONG_UNG));

            // check trùng
            checkUnique(request.getCategoryCode(), entity.getId());

            // mapper
            ObjectMapperUtils.map(request, entity);

            suggestedCategoryRepository.save(entity);

            return entity.getId();
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    @Transactional
    @Override
    public void delete(IdsDTO idsDTO) {
        if (idsDTO == null || idsDTO.getIds() == null || idsDTO.getIds().isEmpty()) {
            throw new BadRequestException(DANH_SACH_ID_KHONG_DUOC_DE_TRONG);
        }

        // thêm vào danh sách id
        List<Long> listIds = idsDTO.getIds();

        List<SuggestedCategoryEntity> entityList = suggestedCategoryRepository.findByIdIn(listIds);

        if (entityList.isEmpty()) {
            throw new NotFoundException(KHONG_TIM_THAY_BAN_GHI_VOI_DANH_SACH_ID_CUNG_CAP);
        }

        // lấy những id tồn tại trong db
        List<Long> foundIds = entityList.stream()
                .map(SuggestedCategoryEntity::getId)
                .toList();

        List<Long> notFoundIds = listIds.stream()
                .filter(id -> !foundIds.contains(id))
                .toList();

        if (!notFoundIds.isEmpty()) {
            throw new BadRequestException("Không tìm thấy các bản ghi: " + notFoundIds);
        }

        suggestedCategoryRepository.deleteAll(entityList);
    }

    public void checkUnique(String categoryCode, Long id) {
        boolean isExists = suggestedCategoryRepository.existsByAssetCode(categoryCode, id);
        if (isExists) {
            throw new BadRequestException(BAN_GHI_DA_TON_TAI);
        }
    }

    private Specification<SuggestedCategoryEntity> getSearchSpecification(final SuggestedCategoryFilterDTO request) {
        return new Specification<SuggestedCategoryEntity>() {

            private static final long serialVersionUID = 6345534328548406667L;

            @Override
            @Nullable
            public Predicate toPredicate(@NonNull Root<SuggestedCategoryEntity> root, @NonNull CriteriaQuery<?> query,
                                         @NonNull CriteriaBuilder criteriaBuilder) {
                List<Predicate> predicates = new ArrayList<>();

                if (Strings.isNotBlank(request.getUnitName())) {
                    predicates.add(criteriaBuilder.like(criteriaBuilder.lower(root.get("unitName")),
                            "%" + request.getUnitName().trim().toLowerCase() + "%"));
                }

                if (Strings.isNotBlank(request.getCategoryName())) {
                    predicates.add(criteriaBuilder.like(criteriaBuilder.lower(root.get("categoryName")),
                            "%" + request.getCategoryName().trim().toLowerCase() + "%"));
                }

                if (Strings.isNotBlank(request.getCategoryCode())) {
                    predicates.add(criteriaBuilder.like(criteriaBuilder.lower(root.get("categoryCode")),
                            "%" + request.getCategoryCode().trim().toLowerCase() + "%"));
                }

                if (Strings.isNotBlank(request.getStatus())) {
                    predicates.add(criteriaBuilder.like(criteriaBuilder.lower(root.get("status")),
                            "%" + request.getStatus().trim().toLowerCase() + "%"));
                }

                if (Strings.isNotBlank(request.getYearPlan())) {
                    predicates.add(criteriaBuilder.like(criteriaBuilder.lower(root.get("yearPlan")),
                            "%" + request.getYearPlan().trim().toLowerCase() + "%"));
                }

                return criteriaBuilder.and(predicates.toArray(new Predicate[predicates.size()]));
            }
        };
    }

    @Override
    public void exportExcel(SuggestedCategoryFilterDTO filter, HttpServletResponse response) {
        Specification<SuggestedCategoryEntity> specification = getSearchSpecification(filter);

        List<SuggestedCategoryResponseDTO> result = suggestedCategoryRepository.findAll(specification).stream()
                .map(entity -> ObjectMapperUtils.map(entity, SuggestedCategoryResponseDTO.class))
                .toList();

        List<SuggestedCategoryResponseDTO> res = result.stream().map(e -> {
            SuggestedCategoryResponseDTO item = ObjectMapperUtils.map(e, SuggestedCategoryResponseDTO.class);
            if (e.getStatus() != null && !e.getStatus().isEmpty()) {
                StatusSclCategoryEnum status = StatusSclCategoryEnum.fromKey(e.getStatus());
                item.setStatus(status != null ? status.getValue() : "Không xác định");
            }
            return item;
        }).collect(Collectors.toList());

        ExcelUtils.export(response, SuggestedCategoryResponseDTO.class, res, "Danh sách danh mục gợi ý");
    }
}
