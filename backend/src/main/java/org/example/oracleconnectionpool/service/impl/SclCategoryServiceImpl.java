package org.example.oracleconnectionpool.service.impl;


import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.logging.log4j.util.Strings;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.example.oracleconnectionpool.constant.Constant;
import org.example.oracleconnectionpool.entity.*;
import org.example.oracleconnectionpool.enums.StatusSclAssessmentEnum;
import org.example.oracleconnectionpool.enums.StatusSclCategoryEnum;
import org.example.oracleconnectionpool.exceptions.BadRequestException;
import org.example.oracleconnectionpool.exceptions.ForbiddenException;
import org.example.oracleconnectionpool.exceptions.NotFoundException;
import org.example.oracleconnectionpool.model.base.OptionDTO;
import org.example.oracleconnectionpool.model.request.IdsDTO;
import org.example.oracleconnectionpool.model.request.griddataentry.CreateGridDataEntryRequest;
import org.example.oracleconnectionpool.model.request.sclassessment.SclAssessmentProjection;
import org.example.oracleconnectionpool.model.request.sclcategory.SclCategoryFilterDTO;
import org.example.oracleconnectionpool.model.request.sclcategory.SclCategoryRequestDTO;
import org.example.oracleconnectionpool.model.response.EntryFileResponse;
import org.example.oracleconnectionpool.model.response.GridDataEntryDetailResponse;
import org.example.oracleconnectionpool.model.response.comment.CommentContentDTO;
import org.example.oracleconnectionpool.model.response.comment.UserCommentDTO;
import org.example.oracleconnectionpool.model.response.sclassessment.SclCategoryCommentsDTO;
import org.example.oracleconnectionpool.model.response.sclassessment.UnitAssessmentDTO;
import org.example.oracleconnectionpool.model.response.sclcategory.OrgDataEntryProjection;
import org.example.oracleconnectionpool.model.response.sclcategory.SclCategoryResponseDTO;
import org.example.oracleconnectionpool.repository.*;
import org.example.oracleconnectionpool.repository.custom.SclCategoryRepositoryCustom;
import org.example.oracleconnectionpool.security.AppUserDetails;
import org.example.oracleconnectionpool.service.EntryFileService;
import org.example.oracleconnectionpool.service.GridDataEntryService;
import org.example.oracleconnectionpool.service.SclCategoryService;
import org.example.oracleconnectionpool.utils.ExcelExportHandler;
import org.example.oracleconnectionpool.utils.ExcelUtils;
import org.example.oracleconnectionpool.utils.GridRowAggregator;
import org.example.oracleconnectionpool.utils.GridRowExtractor;
import org.example.oracleconnectionpool.utils.GridRowSerializer;
import org.example.oracleconnectionpool.utils.FixedRowsReportExcelWriter;
import org.example.oracleconnectionpool.utils.GridRowExtractor;
import org.example.oracleconnectionpool.utils.GroupedReportExcelWriter;
import org.example.oracleconnectionpool.utils.ObjectMapperUtils;
import org.example.oracleconnectionpool.workflow.TaskNotificationDelegate;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

import static org.example.oracleconnectionpool.constant.Constant.OrgGroupCode.EVNNPC;
import static org.example.oracleconnectionpool.constant.Constant.PositionCode.GD;
import static org.example.oracleconnectionpool.constant.Constant.PositionCode.PGD;

@Slf4j
@Service
@RequiredArgsConstructor
public class SclCategoryServiceImpl implements SclCategoryService {
    private final PcCompanyRepository pcCompanyRepository;
    private final SclAssessmentRepository sclAssessmentRepository;
    private final SclCategoryRepository sclCategoryRepository;
    private final SclHistoryRepository sclHistoryRepository;
    private final SclCategoryRepositoryCustom sclCategoryRepositoryCustom;
    private final TaskNotificationDelegate taskNotificationDelegate;
    private final GridTemplateRepository gridTemplateRepository;
    private final GridDataEntryRepository gridDataEntryRepository;

    private final CommentsRepository commentsRepository;
    private final AppUserRepository appUserRepository;
    private final EntryFileService entryFileService;
    private final GridDataEntryService gridDataEntryService;

    private final String SCL_ASSESSMENT = "SCL_ASSESSMENT";
    private final String COMMNETS = "COMMENTS";

    private final String DANH_SACH_TRONG = "Danh sách trống";
    private final String KHONG_TIM_THAY_DU_LIEU_VOI_ID_TUONG_UNG = "Không tìm thấy dữ liệu với id tương ứng";
    private final String BAN_GHI_DA_TON_TAI = "Bản ghi đã tồn tại";
    private final String DANH_SACH_ID_KHONG_DUOC_DE_TRONG = "Danh sách ID không được để trống";
    private final String KHONG_TIM_THAY_BAN_GHI_VOI_DANH_SACH_ID_CUNG_CAP = "Không tìm thấy bản ghi tương ứng với danh sách ID cung cấp";
    private final String KHONG_CO_QUYEN_THAO_TAC_DU_LIEU_KHAC_DON_VI = "Không có quyền thao tác dữ liệu khác đơn vị";
    private final String MOT_SO_BAN_GHI_KHONG_TON_TAI = "Một số bản ghi không tồn tại";
    private final String CHI_DUOC_DUYET_TRANG_THAI_DA_GUI_TD = "Chỉ được duyệt bản ghi đang ở trạng thái đã gửi thẩm định";
    private final String CHI_DUOC_GUI_DUYET_TRANG_THAI_CHUA_GUI_TD_HOAC_TU_CHOI = "Chỉ được gửi duyệt bản ghi ở trạng thái chưa gửi thẩm định hoặc từ chối duyệt thẩm định";
    private final String CHI_CHUYEN_VIEN_MOI_DUOC_GUI_DUYET = "Chỉ chuyên viên đơn vị mới được gửi duyệt";
    private final String KHONG_CO_QUYEN_THAO_TAC = "Không có quyền thao tác";
    private final String LY_DO_TU_CHOI_KHONG_DUOC_DE_TRONG = "Lý do từ chối không được để trống";
    private final String CHI_DUOC_TU_CHOI_TRANG_THAI_DA_GUI_TD = "Chỉ được từ chối bản ghi đang ở trạng thái đã gửi thẩm định";
    private final String DON_VI_CHI_DUOC_SUA_TRANG_THAI_CHUA_GUI_TD_HOAC_TU_CHOI = "Đơn vị chỉ được sửa bản ghi ở trạng thái chưa gửi thẩm định hoặc từ chối duyệt thẩm định";
    private final String BAN_KH_KHONG_DUOC_SUA_TRANG_THAI_DA_DUYET_TD_HOAC_LD_THONG_QUA = "Ban KH không được sửa bản ghi đã duyệt thẩm định hoặc LĐ đã thông qua";
    private final String TRANG_THAI_KHONG_DUOC_DE_TRONG = "Trạng thái không được để trống";

    /**
     * Status nào coi là "đủ điều kiện giao KH" → sheet 2.
     * Phần còn lại (CHUA_GUI_THAM_DINH, DA_GUI_TD, LD_KHONG_THONG_QUA, TU_CHOI_DUYET_TD,
     * DIEU_CHINH_TD) → sheet 3.
     */
    private static final Set<String> ELIGIBLE_STATUSES = Set.of(
            StatusSclCategoryEnum.DA_DUYET_TD.getKey(),
            StatusSclCategoryEnum.GUI_LD_DUYET.getKey(),
            StatusSclCategoryEnum.LD_DA_THONG_QUA.getKey()
    );

    /** Số dòng header trong template ở sheet 2 + 3 (3 dòng đầu). */
    private static final int LAST_SHEET_SKIP_ROWS = 3;

    /**
     * Tên các sheet trong template scl-category-report-template.xlsx.
     * Key phải khớp CHÍNH XÁC với tên tab trong file .xlsx.
     */
    private static final String SHEET_TONG_HOP = "Tong_hop";
    private static final String SHEET_DU_DK_GIAO_KH = "Cac_hm_du_dk_giao_kh";
    private static final String SHEET_CHUA_DU_DK_GIAO_KH = "Cac_hm_chua_du_dk_giao_kh";

    /**
     * Sheet 1 (Tong_hop): 17 đơn vị fix cứng theo template, row 5..21 (idx 4..20).
     * Thứ tự PHẢI khớp với thứ tự đơn vị trong template (PC code = mã công ty trong DB).
     * <p>
     * TODO: verify lại danh sách PC code khớp với entity {@code AppUser.companyCode} / SCL_CATEGORY.PC.
     */
    private static final List<String> TONG_HOP_PC_ORDER = List.of(
            "PCHP",   // 1. Công ty Điện lực Hải Phòng
            "PCNB",   // 2. Công ty Điện lực Ninh Bình
            "PCPT",   // 3. Công ty Điện lực Phú Thọ
            "PCQN",   // 4. Công ty Điện lực Quảng Ninh
            "PCTN",   // 5. Công ty Điện lực Thái Nguyên
            "PCBN",   // 6. Công ty Điện lực Bắc Ninh
            "PCTH",   // 7. Công ty Điện lực Thanh Hóa
            "PCHY",   // 8. Công ty Điện lực Hưng Yên
            "PCLCA",  // 9. Công ty Điện lực Lào Cai
            "PCLS",   // 10. Công ty Điện lực Lạng Sơn
            "PCTQ",   // 11. Công ty Điện lực Tuyên Quang
            "PCNA",   // 12. Công ty Điện lực Nghệ An
            "PCCB",   // 13. Công ty Điện lực Cao Bằng
            "PCSL",   // 14. Công ty Điện lực Sơn La
            "PCHT",   // 15. Công ty Điện lực Hà Tĩnh
            "PCDB",   // 16. Công ty Điện lực Điện Biên
            "PCLC"    // 17. Công ty Điện lực Lai Châu
    );

    /** Row index 0-based của đơn vị đầu tiên trong sheet Tong_hop (Excel row 5 → idx 4). */
    private static final int TONG_HOP_FIRST_ROW_IDX = 4;

    /**
     * Range data col của sheet Tong_hop — col C (idx 2) đến AG (idx 32). Bao gồm cả input cols
     * và formula cols (Tổng / Chênh lệch / Tạm giao). Số tiền tỷ → cột template ~11 ký tự
     * sẽ hiển thị "#####"; widen lên ~18 ký tự để fit "8,000,000,000" + format.
     */
    private static final int TONG_HOP_DATA_COL_FIRST = 2;
    private static final int TONG_HOP_DATA_COL_LAST = 32;
    private static final int TONG_HOP_MIN_COL_WIDTH = 256 * 18;


    /** Sheet 2: STT | Tên hạng mục | Mã SSKT | Nội dung SC | Khái toán | Chi phí | Ghi chú */
    private static final GroupedReportExcelWriter.SheetLayout SHEET_2_LAYOUT =
            new GroupedReportExcelWriter.SheetLayout(7, 1, 2, 6);

    /** Sheet 3: STT | Tên hạng mục | Nội dung SC | Ghi chú */
    private static final GroupedReportExcelWriter.SheetLayout SHEET_3_LAYOUT =
            new GroupedReportExcelWriter.SheetLayout(4, 1, 2, 3);

    private static final String GROUP_KEY_FALLBACK = "(Chưa xác định)";
    private static final String TOTAL_ROW_LABEL = "TỔNG CỘNG";

    
    /**
     * Col index input cho sheet Tong_hop — KHÔNG bao gồm các cột công thức (Tổng / Chênh lệch).
     * Tính theo Excel col letter chuyển sang 0-based:
     * <ul>
     *   <li>D, E (3, 4): Kế hoạch chi phí Phân bổ (110kV, Khác 110kV) — C (Tổng) là formula</li>
     *   <li>F-J (5..9): SL hạng mục đăng ký theo phân loại 110kV/TT/HT/Khác/KTr — K (Tổng) formula</li>
     *   <li>L-P (11..15): Giá trị khái toán theo phân loại — Q (Tổng) formula</li>
     *   <li>R-V (17..21): Giá trị chi phí theo phân loại — W (Tổng) formula</li>
     *   <li>Z, AA, AB (25, 26, 27): HM 110kV đủ ĐK thông qua (SL, Khái toán, Chi phí) — AC formula</li>
     * </ul>
     * Cột Tạm giao chi phí (AE, AF) chưa fill — chờ xác định nguồn data.
     */
    private static final List<Integer> TONG_HOP_INPUT_COLS = List.of(
            2, 3, 4,                       // C, D, E: phân bổ chi phí (110kV, Khác)
            5, 6, 7, 8, 9,              // F-J: SL hạng mục đăng ký theo phân loại
            11, 12, 13, 14, 15,         // L-P: giá trị khái toán theo phân loại
            17, 18, 19, 20, 21         // R-V: giá trị chi phí theo phân loại
    );

    /**
     * Phân loại hạng mục — 5 giá trị, thứ tự khớp với cột F-J trong template.
     * Match qua {@link SclCategoryResponseDTO#getAssetType()} (case-insensitive).
     */
    private static final List<String> PHAN_LOAI = List.of("110kV", "TT", "HT", "Khác", "KTr");

    /** Col index 110kV/TT/HT/Khác/KTr — SL hạng mục (F-J). */
    private static final int[] COL_SL = {5, 6, 7, 8, 9};
    /** Col index 110kV/TT/HT/Khác/KTr — Giá trị khái toán (L-P). */
    private static final int[] COL_KHAI_TOAN = {11, 12, 13, 14, 15};
    /** Col index 110kV/TT/HT/Khác/KTr — Giá trị chi phí (R-V). */
    private static final int[] COL_CHI_PHI = {17, 18, 19, 20, 21};

    private static final int COL_PB_TONG = 2;
    private static final int COL_PB_110KV = 3;
    private static final int COL_PB_KHAC_110KV = 4;

    /** Template entryCode prefix cho phân bổ chi phí TCT — full code = "{PREFIX}{year}". */
    private static final String PHAN_BO_TCT_ENTRY_CODE_PREFIX = "SCL_B21_PB_TCT_";

    /**
     * Column code trong rowData JSON của entry phân bổ TCT.
     * <p>
     * TODO: verify với template thật. Hiện assume column-letter convention (D = 110kV, E = Khác)
     * khớp với layout template "phân bổ hạn mức chi phí SCL".
     */
    private static final String PHAN_BO_COL_TONG = "C";
    private static final String PHAN_BO_COL_110KV = "D";
    private static final String PHAN_BO_COL_KHAC_110KV = "E";

    @Override
    public Page<SclCategoryResponseDTO> search(SclCategoryFilterDTO request, AppUserDetails userDetails) {
        return sclCategoryRepositoryCustom.search(request, userDetails);
    }

    @Override
    public SclCategoryResponseDTO getById(AppUserDetails userDetail, Long id) {
        SclCategoryEntity entity = sclCategoryRepository.findById(id).orElseThrow(() -> new BadRequestException(DANH_SACH_TRONG));

        List<SclAssessmentProjection> listUnitAssessment = sclAssessmentRepository.findByCategoryId(id);
            List<Long> assessmentIds = listUnitAssessment.stream()
                    .map(SclAssessmentProjection::getId)
                    .toList();

            // Lấy flat list comments theo nhiều groupId
            List<CommentsEntity> allComments = commentsRepository.findAllByTypeAndGroupIdIn(SCL_ASSESSMENT, assessmentIds);

            // Group comments theo groupId -> Map<groupId, List<CommentsEntity>>
            Map<Long, List<CommentsEntity>> commentsByGroupId = allComments.stream()
                    .collect(Collectors.groupingBy(CommentsEntity::getGroupId));

            // Build SclCategoryCommentsDTO
            SclCategoryCommentsDTO sclAssessmentCommentsDTO = buildAssessmentComments(userDetail, listUnitAssessment, commentsByGroupId);


        SclCategoryResponseDTO res = ObjectMapperUtils.map(entity, SclCategoryResponseDTO.class);
        res.setCategoryCommentsDTO(sclAssessmentCommentsDTO);
        return res;
    }

    private SclCategoryCommentsDTO buildAssessmentComments(
            AppUserDetails userDetail,
            List<SclAssessmentProjection> listUnitAssessment,
            Map<Long, List<CommentsEntity>> commentsByGroupId) {

        UserCommentDTO currentUser = ObjectMapperUtils.map(userDetail, UserCommentDTO.class);

        // ===== 1. Collect userIds =====
        Set<Long> allUserIds = commentsByGroupId.values().stream()
                .flatMap(List::stream)
                .map(CommentsEntity::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        List<UserCommentDTO> userComments =
                appUserRepository.findAllById(allUserIds)
                        .stream()
                        .map(user -> new UserCommentDTO(
                                user.getId(),
                                user.getUsername(),
                                user.getFullName(),
                                user.getOrgGroupCode(),
                                user.getCompanyCode(),
                                user.getDeptCode(),
                                user.getPositionCode()
                        ))
                        .toList();

        // ===== 2. Build comment DTO + collect ids =====
        List<CommentContentDTO> allCommentsFlat = new ArrayList<>();

        List<UnitAssessmentDTO> unitAssessmentDTOs = listUnitAssessment.stream()
                .map(unit -> {

                    List<CommentContentDTO> comments = commentsByGroupId
                            .getOrDefault(unit.getId(), Collections.emptyList())
                            .stream()
                            .map(c -> ObjectMapperUtils.map(c, CommentContentDTO.class))
                            .toList();

                    allCommentsFlat.addAll(comments);

                    return UnitAssessmentDTO.builder()
                            .id(unit.getId())
                            .status(unit.getStatus())
                            .assessmentDeptCode(unit.getAssessmentDeptCode())
                            .assessmentDeptName(unit.getAssessmentDeptName())
                            .commentContents(comments)
                            .build();
                })
                .toList();

        // ===== 3. Collect ids =====
        List<Long> ids = allCommentsFlat.stream()
                .filter(comment -> "N".equals(comment.getIsDeleted()))
                .map(CommentContentDTO::getId)
                .toList();

        // ===== 4. Call service =====
        List<EntryFileResponse> attachComments = entryFileService.listByEntryFolder(ids, COMMNETS);

        // ===== 7. Return =====
        return new SclCategoryCommentsDTO(
                currentUser,
                userComments,
                unitAssessmentDTOs,
                attachComments
        );
    }

    @Override
    @Transactional
    public void sendAssessment(IdsDTO idsDTO) {

        List<OptionDTO> assessmentUnit = idsDTO.getAssessmentUnit();
        List<Long> idValid = idsDTO.getIds();

        if (idValid == null || idValid.isEmpty()) {
            throw new BadRequestException(DANH_SACH_ID_KHONG_DUOC_DE_TRONG);
        }

        List<SclCategoryEntity> list = sclCategoryRepository.findAllById(idValid);

        if (list.isEmpty()) {
            throw new BadRequestException(KHONG_TIM_THAY_BAN_GHI_VOI_DANH_SACH_ID_CUNG_CAP);
        }

        List<SclAssessmentEntity> assessmentEntity = list.stream()
                .flatMap(category -> assessmentUnit.stream()
                        .map(option -> {
                            SclAssessmentEntity assessment = new SclAssessmentEntity();
                            assessment.setPc(category.getPc());
                            assessment.setUnit(category.getUnit());
                            assessment.setCategoryCode(category.getCategoryCode());
                            assessment.setAssetCode(category.getAssetCode());
                            assessment.setCategoryName(category.getCategoryName());
                            assessment.setAssetType(category.getAssetType());
                            assessment.setPlanType(category.getPlanType());
                            assessment.setActualVolume(category.getActualVolume());
                            assessment.setProgress(category.getProgress());
                            assessment.setLastSclYear(category.getLastSclYear());
                            assessment.setYearPlan(category.getYearPlan());
                            assessment.setRegisterType(category.getRegisterType());
                            assessment.setStatus(StatusSclCategoryEnum.DA_GUI_TD.getKey());
                            assessment.setCategoryId(category.getId());
                            assessment.setAssessmentDeptCode(option.getValue()); // value -> assessmentUnitCode
                            assessment.setAssessmentDeptName(option.getLabel()); // label -> assessmentUnitName
                            assessment.setCreatedDept(category.getCreatedUnit());
                            return assessment;
                        }))
                .toList();

        List<String> deptCodes = assessmentUnit.stream()
                .map(OptionDTO::getValue)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        String unitStr = String.join(",", deptCodes);

        sclCategoryRepository.sendAssessment(idValid, unitStr, StatusSclCategoryEnum.DA_GUI_TD.getKey(), LocalDateTime.now());
        sclAssessmentRepository.saveAll(assessmentEntity);

        notifyAssessmentUnits(deptCodes, idValid.size());
    }

    /**
     * Gửi noti cho các chuyên viên Ban thẩm định (EVNNPC) khi đơn vị PC bấm "Gửi thẩm định".
     * Lookup user theo orgGroupCode = EVNNPC + deptCode = assessmentUnit (Ban được chọn).
     * Lỗi gửi từng user không abort batch — log warn rồi tiếp tục.
     */
    private void notifyAssessmentUnits(List<String> deptCodes, int categoryCount) {
        if (deptCodes.isEmpty()) {
            log.warn("[SCL_SEND_TD] Không có deptCode thẩm định, bỏ qua gửi noti");
            return;
        }

        List<AppUser> users = appUserRepository.findByOrgGroupCodeAndDeptCode(EVNNPC, deptCodes);
        if (users.isEmpty()) {
            log.warn("[SCL_SEND_TD] Không tìm thấy user EVNNPC active cho deptCodes={}", deptCodes);
            return;
        }

        String title = "Yêu cầu thẩm định danh mục SCL";
        String content = String.format("Có %d hạng mục SCL vừa được gửi yêu cầu thẩm định, vui lòng kiểm tra.", categoryCount);
        String targetUrl = "/scl-assessment";

        int sent = 0;
        for (AppUser user : users) {
            try {
                taskNotificationDelegate.sendNotification(user.getUsername(), title, content, targetUrl);
                sent++;
            } catch (Exception ex) {
                log.warn("[SCL_SEND_TD] Lỗi gửi noti cho user={}: {}", user.getUsername(), ex.getMessage());
            }
        }
        log.info("[SCL_SEND_TD] Đã gửi {}/{} noti thẩm định SCL (deptCodes={})", sent, users.size(), deptCodes);
    }

    @Transactional
    @Override
    public Long save(SclCategoryRequestDTO request,AppUserDetails userDetails) {
        try {
            // check trùng
            checkUnique(request.getCategoryCode(), null);

            // map dto -> entity
            SclCategoryEntity entity = ObjectMapperUtils.map(request, SclCategoryEntity.class);
            entity.setStatus(StatusSclCategoryEnum.CHUA_GUI_THAM_DINH.getKey());
            entity.setCreatedUnit(userDetails.getDeptCode());

            // save
            SclCategoryEntity save = sclCategoryRepository.save(entity);

            return save.getId();
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    @Transactional
    @Override
    public Long update(SclCategoryRequestDTO request, AppUserDetails user) {
        try {
            SclCategoryEntity entity = sclCategoryRepository.findById(request.getId()).orElseThrow(() -> new NotFoundException(KHONG_TIM_THAY_DU_LIEU_VOI_ID_TUONG_UNG));

            validateUpdatePermission(entity, user);

            // check trùng
            checkUnique(request.getCategoryCode(), entity.getId());

            saveHistory(entity);

            // mapper
            ObjectMapperUtils.map(request, entity);

            sclCategoryRepository.save(entity);

            return entity.getId();
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    @Transactional
    public void saveHistory(SclCategoryEntity entity) {
        SclHistoryEntity history = new SclHistoryEntity();

        // copy dữ liệu cũ
        history.setSclCategoryId(entity.getId());
        history.setUnit(entity.getUnit());
        history.setCategoryName(entity.getCategoryName());
        history.setAssetType(entity.getAssetType());
        history.setYearPlan(entity.getYearPlan());
        history.setActualVolume(entity.getActualVolume());
        history.setProgress(entity.getProgress());
        history.setNote(entity.getNote());
        history.setCreatedAt(entity.getCreatedAt());
        history.setUpdatedAt(LocalDateTime.now());

        sclHistoryRepository.save(history);
    }

    @Transactional
    @Override
    public void delete(IdsDTO idsDTO) {
        if (idsDTO == null || idsDTO.getIds() == null || idsDTO.getIds().isEmpty()) {
            throw new BadRequestException(DANH_SACH_ID_KHONG_DUOC_DE_TRONG);
        }

        // thêm vào danh sách id
        List<Long> listIds = idsDTO.getIds();

        List<SclCategoryEntity> entityList = sclCategoryRepository.findByIdIn(listIds);

        if (entityList.isEmpty()) {
            throw new NotFoundException(KHONG_TIM_THAY_BAN_GHI_VOI_DANH_SACH_ID_CUNG_CAP);
        }

        // lấy những id tồn tại trong db
        List<Long> foundIds = entityList.stream()
                .map(SclCategoryEntity::getId)
                .toList();

        List<Long> notFoundIds = listIds.stream()
                .filter(id -> !foundIds.contains(id))
                .toList();

        if (!notFoundIds.isEmpty()) {
            throw new BadRequestException("Không tìm thấy các bản ghi: " + notFoundIds);
        }

        sclCategoryRepository.deleteAll(entityList);
    }

    public void checkUnique(String categoryCode, Long id) {
        boolean isExists = sclCategoryRepository.existsByCategoryCode(categoryCode, id);
        if (isExists) {
            throw new BadRequestException(BAN_GHI_DA_TON_TAI);
        }
    }

    @Override
    public void exportExcel(SclCategoryFilterDTO filter, AppUserDetails userDetails, HttpServletResponse response) {
        List<SclCategoryResponseDTO> result = sclCategoryRepositoryCustom.searchForExport(filter, userDetails);

        List<SclCategoryResponseDTO> res = result.stream().map(e -> {
            SclCategoryResponseDTO item = ObjectMapperUtils.map(e, SclCategoryResponseDTO.class);
            if (e.getStatus() != null && !e.getStatus().isEmpty()) {
                StatusSclCategoryEnum status = StatusSclCategoryEnum.fromKey(e.getStatus());
                item.setStatus(status != null ? status.getValue() : "Không xác định");
            }
            return item;
        }).collect(Collectors.toList());

        ExcelUtils.export(response, SclCategoryResponseDTO.class, res, "Danh sách hạng mục SCL");
    }

    private void validateUpdatePermission(SclCategoryEntity entity, AppUserDetails user) {
        String orgGroupCode = user.getOrgGroupCode();
        String deptCode = user.getDeptCode();
        String companyCode = user.getCompanyCode();

        String status = entity.getStatus();

        // ===== ĐƠN VỊ (PC) =====
        if (Constant.OrgGroupCode.PC_COMPANY.equals(orgGroupCode)) {

            // check đúng đơn vị
            if (!companyCode.equals(entity.getPc())) {
                throw new ForbiddenException(KHONG_CO_QUYEN_THAO_TAC_DU_LIEU_KHAC_DON_VI);
            }

            // chỉ sửa TAO_MOI
            if (!(StatusSclCategoryEnum.CHUA_GUI_THAM_DINH.getKey().equals(status) || StatusSclCategoryEnum.TU_CHOI_DUYET_TD.getKey().equals(status))) {
                throw new BadRequestException(DON_VI_CHI_DUOC_SUA_TRANG_THAI_CHUA_GUI_TD_HOAC_TU_CHOI);
            }

            return;
        }

        // ===== BAN KH =====
        if (Constant.OrgGroupCode.EVNNPC.equals(orgGroupCode)
                && (Constant.DeptCode.BAN_KH.equals(deptCode) || deptCode == null)) {
            if (StatusSclCategoryEnum.DA_DUYET_TD.getKey().equals(status)
                    || StatusSclCategoryEnum.LD_DA_THONG_QUA.getKey().equals(status)) {
                throw new BadRequestException(BAN_KH_KHONG_DUOC_SUA_TRANG_THAI_DA_DUYET_TD_HOAC_LD_THONG_QUA);
            }

            return;
        }

        // ===== CÒN LẠI =====
        throw new ForbiddenException(KHONG_CO_QUYEN_THAO_TAC);
    }

    @Transactional
    @Override
    public void sendApprove(IdsDTO ids, AppUserDetails user) {
        if (ids.getIds() == null || ids.getIds().isEmpty()) {
            throw new NotFoundException(DANH_SACH_ID_KHONG_DUOC_DE_TRONG);
        }

        String orgGroupCode = user.getOrgGroupCode();
        String companyCode = user.getCompanyCode();
        String positionCode = user.getPositionCode();

        if (EVNNPC.equals(orgGroupCode) || GD.equals(positionCode) || PGD.equals(positionCode)) {
            throw new ForbiddenException(CHI_CHUYEN_VIEN_MOI_DUOC_GUI_DUYET);
        }

        List<SclCategoryEntity> entities = sclCategoryRepository.findAllById(ids.getIds());

        if (entities.size() != ids.getIds().size()) {
            throw new NotFoundException(MOT_SO_BAN_GHI_KHONG_TON_TAI);
        }

        LocalDateTime now = LocalDateTime.now();

        for (SclCategoryEntity entity : entities) {
            // 1. Check permission theo company
            if (!companyCode.equals(entity.getPc())) {
                throw new ForbiddenException(KHONG_CO_QUYEN_THAO_TAC_DU_LIEU_KHAC_DON_VI);
            }

            if (!(StatusSclCategoryEnum.CHUA_GUI_THAM_DINH.getKey().equals(entity.getStatus()) || StatusSclCategoryEnum.TU_CHOI_DUYET_TD.getKey().equals(entity.getStatus()))) {
                throw new BadRequestException(CHI_DUOC_GUI_DUYET_TRANG_THAI_CHUA_GUI_TD_HOAC_TU_CHOI);
            }

            // ===== UPDATE STATE =====
            entity.setStatus(StatusSclCategoryEnum.GUI_LD_DUYET.getKey());
            entity.setUpdatedAt(now);
            saveHistory(entity);
        }

        // ===== SAVE BATCH =====
        sclCategoryRepository.saveAll(entities);
    }

    @Transactional
    @Override
    public void approve(IdsDTO ids, AppUserDetails user) {

        if (ids.getIds() == null || ids.getIds().isEmpty()) {
            throw new NotFoundException(DANH_SACH_ID_KHONG_DUOC_DE_TRONG);
        }

        String orgGroupCode = user.getOrgGroupCode();
        String positionCode = user.getPositionCode();
        String companyCode = user.getCompanyCode();

        if (EVNNPC.equals(orgGroupCode) || !(GD.equals(positionCode) || PGD.equals(positionCode))) {
            throw new ForbiddenException(KHONG_CO_QUYEN_THAO_TAC);
        }

        List<SclCategoryEntity> entities = sclCategoryRepository.findAllById(ids.getIds());

        if (entities.size() != ids.getIds().size()) {
            throw new NotFoundException(MOT_SO_BAN_GHI_KHONG_TON_TAI);
        }

        LocalDateTime now = LocalDateTime.now();

        for (SclCategoryEntity entity : entities) {
            // Check permission theo company
            if (!companyCode.equals(entity.getPc())) {
                throw new ForbiddenException(KHONG_CO_QUYEN_THAO_TAC_DU_LIEU_KHAC_DON_VI);
            }

            // Chỉ duyệt khi đang chờ duyệt
            if (!StatusSclCategoryEnum.DA_GUI_TD.getKey().equals(entity.getStatus())) {
                throw new BadRequestException(CHI_DUOC_DUYET_TRANG_THAI_DA_GUI_TD);
            }

            entity.setStatus(StatusSclCategoryEnum.DA_DUYET_TD.getKey());
            entity.setUpdatedAt(now);
            saveHistory(entity);
        }

        sclCategoryRepository.saveAll(entities);
    }

    @Transactional
    @Override
    public void reject(IdsDTO ids, AppUserDetails user) {

        if (ids.getIds() == null || ids.getIds().isEmpty()) {
            throw new NotFoundException(DANH_SACH_ID_KHONG_DUOC_DE_TRONG);
        }

        if (ids.getRejectReason() == null || ids.getRejectReason().isBlank()) {
            throw new BadRequestException(LY_DO_TU_CHOI_KHONG_DUOC_DE_TRONG);
        }

        String orgGroupCode = user.getOrgGroupCode();
        String positionCode = user.getPositionCode();

        // ===== PERMISSION =====
        if (EVNNPC.equals(orgGroupCode) || !(GD.equals(positionCode) || PGD.equals(positionCode))) {
            throw new ForbiddenException(KHONG_CO_QUYEN_THAO_TAC);
        }

        List<SclCategoryEntity> entities = sclCategoryRepository.findAllById(ids.getIds());

        if (entities.size() != ids.getIds().size()) {
            throw new NotFoundException(MOT_SO_BAN_GHI_KHONG_TON_TAI);
        }

        LocalDateTime now = LocalDateTime.now();

        for (SclCategoryEntity entity : entities) {

            if (!StatusSclCategoryEnum.DA_GUI_TD.getKey().equals(entity.getStatus())) {
                throw new BadRequestException(CHI_DUOC_TU_CHOI_TRANG_THAI_DA_GUI_TD);
            }

            // ===== UPDATE =====
            entity.setStatus(StatusSclCategoryEnum.TU_CHOI_DUYET_TD.getKey());
            entity.setNote(ids.getRejectReason());
            entity.setUpdatedAt(now);
            saveHistory(entity);
        }

        sclCategoryRepository.saveAll(entities);
    }

    @Transactional
    @Override
    public void updateStatus(IdsDTO ids) {

        if (ids.getIds() == null || ids.getIds().isEmpty()) {
            throw new NotFoundException(DANH_SACH_ID_KHONG_DUOC_DE_TRONG);
        }

        if (ids.getStatus() == null || ids.getStatus().isBlank()) {
            throw new BadRequestException(TRANG_THAI_KHONG_DUOC_DE_TRONG);
        }

        List<SclCategoryEntity> entities = sclCategoryRepository.findAllById(ids.getIds());

        if (entities.size() != ids.getIds().size()) {
            throw new NotFoundException(MOT_SO_BAN_GHI_KHONG_TON_TAI);
        }

        LocalDateTime now = LocalDateTime.now();

        for (SclCategoryEntity entity : entities) {
            // ===== UPDATE =====
            entity.setStatus(ids.getStatus());
            entity.setUpdatedAt(now);
            saveHistory(entity);
        }

        sclCategoryRepository.saveAll(entities);
    }

    @Override
    @Transactional
    public Long planSummary(Long templateId, CreateGridDataEntryRequest request, AppUserDetails user) {
        String templateCode = gridTemplateRepository.findCodeById(templateId);
        boolean isPL160 = Constant.TEMPLATE_CONFIG.PL160.CODE.equals(templateCode);
        boolean isPL161 = Constant.TEMPLATE_CONFIG.PL161.CODE.equals(templateCode);
        if (Strings.isBlank(templateCode) || (!isPL160 && !isPL161)) {
            throw new BadRequestException("Template code không hợp lệ — chỉ hỗ trợ PL160 hoặc PL161");
        }

        Integer year = request.getYear();
        String rowDateEmpty = gridDataEntryService.snapshotTemplateRows(templateId);

        Map<String, List<GridRowExtractor.Row>> rowsByOrgDN =
                groupRowsByOrg(gridDataEntryRepository.findRowDataEntryByYearValAndTemplateCode(year, Constant.TEMPLATE_CONFIG.PL159.CODE));
        Map<String, List<GridRowExtractor.Row>> rowsByOrgBS =
                groupRowsByOrg(gridDataEntryRepository.findRowDataEntryByYearValAndTemplateCode(year, Constant.TEMPLATE_CONFIG.PL158.CODE));

        log.debug("[PLAN_SUMMARY] year={} templateCode={} dnOrgs={} bsOrgs={}",
                year, templateCode, rowsByOrgDN.size(), rowsByOrgBS.size());

        if (isPL160) {
            request.setRowData(buildSummaryPL160RowData(rowDateEmpty, rowsByOrgDN, rowsByOrgBS));
        } else {
            // LinkedHashMap để preserve thứ tự ORDER BY companyCode từ SQL —
            // thứ tự PC trong output cần ổn định (deterministic) qua mỗi lần chạy.
            Map<String, String> listPcCompany = pcCompanyRepository
                    .findByActiveTrueOrderByCompanyCodeAsc()
                    .stream()
                    .collect(Collectors.toMap(
                            PcCompany::getCompanyCode,
                            PcCompany::getCompanyName,
                            (a, b) -> a,
                            LinkedHashMap::new
                    ));
            request.setRowData(buildSummaryPL161RowData(rowDateEmpty, rowsByOrgDN, rowsByOrgBS, listPcCompany));
        }
        
        GridDataEntryDetailResponse response = gridDataEntryService.createEntry(templateId, request, user);
        return response.getId();
    }

    /**
     * Map từng row trong khung snapshot vào 2 map theo {@code row_code = orgCode}.
     * Match → set 9 cell aggregate (3 DN + 3 BS + 3 tổng). Không match (vd R1) → giữ nguyên,
     * formula sẵn ở {@code _cellConfig} sẽ được FE compute lúc load entry.
     */
    private String buildSummaryPL160RowData(String rowDateEmpty,
                                       Map<String, List<GridRowExtractor.Row>> rowsByOrgDN,
                                       Map<String, List<GridRowExtractor.Row>> rowsByOrgBS) {
        List<GridRowExtractor.Row> templateRows = GridRowExtractor.extractRows(rowDateEmpty);
        String colGtkt = Constant.TEMPLATE_CONFIG.PL159.GTKT_COL_CODE;     // "D"
        String colGtcp = Constant.TEMPLATE_CONFIG.PL159.GTCPSQL_COL_CODE;  // "E"

        List<Map<String, Object>> output = new ArrayList<>(templateRows.size());
        for (int i = 0; i < templateRows.size(); i++) {
            GridRowExtractor.Row row = templateRows.get(i);
            String orgCode = row.meta().rowCode();

            GridRowSerializer.RowBuilder builder = GridRowSerializer.rowFor(i, row.meta())
                    .putAll(row.cells());

            List<GridRowExtractor.Row> dnRows = rowsByOrgDN.get(orgCode);
            List<GridRowExtractor.Row> bsRows = rowsByOrgBS.get(orgCode);

            if (dnRows == null && bsRows == null) {
                output.add(builder.build());
                continue;
            }

            int sldn = (dnRows != null) ? dnRows.size() : 0;
            BigDecimal gtktdn = GridRowAggregator.sumColumn(dnRows, colGtkt);
            BigDecimal gtcpdn = GridRowAggregator.sumColumn(dnRows, colGtcp);

            int slbs = (bsRows != null) ? bsRows.size() : 0;
            BigDecimal gtktbs = GridRowAggregator.sumColumn(bsRows, colGtkt);
            BigDecimal gtcpbs = GridRowAggregator.sumColumn(bsRows, colGtcp);

            builder.put(Constant.TEMPLATE_CONFIG.PL160.SO_LUONG_DN_COL_CODE,   sldn)
                   .put(Constant.TEMPLATE_CONFIG.PL160.GTKT_DN_COL_CODE, gtktdn)
                   .put(Constant.TEMPLATE_CONFIG.PL160.GTCP_DN_COL_CODE, gtcpdn)
                   .put(Constant.TEMPLATE_CONFIG.PL160.SO_LUONG_BS_COL_CODE,   slbs)
                   .put(Constant.TEMPLATE_CONFIG.PL160.GTKT_BS_COL_CODE, gtktbs)
                   .put(Constant.TEMPLATE_CONFIG.PL160.GTCP_BS_COL_CODE, gtcpbs)
                   .put(Constant.TEMPLATE_CONFIG.PL160.SO_LUONG_COL_CODE,     sldn + slbs)
                   .put(Constant.TEMPLATE_CONFIG.PL160.GTKT_COL_CODE,   gtktdn.add(gtktbs))
                   .put(Constant.TEMPLATE_CONFIG.PL160.GTCP_COL_CODE,   gtcpdn.add(gtcpbs));

            output.add(builder.build());
        }
        return GridRowSerializer.toJson(output);
    }

    /**
     * Build rowData cho biểu mẫu PL161 — TỔNG HỢP CÁC HẠNG MỤC SCL của các đơn vị.
     *
     * <p>Cấu trúc output (row_code = R{n}, n tăng dần liên tục từ 1, sortOrder = n - 1):
     * <ul>
     *   <li><b>R1</b>: TỔNG CỘNG — giữ nguyên từ snapshot (formula {@code SUMALL(...)} ở
     *       {@code _cellConfig} sẽ được FE compute khi user mở entry).</li>
     *   <li>Với mỗi PC company có hạng mục (DN hoặc BS) — lặp theo iteration order
     *       của {@code listPcCompany} (caller phải dùng {@link LinkedHashMap}):
     *     <ol>
     *       <li>1 row header bold: {@code TENHANGMUC = companyName}.</li>
     *       <li>N row data đầu năm (từ {@code rowsByOrgDN}): {@code KEHOACH = "Đầu năm"}.</li>
     *       <li>M row data bổ sung (từ {@code rowsByOrgBS}): {@code KEHOACH = "Bổ sung"}.</li>
     *     </ol>
     *     STT chạy lại từ 1 cho mỗi PC (continuous qua DN→BS).
     *     Map cell PL159/PL158 → PL161: A→TENHANGMUC, B→MSTSCDSSKT, C→NOIDUNGSUACHUA,
     *     D→GIATRIKHAITOAN, E→GIATRICHIPHI, F→GHICHU.
     *   </li>
     *   <li>PC không match key trong {@code listPcCompany} hoặc không có cả DN+BS → bỏ qua.</li>
     * </ul>
     */
    private String buildSummaryPL161RowData(String rowDateEmpty,
                                            Map<String, List<GridRowExtractor.Row>> rowsByOrgDN,
                                            Map<String, List<GridRowExtractor.Row>> rowsByOrgBS,
                                            Map<String, String> listPcCompany) {
        List<GridRowExtractor.Row> templateRows = GridRowExtractor.extractRows(rowDateEmpty);

        // PL161 destination column codes
        String dstHangMuc = Constant.TEMPLATE_CONFIG.PL161.TEN_HANG_MUC_COL_CODE;
        String dstMaSo    = Constant.TEMPLATE_CONFIG.PL161.MA_SO_TAI_SAN_COL_CODE;
        String dstNoiDung = Constant.TEMPLATE_CONFIG.PL161.NOI_DUNG_SUA_CHUA_COL_CODE;
        String dstGtkt    = Constant.TEMPLATE_CONFIG.PL161.GIA_TRI_KHAI_TOAN_COL_CODE;
        String dstGtcp    = Constant.TEMPLATE_CONFIG.PL161.GIA_TRI_CHI_PHI_COL_CODE;
        String dstKeHoach = Constant.TEMPLATE_CONFIG.PL161.KE_HOACH_COL_CODE;
        String dstGhiChu  = Constant.TEMPLATE_CONFIG.PL161.GHI_CHU_COL_CODE;
        String sttCol     = Constant.TEMPLATE_CONFIG.STT_COL_CODE;

        // Header bold cho TENHANGMUC — dùng chung cho tất cả PC header rows
        Map<String, Object> headerCellConfig = Map.of(
                dstHangMuc, Map.of("format", Map.of("bold", true))
        );

        List<Map<String, Object>> output = new ArrayList<>();
        int[] idxRef = {0}; // mutable counter — share giữa caller + emitDataRow helper

        // 1. Giữ row TỔNG CỘNG (R1) từ snapshot — preserve formula SUMALL trong _cellConfig
        if (!templateRows.isEmpty()) {
            GridRowExtractor.Row totalRow = templateRows.get(0);
            output.add(GridRowSerializer.rowFor(idxRef[0], totalRow.meta())
                    .putAll(totalRow.cells())
                    .build());
            idxRef[0]++;
        }

        // 2. Với mỗi PC có hạng mục → header + data DN + data BS
        for (Map.Entry<String, String> pc : listPcCompany.entrySet()) {
            String orgCode = pc.getKey();
            String companyName = pc.getValue();

            List<GridRowExtractor.Row> dnItems = rowsByOrgDN.get(orgCode);
            List<GridRowExtractor.Row> bsItems = rowsByOrgBS.get(orgCode);
            boolean hasDN = dnItems != null && !dnItems.isEmpty();
            boolean hasBS = bsItems != null && !bsItems.isEmpty();
            if (!hasDN && !hasBS) continue;

            // Header row: TENHANGMUC = tên công ty, các cột khác blank
            output.add(GridRowSerializer.row("R" + (idxRef[0] + 1))
                    .sortOrder(idxRef[0])
                    .cellConfig(headerCellConfig)
                    .put(sttCol, null)
                    .put(dstHangMuc, companyName)
                    .put(dstMaSo, "")
                    .put(dstNoiDung, "")
                    .put(dstGtkt, "")
                    .put(dstGtcp, "")
                    .put(dstKeHoach, "")
                    .put(dstGhiChu, "")
                    .build());
            idxRef[0]++;

            // Data rows: STT chạy lại từ 1, continuous qua DN→BS trong cùng PC
            int[] sttRef = {1};
            if (hasDN) {
                emitPL161DataRows(output, dnItems, Constant.TEMPLATE_CONFIG.PL161.KE_HOACH_DAU_NAM, idxRef, sttRef);
            }
            if (hasBS) {
                emitPL161DataRows(output, bsItems, Constant.TEMPLATE_CONFIG.PL161.KE_HOACH_BO_SUNG, idxRef, sttRef);
            }
        }

        return GridRowSerializer.toJson(output);
    }

    /**
     * Emit data rows PL161 từ list source (PL158/PL159) vào {@code output}, đính kèm label
     * {@code keHoach} ({@code "Đầu năm"} / {@code "Bổ sung"}). {@code idxRef} + {@code sttRef}
     * là counter dạng {@code int[1]} để chia sẻ state với caller (Java không có pass-by-ref).
     */
    private void emitPL161DataRows(List<Map<String, Object>> output,
                                   List<GridRowExtractor.Row> items,
                                   String keHoach,
                                   int[] idxRef,
                                   int[] sttRef) {
        String dstHangMuc = Constant.TEMPLATE_CONFIG.PL161.TEN_HANG_MUC_COL_CODE;
        String dstMaSo    = Constant.TEMPLATE_CONFIG.PL161.MA_SO_TAI_SAN_COL_CODE;
        String dstNoiDung = Constant.TEMPLATE_CONFIG.PL161.NOI_DUNG_SUA_CHUA_COL_CODE;
        String dstGtkt    = Constant.TEMPLATE_CONFIG.PL161.GIA_TRI_KHAI_TOAN_COL_CODE;
        String dstGtcp    = Constant.TEMPLATE_CONFIG.PL161.GIA_TRI_CHI_PHI_COL_CODE;
        String dstKeHoach = Constant.TEMPLATE_CONFIG.PL161.KE_HOACH_COL_CODE;
        String dstGhiChu  = Constant.TEMPLATE_CONFIG.PL161.GHI_CHU_COL_CODE;
        String sttCol     = Constant.TEMPLATE_CONFIG.STT_COL_CODE;

        // PL158 + PL159 cùng schema cell A/B/C/D/E/F → reuse PL159 constants
        String srcA = Constant.TEMPLATE_CONFIG.PL159.CATEGORY_NAME_COL_CODE;
        String srcB = Constant.TEMPLATE_CONFIG.PL159.CATEGORY_CODE_COL_CODE;
        String srcC = Constant.TEMPLATE_CONFIG.PL159.CONTENT_COL_CODE;
        String srcD = Constant.TEMPLATE_CONFIG.PL159.GTKT_COL_CODE;
        String srcE = Constant.TEMPLATE_CONFIG.PL159.GTCPSQL_COL_CODE;
        String srcF = Constant.TEMPLATE_CONFIG.PL159.NOTE_COL_CODE;

        for (GridRowExtractor.Row item : items) {
            output.add(GridRowSerializer.row("R" + (idxRef[0] + 1))
                    .sortOrder(idxRef[0])
                    .put(sttCol, sttRef[0])
                    .put(dstHangMuc, item.value(srcA))
                    .put(dstMaSo, item.value(srcB))
                    .put(dstNoiDung, item.value(srcC))
                    .put(dstGtkt, item.value(srcD))
                    .put(dstGtcp, item.value(srcE))
                    .put(dstKeHoach, keHoach)
                    .put(dstGhiChu, item.value(srcF))
                    .build());
            idxRef[0]++;
            sttRef[0]++;
        }
    }

    /**
     * Gộp rows của tất cả phiên nhập liệu cùng orgCode (1 năm có thể có nhiều entry / orgCode).
     * Chỉ lấy data row thực sự (qua {@link #isSclCategory}), bỏ header / sub-total.
     */
    private Map<String, List<GridRowExtractor.Row>> groupRowsByOrg(List<OrgDataEntryProjection> projections) {
        if (projections == null || projections.isEmpty()) {
            return Collections.emptyMap();
        }
        return projections.stream()
                .filter(p -> Strings.isNotBlank(p.getOrgCode()) && Strings.isNotBlank(p.getRowData()))
                .collect(Collectors.groupingBy(
                        OrgDataEntryProjection::getOrgCode,
                        Collectors.flatMapping(
                                p -> GridRowExtractor.extractRows(p.getRowData(), SclCategoryServiceImpl::isSclCategory).stream(),
                                Collectors.toUnmodifiableList())));
    }

    /**
     * Row đại diện 1 hạng mục SCL: STT là số nguyên dương (data row, không phải header)
     * + có tên danh mục (cột A).
     */
    private static boolean isSclCategory(Map<String, Object> row) {
        return row != null
                && GridRowExtractor.isPositiveIntegerStt(row)
                && Strings.isNotBlank(
                        GridRowExtractor.asString(row.get(Constant.TEMPLATE_CONFIG.PL159.CATEGORY_NAME_COL_CODE)))
                && Strings.isNotBlank(
                        GridRowExtractor.asString(row.get(Constant.TEMPLATE_CONFIG.PL159.CATEGORY_CODE_COL_CODE)));
    }

    public void exportReport(SclCategoryFilterDTO filter, AppUserDetails userDetails, HttpServletResponse response) {
        // 1) Year từ filter (fallback năm hiện tại nếu filter null/blank).
        int year = parseYearFromFilter(filter);

        SclCategoryFilterDTO appliedFilter = filter != null ? filter : new SclCategoryFilterDTO();
        appliedFilter.setYearPlan(String.valueOf(year));
        List<SclCategoryResponseDTO> all = sclCategoryRepositoryCustom.searchForExport(appliedFilter, userDetails);

        // 2) Partition theo status — eligible → sheet 2 (Cac_hm_du_dk_giao_kh), còn lại → sheet 3.
        Map<Boolean, List<SclCategoryResponseDTO>> partitioned = all.stream()
                .collect(Collectors.partitioningBy(c -> ELIGIBLE_STATUSES.contains(c.getStatus())));
        List<SclCategoryResponseDTO> sheet2Items = partitioned.get(true);
        List<SclCategoryResponseDTO> sheet3Items = partitioned.get(false);

        // 3) Layout sheet 2 + 3 phức tạp (group by PC + STT reset + merge cell + bold + sums +
        //    TỔNG CỘNG row) — không dùng được bindParamToSheet, gọi writer chuyên trách qua
        //    overload exportTemplate(Consumer<Workbook>).
        GroupedReportExcelWriter.GroupingSpec<SclCategoryResponseDTO> sheet2Spec = buildSheet2Spec();
        GroupedReportExcelWriter.GroupingSpec<SclCategoryResponseDTO> sheet3Spec = buildSheet3Spec();

        Map<String, Map<Integer, ? extends Number>> tongHopData = buildTongHopData(all, year);

        ExcelExportHandler.exportTemplate(
                Constant.TEMPLATE_FILE_PATH.SCL_CATEGORY_REPORT,
                wb -> {
                    // Fill placeholder ${year} (và mọi ${...} khác nếu thêm sau) trên toàn workbook.
                    ExcelUtils.replacePlaceholders(wb, Map.of("year", String.valueOf(year)));

                    // Sheet 1 (Tong_hop) — rows + công thức fix cứng template; service chỉ fill
                    // input cells. PC nào không có data → các cột tự = 0, formula tự recalc.
                    XSSFSheet sheet1 = resolveXssfSheet(wb, SHEET_TONG_HOP);
                    if (sheet1 != null) {
                        FixedRowsReportExcelWriter.write(sheet1, TONG_HOP_PC_ORDER,
                                TONG_HOP_FIRST_ROW_IDX, TONG_HOP_INPUT_COLS, tongHopData);
                        ExcelUtils.ensureMinColumnWidth(sheet1, TONG_HOP_DATA_COL_FIRST,
                                TONG_HOP_DATA_COL_LAST, TONG_HOP_MIN_COL_WIDTH);
                    }

                    XSSFSheet sheet2 = resolveXssfSheet(wb, SHEET_DU_DK_GIAO_KH);
                    if (sheet2 != null) {
                        GroupedReportExcelWriter.write(sheet2, sheet2Items, LAST_SHEET_SKIP_ROWS, SHEET_2_LAYOUT, sheet2Spec);
                    }
                    XSSFSheet sheet3 = resolveXssfSheet(wb, SHEET_CHUA_DU_DK_GIAO_KH);
                    if (sheet3 != null) {
                        GroupedReportExcelWriter.write(sheet3, sheet3Items, LAST_SHEET_SKIP_ROWS, SHEET_3_LAYOUT, sheet3Spec);
                    }
                },
                response);
    }

    private static int parseYearFromFilter(SclCategoryFilterDTO filter) {
        if (filter != null && filter.getYearPlan() != null && !filter.getYearPlan().isBlank()) {
            try {
                return Integer.parseInt(filter.getYearPlan().trim());
            } catch (NumberFormatException e) {
                log.warn("[exportReport] yearPlan filter '{}' không parse được, dùng năm hiện tại",
                        filter.getYearPlan());
            }
        }
        return LocalDate.now().getYear();
    }

    /**
     * Build map data cho sheet Tong_hop. Mỗi PC trong {@link #TONG_HOP_PC_ORDER} có 1 entry —
     * PC không có data → row rỗng → writer fill 0 toàn bộ.
     *
     * <p>Aggregate 2 nguồn data:
     * <ol>
     *   <li>SCL_CATEGORY (đã filter theo year + permission) — đăng ký KH (SL/Khái toán/Chi phí
     *       theo phân loại) + HM 110kV đủ ĐK thông qua (theo status).</li>
     *   <li>Entry phân bổ TCT (entryCode = "SCL_B21_PB_TCT_{year}", year = filter year) — cột
     *       D (110kV) + E (Khác 110kV) trong template Tong_hop.</li>
     * </ol>
     */
    private Map<String, Map<Integer, ? extends Number>> buildTongHopData(
            List<SclCategoryResponseDTO> all, int year) {
        Map<String, List<SclCategoryResponseDTO>> byPc = all.stream()
                .filter(c -> c.getPc() != null)
                .collect(Collectors.groupingBy(SclCategoryResponseDTO::getPc));

        Map<String, double[]> phanBoByPc = loadPhanBoData(year);

        Map<String, Map<Integer, ? extends Number>> result = new HashMap<>();
        for (String pc : TONG_HOP_PC_ORDER) {
            Map<Integer, Double> row = aggregateTongHopRow(byPc.getOrDefault(pc, List.of()));
            double[] pb = phanBoByPc.get(pc);
            if (pb != null) {
                row.put(COL_PB_TONG, pb[0]);
                row.put(COL_PB_110KV, pb[1]);
                row.put(COL_PB_KHAC_110KV, pb[2]);
            }
            result.put(pc, row);
        }
        return result;
    }

    /**
     * Aggregate 1 row Tong_hop từ list category của 1 PC.
     * <ul>
     *   <li>SL/Khái toán/Chi phí: 5 phân loại (110kV/TT/HT/Khác/KTr) match qua
     *       {@code assetType}. Empty list → bỏ trống các col → writer fill 0.</li>
     *   <li>HM 110kV đủ ĐK: filter status ∈ {@link #ELIGIBLE_STATUSES} (DA_DUYET_TD,
     *       GUI_LD_DUYET, LD_DA_THONG_QUA), COUNT/SUM khái toán/chi phí.</li>
     * </ul>
     */
    private static Map<Integer, Double> aggregateTongHopRow(List<SclCategoryResponseDTO> items) {
        Map<Integer, Double> row = new HashMap<>();
        if (items == null || items.isEmpty()) return row;

        // Đăng ký kế hoạch — 5 phân loại, mỗi phân loại 3 chỉ số (SL, Khái toán, Chi phí).
        for (int i = 0; i < PHAN_LOAI.size(); i++) {
            String loai = PHAN_LOAI.get(i);
            List<SclCategoryResponseDTO> filtered = items.stream()
                    .filter(c -> matchPhanLoai(c, loai))
                    .toList();
            if (filtered.isEmpty()) continue;
            row.put(COL_SL[i], (double) filtered.size());
            row.put(COL_KHAI_TOAN[i], sumDecimal(filtered, SclCategoryResponseDTO::getApprovedEstimatedCost));
            row.put(COL_CHI_PHI[i], sumDecimal(filtered, SclCategoryResponseDTO::getAssignedSclCost));
        }

        return row;
    }

    private static boolean matchPhanLoai(SclCategoryResponseDTO c, String loai) {
        String value = c.getAssetType();
        return value != null && value.trim().equalsIgnoreCase(loai);
    }

    private static double sumDecimal(List<SclCategoryResponseDTO> items,
                                     java.util.function.Function<SclCategoryResponseDTO, String> extractor) {
        return items.stream()
                .map(c -> ExcelUtils.parseDecimalSafe(extractor.apply(c)))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .doubleValue();
    }

    /**
     * Load phân bổ chi phí TCT từ {@code GRID_DATA_ENTRY} với entryCode = "SCL_B21_PB_TCT_{year}"
     * + year. Parse rowData JSON, extract 2 column ({@link #PHAN_BO_COL_110KV} +
     * {@link #PHAN_BO_COL_KHAC_110KV}) cho mỗi row, key = {@code row_code} (giả định = PC code).
     *
     * <p>Trả map rỗng nếu entry không tồn tại / rowData rỗng — writer sẽ fill 0 cho cột phân bổ.
     */
    private Map<String, double[]> loadPhanBoData(int year) {
        String entryCode = PHAN_BO_TCT_ENTRY_CODE_PREFIX + year;
        return gridDataEntryRepository.findFirstByEntryCodeAndYear(entryCode, year)
                .map(GridDataEntry::getRowData)
                .map(this::parsePhanBoRowData)
                .orElseGet(() -> {
                    log.warn("[exportReport] Không tìm thấy entry phân bổ entryCode='{}' year={}, fill 0",
                            entryCode, year);
                    return Map.of();
                });
    }

    private Map<String, double[]> parsePhanBoRowData(String rowDataJson) {
        Map<String, double[]> map = new HashMap<>();
        for (GridRowExtractor.Row row : GridRowExtractor.extractRows(rowDataJson)) {
            String pcCode = row.meta() != null ? row.meta().rowCode() : null;
            if (pcCode == null || pcCode.isBlank()) continue;
            double tong = ExcelUtils.parseDecimalSafe(row.stringValue(PHAN_BO_COL_TONG)).doubleValue();
            double v110kV = ExcelUtils.parseDecimalSafe(row.stringValue(PHAN_BO_COL_110KV)).doubleValue();
            double vKhac = ExcelUtils.parseDecimalSafe(row.stringValue(PHAN_BO_COL_KHAC_110KV)).doubleValue();
            map.put(pcCode, new double[]{tong, v110kV, vKhac});
        }
        return map;
    }

    private static GroupedReportExcelWriter.GroupingSpec<SclCategoryResponseDTO> buildSheet2Spec() {
        return new GroupedReportExcelWriter.GroupingSpec<>(
                SclCategoryResponseDTO::getPc,
                SclCategoryServiceImpl::sheet2RowValues,
                List.of(
                        new GroupedReportExcelWriter.SumColumn<>(4,
                                c -> ExcelUtils.parseDecimalSafe(c.getApprovedEstimatedCost())),
                        new GroupedReportExcelWriter.SumColumn<>(5,
                                c -> ExcelUtils.parseDecimalSafe(c.getAssignedSclCost()))
                ),
                GROUP_KEY_FALLBACK,
                TOTAL_ROW_LABEL
        );
    }

    private static GroupedReportExcelWriter.GroupingSpec<SclCategoryResponseDTO> buildSheet3Spec() {
        return new GroupedReportExcelWriter.GroupingSpec<>(
                SclCategoryResponseDTO::getPc,
                SclCategoryServiceImpl::sheet3RowValues,
                List.of(),
                GROUP_KEY_FALLBACK,
                TOTAL_ROW_LABEL
        );
    }

    /** Sheet 2: index 0 placeholder cho STT, 1..6 = giá trị các cột data (khớp SHEET_2_LAYOUT). */
    private static String[] sheet2RowValues(SclCategoryResponseDTO src) {
        return new String[]{
                null,
                src.getCategoryName(),
                src.getSsktCode() != null ? src.getSsktCode().toString() : "",
                src.getScContent(),
                src.getApprovedEstimatedCost(),
                src.getAssignedSclCost(),
                src.getNote()
        };
    }

    /** Sheet 3: index 0 placeholder cho STT, 1..3 = giá trị các cột data (khớp SHEET_3_LAYOUT). */
    private static String[] sheet3RowValues(SclCategoryResponseDTO src) {
        return new String[]{
                null,
                src.getCategoryName(),
                src.getScContent(),
                src.getNote()
        };
    }

    private static XSSFSheet resolveXssfSheet(Workbook wb, String name) {
        Sheet s = wb.getSheet(name);
        if (s == null) {
            log.warn("[exportReport] Template không có sheet '{}'", name);
            return null;
        }
        if (!(s instanceof XSSFSheet xs)) {
            log.warn("[exportReport] Sheet '{}' không phải XSSF — template phải là .xlsx", name);
            return null;
        }
        return xs;
    }
}
