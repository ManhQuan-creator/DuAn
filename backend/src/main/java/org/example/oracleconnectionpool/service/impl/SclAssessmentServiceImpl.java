package org.example.oracleconnectionpool.service.impl;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.apache.logging.log4j.util.Strings;
import org.example.oracleconnectionpool.entity.SclAssessmentEntity;
import org.example.oracleconnectionpool.entity.SclCategoryEntity;
import org.example.oracleconnectionpool.enums.StatusSclAssessmentEnum;
import org.example.oracleconnectionpool.enums.StatusSclCategoryEnum;
import org.example.oracleconnectionpool.enums.TagCommentsEnum;
import org.example.oracleconnectionpool.exceptions.BadRequestException;
import org.example.oracleconnectionpool.model.request.IdsDTO;
import org.example.oracleconnectionpool.model.request.comment.CommentsSendDTO;
import org.example.oracleconnectionpool.model.request.sclassessment.*;
import org.example.oracleconnectionpool.model.response.sclassessment.SclAssessmentDetailResponseDTO;
import org.example.oracleconnectionpool.model.response.sclassessment.SclAssessmentResponseDTO;
import org.example.oracleconnectionpool.model.response.sclcategory.SclCategoryResponseDTO;
import org.example.oracleconnectionpool.repository.SclAssessmentRepository;
import org.example.oracleconnectionpool.repository.SclCategoryRepository;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.example.oracleconnectionpool.service.CommentsService;
import org.example.oracleconnectionpool.service.SclAssessmentService;
import org.example.oracleconnectionpool.utils.ObjectMapperUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SclAssessmentServiceImpl implements SclAssessmentService {

    private final SclAssessmentRepository sclAssessmentRepository;
    private final SclCategoryRepository sclCategoryRepository;

    private final CommentsService commentsService;

    private final String SCL_ASSESSMENT = "SCL_ASSESSMENT";

    private final String DANH_SACH_TRONG = "Danh sách trống";
    private final String KHONG_TIM_THAY_DANH_MUC_THAM_DINH = "Không tìm thấy danh mục thẩm định";
    private final String MOT_SO_THAM_DINH_KHONG_TON_TAI = "Một số thẩm định không tồn tại";
    private final String KHONG_TIM_THAY_DANH_MUC = "Không tìm thấy danh mục";

    @Override
    public Page<SclAssessmentResponseDTO> search(SclAssessmentFilterDTO request, AppUserDetails userDetails) {
        Specification<SclAssessmentEntity> spec = buildSpec(request, userDetails);

        Pageable pageable = PageRequest.of(request.getPageNum(), request.getPageSize(), Sort.by("updatedAt").descending());

        return sclAssessmentRepository.findAll(spec, pageable).map(this::toResponse);
    }

    @Override
    public SclAssessmentDetailResponseDTO getCategoryById(AppUserDetails userDetail, Long id) {
        SclAssessmentEntity assessmentEntity = sclAssessmentRepository.findById(id).orElseThrow(() -> new BadRequestException(KHONG_TIM_THAY_DANH_MUC_THAM_DINH));

        SclCategoryEntity entity = sclCategoryRepository.findById(assessmentEntity.getCategoryId()).orElseThrow(() -> new BadRequestException(KHONG_TIM_THAY_DANH_MUC));

        SclAssessmentDetailResponseDTO res = ObjectMapperUtils.map(assessmentEntity, SclAssessmentDetailResponseDTO.class);

        res.setCategoryResponse(ObjectMapperUtils.map(entity, SclCategoryResponseDTO.class));

        return res;
    }

    @Override
    public void approve(AppUserDetails userDetails, Long id) {
        SclAssessmentEntity assessment = sclAssessmentRepository.findById(id)
                .orElseThrow(() -> new BadRequestException(KHONG_TIM_THAY_DANH_MUC_THAM_DINH));

        assessment.setStatus(StatusSclAssessmentEnum.DONG_Y_TD.getKey());
        CommentsSendDTO sendDTO = new CommentsSendDTO(null, TagCommentsEnum.SUCCESS.getKey(), "Đồng ý",SCL_ASSESSMENT, assessment.getId());
        commentsService.sendComment(userDetails, null, sendDTO);
        sclAssessmentRepository.save(assessment);
        updateCategoryStatus(assessment.getCategoryId());
    }

    @Override
    public void reject(AppUserDetails userDetails, List<MultipartFile> files, RejectRequestDTO request) {
        SclAssessmentEntity assessment = sclAssessmentRepository.findById(request.getId())
                .orElseThrow(() -> new BadRequestException(KHONG_TIM_THAY_DANH_MUC_THAM_DINH));

        assessment.setStatus(StatusSclAssessmentEnum.TU_CHOI_TD.getKey());
        CommentsSendDTO sendDTO = new CommentsSendDTO(request.getReason(), TagCommentsEnum.ERROR.getKey(), "Từ chối",SCL_ASSESSMENT, assessment.getId());
        commentsService.sendComment(userDetails, files, sendDTO);
        sclAssessmentRepository.save(assessment);
        updateCategoryStatus(assessment.getCategoryId());
    }

    @Override
    public void revise(AppUserDetails userDetails, ReviseRequestDTO request) {
        SclAssessmentEntity assessment = sclAssessmentRepository.findById(request.getId())
                .orElseThrow(() -> new BadRequestException(KHONG_TIM_THAY_DANH_MUC_THAM_DINH));

        assessment.setStatus(StatusSclAssessmentEnum.CAN_HIEU_CHINH.getKey());
        CommentsSendDTO sendDTO = new CommentsSendDTO(null, TagCommentsEnum.SUCCESS.getKey(), "Yêu cầu hiệu chỉnh",SCL_ASSESSMENT, assessment.getId());
        commentsService.sendComment(userDetails, null, sendDTO);
        sclAssessmentRepository.save(assessment);
        updateCategoryStatus(assessment.getCategoryId());
    }

// ============================================================
// PRIVATE HELPER
// ============================================================

    private void updateCategoryStatus(Long categoryId) {

        List<SclAssessmentStatusProjection> assessments =
                sclAssessmentRepository.findAssessmentByCategoryId(categoryId);

        if (assessments.isEmpty()) {
            return;
        }

        // =========================================================
        // Lấy danh sách status
        // =========================================================
        Set<String> statuses = assessments.stream()
                .map(SclAssessmentStatusProjection::getStatus)
                .collect(Collectors.toSet());

        // Nếu còn assessment đang ở trạng thái DA_GUI_TD thì bỏ qua, chưa xét category
        boolean hasInProgress = statuses.contains(
                StatusSclAssessmentEnum.DA_GUI_TD.getKey()
        );

        if (hasInProgress) {
            return;
        }

        // =========================================================
        // Xét trạng thái category dựa trên tất cả assessment
        // =========================================================
        String newCategoryStatus;

        boolean allRejected = statuses.size() == 1
                && statuses.contains(
                StatusSclAssessmentEnum.TU_CHOI_TD.getKey()
        );

        boolean allApproved = statuses.size() == 1
                && statuses.contains(
                StatusSclAssessmentEnum.DONG_Y_TD.getKey()
        );

        boolean allRevised = statuses.size() == 1
                && statuses.contains(
                StatusSclAssessmentEnum.CAN_HIEU_CHINH.getKey()
        );

        if (allRejected) {
            newCategoryStatus =
                    StatusSclCategoryEnum.TU_CHOI_DUYET_TD.getKey();

        } else if (allApproved) {
            newCategoryStatus =
                    StatusSclCategoryEnum.DA_DUYET_TD.getKey();

        } else if (allRevised) {
            newCategoryStatus =
                    StatusSclCategoryEnum.CAN_HIEU_CHINH.getKey();

        } else {
            newCategoryStatus =
                    StatusSclCategoryEnum.DA_THAM_DINH.getKey();
        }

        // =========================================================
        // Update category
        // =========================================================
        SclCategoryEntity category =
                sclCategoryRepository.findById(categoryId)
                        .orElse(null);

        if (category != null) {
            category.setStatus(newCategoryStatus);
            sclCategoryRepository.save(category);
        }
    }

    private Specification<SclAssessmentEntity> buildSpec(SclAssessmentFilterDTO request,
                                                         AppUserDetails userDetails) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // UNIT
            if (Strings.isNotBlank(request.getUnit())) {
                predicates.add(
                        cb.like(
                                cb.lower(root.get("unit")),
                                "%" + request.getUnit().trim().toLowerCase() + "%"
                        )
                );
            }

            // CATEGORY_CODE
            if (Strings.isNotBlank(request.getCategoryCode())) {
                predicates.add(
                        cb.like(
                                cb.lower(root.get("categoryCode")),
                                "%" + request.getCategoryCode().trim().toLowerCase() + "%"
                        )
                );
            }

            // CATEGORY_NAME
            if (Strings.isNotBlank(request.getCategoryName())) {
                predicates.add(
                        cb.like(
                                cb.lower(root.get("categoryName")),
                                "%" + request.getCategoryName().trim().toLowerCase() + "%"
                        )
                );
            }

            // YEAR_PLAN
            if (Strings.isNotBlank(request.getYearPlan())) {
                predicates.add(
                        cb.like(
                                cb.lower(root.get("yearPlan")),
                                "%" + request.getYearPlan().trim().toLowerCase() + "%"
                        )
                );
            }

            // PROGRESS
            if (Strings.isNotBlank(request.getProgress())) {
                predicates.add(
                        cb.like(
                                cb.lower(root.get("progress")),
                                "%" + request.getProgress().trim().toLowerCase() + "%"
                        )
                );
            }

            // STATUS
            if (Strings.isNotBlank(request.getStatus())) {
                predicates.add(
                        cb.like(
                                cb.lower(root.get("status")),
                                "%" + request.getStatus().trim().toLowerCase() + "%"
                        )
                );
            }

            // STATUS_ASSESSMENT
            if (Strings.isNotBlank(request.getStatusAssessment())) {
                predicates.add(
                        cb.like(
                                cb.lower(root.get("statusAssessment")),
                                "%" + request.getStatusAssessment().trim().toLowerCase() + "%"
                        )
                );
            }

            // ASSET_TYPE
            if (Strings.isNotBlank(request.getAssetType())) {
                predicates.add(
                        cb.like(
                                cb.lower(root.get("assetType")),
                                "%" + request.getAssetType().trim().toLowerCase() + "%"
                        )
                );
            }

            // PLAN_TYPE
            if (Strings.isNotBlank(request.getPlanType())) {
                predicates.add(
                        cb.like(
                                cb.lower(root.get("planType")),
                                "%" + request.getPlanType().trim().toLowerCase() + "%"
                        )
                );
            }

            // REGISTER_TYPE
            if (Strings.isNotBlank(request.getRegisterType())) {
                predicates.add(
                        cb.like(
                                cb.lower(root.get("registerType")),
                                "%" + request.getRegisterType().trim().toLowerCase() + "%"
                        )
                );
            }

            // CATEGORY_ID
            if (request.getCategoryId() != null) {
                predicates.add(
                        cb.equal(root.get("categoryId"), request.getCategoryId())
                );
            }

            // ASSESSMENT_DEPT_CODE từ request
            if (Strings.isNotBlank(request.getAssessmentDeptCode())) {
                predicates.add(
                        cb.equal(
                                cb.lower(root.get("assessmentDeptCode")),
                                request.getAssessmentDeptCode().trim().toLowerCase()
                        )
                );
            }

            // Giới hạn theo phòng ban user đăng nhập
            if (Strings.isNotBlank(userDetails.getDeptCode())) {
                predicates.add(
                        cb.equal(
                                cb.lower(root.get("assessmentDeptCode")),
                                userDetails.getDeptCode().trim().toLowerCase()
                        )
                );
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private SclAssessmentResponseDTO toResponse(SclAssessmentEntity entity) {
        SclAssessmentResponseDTO dto = new SclAssessmentResponseDTO();
        dto.setId(entity.getId());
        dto.setPc(entity.getPc());
        dto.setUnit(entity.getUnit());
        dto.setCategoryCode(entity.getCategoryCode());
        dto.setAssetCode(entity.getAssetCode());
        dto.setCategoryName(entity.getCategoryName());
        dto.setAssetType(entity.getAssetType());
        dto.setPlanType(entity.getPlanType());
        dto.setActualVolume(entity.getActualVolume());
        dto.setProgress(entity.getProgress());
        dto.setLastSclYear(entity.getLastSclYear());
        dto.setYearPlan(entity.getYearPlan());
        dto.setRegisterType(entity.getRegisterType());
        dto.setStatus(entity.getStatus());
        dto.setUpdatedAt(entity.getUpdatedAt().toString());
        dto.setCreatedDept(entity.getCreatedDept());
        return dto;
    }
}
