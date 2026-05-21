import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TuiSvgModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiInputModule, TuiTextareaModule } from '@taiga-ui/kit';
import { saveAs } from 'file-saver';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../auth/auth.service';
import { FilterCatalogItemRequest } from '../../../catalog-manager/models/catalog.model';
import { CatalogService } from '../../../catalog-manager/service/catalog.service';
import { CatalogItem } from '../../../excel-builder/models/catalog.data';
import {
  AcceptDialogComponent,
  AcceptDialogData,
} from '../../../shared/components/accept-dialog/accept-dialog.component';
import { CommentSectionComponent } from '../../../shared/components/comment-section/comment-section.component';
import { DatePickerComponent } from '../../../shared/components/date-picker';
import {
  SelectOption,
  SingleSelectComponent,
} from '../../../shared/components/multi-select';
import {
  CustomButton,
  PageHeaderBreadcrumb,
  PageHeaderComponent,
} from '../../../shared/components/page-header/page-header.component';
import { AppDialogService } from '../../../shared/dialog.service';
import { VnNumberFormatDirective } from '../../../shared/directives/vn-number-format.directive';
import { DATE_FORMAT_ENUM } from '../../../shared/enum/date-time.enum';
import { Option } from '../../../shared/models/common.model';
import { OrganizationService } from '../../../shared/organization.service';
import {
  Comments,
  CommentsService,
} from '../../../shared/service/comments.service';
import { formatDateUtils } from '../../../shared/utils/date-format.util';
import { ChangeStatusComponent } from '../../dialogs/change-status/change-status.component';
import { RejectDialogComponent } from '../../dialogs/reject-dialog/reject-dialog.component';
import { SendAssesmentDialogComponent } from '../../dialogs/send-assesment-dialog/send-assesment-dialog.component';
import { ShowHistoryDialogComponent } from '../../dialogs/show-history-dialog/show-history-dialog.component';
import { PageTypeEnum } from '../../enums/page-type.enum';
import { STATUS_MAP, StatusEnum } from '../../enums/status.enum';
import {
  IdsDTO,
  RejectionAssessment,
  ReviseRequest,
  SclAssessmentDetail,
} from '../../model/scl-assessment.model';
import {
  CategoryCommentsDTO,
  SclCategory,
  UnitAssessment,
} from '../../model/scl-category.model';
import { SclAssessmentService } from '../../service/scl-assessment.service';
import { SclCategoryService } from '../../service/scl-category.service';
import {
  STATUS_ASSESSMENT_MAP,
  STATUS_OPTIONS,
  StatusAssessmentEnum,
} from '../../enums/status-assessment.enum';

@Component({
  selector: 'app-scl-category-detail',
  imports: [
    PageHeaderComponent,
    ShowHistoryDialogComponent,
    ReactiveFormsModule,
    SendAssesmentDialogComponent,
    AcceptDialogComponent,
    CommentSectionComponent,
    TuiSvgModule,
    CommonModule,
    RejectDialogComponent,
    TuiInputModule,
    TuiTextareaModule,
    TuiTextfieldControllerModule,
    SingleSelectComponent,
    DatePickerComponent,
    VnNumberFormatDirective,
    ChangeStatusComponent,
  ],
  templateUrl: './scl-category-detail.component.html',
  styleUrl: './scl-category-detail.component.scss',
})
export class SclCategoryDetailComponent implements OnInit {
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly sclCategoryService = inject(SclCategoryService);
  readonly sclAssessmentService = inject(SclAssessmentService);
  readonly catalogService = inject(CatalogService);
  readonly organizationService = inject(OrganizationService);
  readonly commentsService = inject(CommentsService);
  readonly authService = inject(AuthService);

  readonly destroy$ = new Subject<void>();
  readonly fb = inject(FormBuilder);
  readonly dialog = inject(AppDialogService);
  readonly table = 'SCL_ASSESSMENT';
  private readonly unitEditableStatuses = new Set([
    'CHUA_GUI_THAM_DINH', 
    'LD_KHONG_THONG_QUA',
    'TU_CHOI_DUYET_TD'
  ]);
  private readonly hiddenEditStatuses = new Set([
    'LD_DA_THONG_QUA',
    'DA_DUYET_TD',
  ]);

  categoryId: number | null = null;
  assessmentId: number | null = null;
  categoryDetail: SclCategory | null = null;
  assessmentDetail: SclAssessmentDetail | null = null;
  isShowHistoryDialogOpen = false;
  isOpenReject = false;
  rejectAction: 'reject' | 'forward' | 'propose-cancel' = 'reject';
  rejectDialogTitle = 'Từ chối thẩm định';
  showRejectInputReason = true;
  showRejectInputFile = true;
  showRejectSelectYear = false;
  isEditMode = false;
  form!: FormGroup;
  isOpenAssessment = false;
  unitOptions: Option[] = [];
  selectedUnits: Option[] = [];
  isOpen = false;
  openAccordions = new Set<number>();
  isOpenUpdateStatus = false;

  public dataDialog: {
    action: 'delete' | 'requiredEdit' | 'signature';
    id: number;
  } | null = null;

  typePage = '';
  typePageEnum = PageTypeEnum;

  thread: Comments | null = null;
  listThread: CategoryCommentsDTO | null = null;

  breadcrumbs: PageHeaderBreadcrumb[] = [];
  headerTitle: string = 'Quản lý lập kế hoạch năm';

  get listUnitComments(): UnitAssessment[] {
    return this.listThread?.listUnitAssessment ?? [];
  }

  get showCommentAssessment(): boolean {
    return this.typePage === PageTypeEnum.ASSESSMENT;
  }

  get showCommentCategory(): boolean {
    return this.categoryDetail?.status === StatusEnum.DA_GUI_TD;
  }

  get singleComment(): boolean {
    return this.thread !== null;
  }

  get showInputNewComment(): boolean {
    return this.assessmentDetail?.status === StatusEnum.DA_GUI_TD;
  }

  get isPcCompanyUser(): boolean {
    return (
      (this.authService.currentUser?.orgGroupCode ?? '').toUpperCase() ===
      'PC_COMPANY'
    );
  }

  get canEditCurrentCategory(): boolean {
    const status = this.categoryDetail?.status ?? '';
    return this.isPcCompanyUser
      ? this.unitEditableStatuses.has(status)
      : !this.hiddenEditStatuses.has(status);
  }

  getStatusCommentClass(status: string): string {
    return STATUS_ASSESSMENT_MAP[status]?.class ?? 'default';
  }

  getStatusCommentLabel(status: string): string {
    return STATUS_ASSESSMENT_MAP[status]?.label ?? status;
  }

  get customButtons(): CustomButton[] {
    return [
      {
        title: 'Cần hiệu chỉnh',
        icon: 'tuiIconEdit',
        show:
          this.typePage === PageTypeEnum.ASSESSMENT &&
          this.assessmentDetail?.status === StatusAssessmentEnum.DA_GUI_TD,
        disabled: false,
        action: 'revise',
      },
      {
        title: 'Đồng ý',
        icon: 'tuiIconCheck',
        show:
          this.typePage === PageTypeEnum.ASSESSMENT &&
          this.assessmentDetail?.status === StatusAssessmentEnum.DA_GUI_TD,
        disabled: false,
        action: 'accept',
      },
      {
        title: 'Từ chối',
        icon: 'tuiIconClose',
        show:
          this.typePage === PageTypeEnum.ASSESSMENT &&
          this.assessmentDetail?.status === StatusAssessmentEnum.DA_GUI_TD,
        disabled: false,
        action: 'reject',
        appearance: 'secondary',
      },
      {
        title: 'Đổi trạng thái',
        icon: 'tuiIconEdit',
        show: this.typePage === PageTypeEnum.CATEGORY,
        // &&
        // this.canEditCurrentCategory,
        disabled: false,
        action: 'update-status',
      },
      {
        title: 'Đề xuất hủy',
        icon: 'tuiIconXCircle',
        show:
          !this.isEditMode &&
          this.typePage !== PageTypeEnum.ASSESSMENT &&
          this.canEditCurrentCategory,
        disabled: false,
        action: 'propose-cancel',
      },
      {
        title: 'Chuyển tiếp',
        icon: 'tuiIconArrowRight',
        show:
          !this.isEditMode &&
          this.typePage !== PageTypeEnum.ASSESSMENT &&
          this.canEditCurrentCategory,
        disabled: false,
        action: 'forward',
      },
      // Nhóm nút khi không ở edit mode
      {
        title: 'Chỉnh sửa',
        icon: 'tuiIconEdit2',
        show:
          !this.isEditMode &&
          this.typePage === PageTypeEnum.CATEGORY &&
          this.canEditCurrentCategory,
        disabled: false,
        action: 'edit',
      },
      // {
      //   title: 'Yêu cầu chỉnh sửa',
      //   icon: 'tuiIconSend',
      //   show: !this.isEditMode && this.typePage !== PageTypeEnum.ASSESSMENT,
      //   disabled: false,
      //   action: 'required-edit',
      // },
      {
        title: 'Xem lịch sử',
        icon: 'tuiIconClock',
        show: !this.isEditMode || this.typePage === PageTypeEnum.ASSESSMENT,
        disabled: false,
        action: 'history',
      },
      // {
      //   title: 'Xuất biểu mẫu',
      //   icon: 'tuiIconDownload',
      //   show: !this.isEditMode,
      //   disabled: this.isEditMode,
      //   action: 'export',
      //   appearance: 'secondary',
      // },

      // Nhóm nút khi ở edit mode
      {
        title: 'Huỷ',
        icon: 'tuiIconClose',
        show: this.isEditMode && this.typePage === PageTypeEnum.CATEGORY,
        disabled: false,
        action: 'cancel',
      },
      {
        title: 'Lưu',
        icon: 'tuiIconSave',
        show: this.isEditMode && this.typePage === PageTypeEnum.CATEGORY,
        disabled: false,
        action: 'save',
      },
    ];
  }

  statusOptions?: CatalogItem[];
  progressOptions: string[] = [];
  editableStatusOptions: SelectOption<string>[] = [];
  progressSelectOptions: SelectOption<string>[] = [];
  assetTypeSelectOptions: SelectOption<string>[] = [];
  planTypeSelectOptions: SelectOption<string>[] = [];
  dialogData: AcceptDialogData = {
    title: '',
    message: '',
    status: 'info',
    confirmText: '',
    cancelText: '',
  };
  ngOnInit(): void {
    this.buildForm();

    this.loadFilterOptions();

    this.loadStatusOptions();
    this.loadProgressOptions();
    this.loadAssetTypeOptions();
    this.loadPlanTypeOptions();
    this.route.queryParams.subscribe((params) => {
      const type = params['type'];
      const id = params['id'];

      this.typePage = type;

      if (type === PageTypeEnum.ASSESSMENT) {
        this.breadcrumbs = [
          { label: 'Trang chủ', link: '/' },
          { label: 'Quy trình SCL', link: '/scl-category' },
          { label: 'Quản lý thẩm định SCL', link: '' },
        ];
        this.assessmentId = id ? Number(id) : null;
      } else {
        this.breadcrumbs = [
          { label: 'Trang chủ', link: '/' },
          { label: 'Quy trình SCL', link: '/scl-category' },
          { label: 'Quản lý hạng mục SCL', link: '' },
        ];
        this.categoryId = id ? Number(id) : null;
      }

      this.isEditMode = params['mode'] === 'edit';
      this.form.disable();

      this.loadDetail(id);
    });
  }

  sendAssessment() {
    console.log('assessment confirm');
    this.dialog.success('Gửi thẩm định thành công');
  }

  loadStatusOptions(): void {
    const req: FilterCatalogItemRequest = {
      keyword: '',
      pageNum: 0,
      pageSize: 20,
      type: 'APPROVE_STATUS_SCL',
    };

    if (this.typePage === this.typePageEnum.CATEGORY) {
      this.catalogService.searchCatalogItems(req).subscribe({
        next: (res) => {
          this.statusOptions = res.content || [];
          this.editableStatusOptions = this.statusOptions.map((item) => ({
            value: item.id,
            label: item.name,
          }));
        },
      });
    } else {
      // Danh sách trạng thái của thẩm định
      this.editableStatusOptions = STATUS_OPTIONS;
    }
  }

  loadProgressOptions(): void {
    const req: FilterCatalogItemRequest = {
      keyword: '',
      pageNum: 0,
      pageSize: 20,
      type: 'SCL_TIENDO',
    };

    this.catalogService.searchCatalogItems(req).subscribe({
      next: (res) => {
        this.progressOptions = res.content.map((item) => item.name) || [];
        this.progressSelectOptions = this.progressOptions.map((name) => ({
          value: name,
          label: name,
        }));
      },
    });
  }

  loadAssetTypeOptions(): void {
    this.catalogService.getCatalogs('SCL_PHANLOAI').subscribe({
      next: (items) => {
        this.assetTypeSelectOptions = (items ?? []).map((item) => ({
          value: item.name,
          label: item.name,
        }));
      },
    });
  }

  loadPlanTypeOptions(): void {
    this.catalogService.getCatalogs('SCL_KEHOACH').subscribe({
      next: (items) => {
        this.planTypeSelectOptions = (items ?? []).map((item) => ({
          value: item.name,
          label: item.name,
        }));
      },
    });
  }

  handleRequiredEditSelected() {
    const id = this.categoryDetail?.id ?? this.categoryId;

    if (typeof id !== 'number' || !Number.isFinite(id)) {
      return;
    }

    this.isOpen = true;

    this.dialogData = {
      title: 'Yêu cầu chỉnh sửa',
      message: `Xác nhận yêu cầu chỉnh sửa?`,
      status: 'info',
      confirmText: 'Xác nhận',
      cancelText: 'Hủy',
    };
    this.dataDialog = { action: 'requiredEdit', id };
  }

  private loadDetail(id: number): void {
    if (this.typePage == PageTypeEnum.ASSESSMENT) {
      this.sclAssessmentService.getById(id).subscribe({
        next: (res) => {
          const data = res.categoryResponse;
          if (data) {
            this.categoryId = data.id ? Number(data.id) : null;
            data.dateCompleteContract = this.formatDate(
              data.dateCompleteContract,
            );
            data.approvalDatePakt = this.formatDate(data.approvalDatePakt);
            data.approvalDateEstimate = this.formatDate(
              data.approvalDateEstimate,
            );
            data.plannedCompletionDate = this.formatDate(
              data.plannedCompletionDate,
            );
            data.deliveryPlan = this.formatDate(data.deliveryPlan);
            data.actual = this.formatDate(data.actual);
          }
          this.assessmentDetail = res;
          this.categoryDetail = data;

          this.categoryDetail &&
            (this.categoryDetail.status = this.assessmentDetail.status);
          this.form.patchValue(this.categoryDetail ?? {});

          if (this.isEditMode) {
            this.applyEditModeByPermission();
          } else {
            this.form.disable();
          }
        },
        error: (err) => {
          console.error('Error loading category assessment detail:', err);
        },
      });

      this.loadComments(id);
    } else {
      this.sclCategoryService.getById(id).subscribe({
        next: (data) => {
          if (data) {
            data.dateCompleteContract = this.formatDate(
              data.dateCompleteContract,
            );
            data.approvalDatePakt = this.formatDate(data.approvalDatePakt);
            data.approvalDateEstimate = this.formatDate(
              data.approvalDateEstimate,
            );
            data.plannedCompletionDate = this.formatDate(
              data.plannedCompletionDate,
            );
            data.deliveryPlan = this.formatDate(data.deliveryPlan);
            data.actual = this.formatDate(data.actual);
          }
          this.categoryDetail = data;
          this.form.patchValue(data ?? {});
          this.listThread = data.categoryCommentsDTO ?? null;

          if (this.isEditMode) {
            this.applyEditModeByPermission();
          } else {
            this.form.disable();
          }
        },
        error: (err) => {
          console.error('Error loading category detail:', err);
        },
      });
    }
  }

  loadComments(id: number): void {
    this.commentsService
      .getComments({
        type: this.table,
        groupId: id,
      })
      .subscribe({
        next: (res) => {
          this.thread = res;
        },
        error: (err) => {
          console.error('Error loading comments:', err);
        },
      });
  }

  private loadFilterOptions(): void {
    forkJoin({
      organizations: this.organizationService.getAll(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ organizations }) => {
          this.unitOptions = organizations
            .map((org) => ({ label: org.orgName, value: org.orgCode }))
            .filter((option): option is Option => !!option.label);
        },
      });
  }

  getStatusName(statusId?: string): string {
    if (!statusId) return '';

    const found = this.statusOptions?.find((x) => x.id === statusId);
    return found?.name || '';
  }

  formatDate(date: any): string {
    return formatDateUtils(date, DATE_FORMAT_ENUM.YYYY_MM_DD_DASH);
  }

  formatDateToDisplay(date: any): string {
    return formatDateUtils(date, DATE_FORMAT_ENUM.DD_MM_YYYY);
  }

  getStatusLabel(status: any): string {
    if (status == 1) return 'Đã đăng ký';
    if (status == 2) return 'Chưa đăng ký';
    return status ? String(status) : '';
  }

  openShowHistory(): void {
    this.isShowHistoryDialogOpen = true;
  }

  private buildForm(): void {
    this.form = this.fb.group({
      scContent: [{ value: '', disabled: true }],
      assetType: [{ value: '', disabled: true }],
      planType: [{ value: '', disabled: true }],
      sclPerform: [{ value: '', disabled: true }],
      ssktCode: [{ value: '', disabled: true }],
      approvedCategory: [{ value: '', disabled: true }],
      approvalLevel: [{ value: '', disabled: true }],
      executionMethod: [{ value: '', disabled: true }],
      accumulatedProgress: [{ value: '', disabled: true }],
      nextMonthPlan: [{ value: '', disabled: true }],
      decisionNoPakt: [{ value: '', disabled: true }],
      approvalDatePakt: [{ value: '', disabled: true }],
      decisionNoEstimate: [{ value: '', disabled: true }],
      approvalDateEstimate: [{ value: '', disabled: true }],
      valueVat: [{ value: '', disabled: true }],
      approvedEstimatedCost: [{ value: '', disabled: true }],
      assignedSclCost: [{ value: '', disabled: true }],
      totalContractValue: [{ value: '', disabled: true }],
      monthAccountingValue: [{ value: '', disabled: true }],
      accumulatedAccountingValue: [{ value: '', disabled: true }],
      projectValue: [{ value: '', disabled: true }],
      itemAccountingValue: [{ value: '', disabled: true }],
      deliveryPlan: [{ value: '', disabled: true }],
      plannedCompletionDate: [{ value: '', disabled: true }],
      actual: [{ value: '', disabled: true }],
      percentage: [{ value: '', disabled: true }],
      valueCostEquivalent: [{ value: '', disabled: true }],
      equipmentBeforeScl: [{ value: '', disabled: true }],
      equipmentAfterScl: [{ value: '', disabled: true }],
      issues: [{ value: '', disabled: true }],
      note: [{ value: '', disabled: true }],
      status: [{ value: null, disabled: true }],
      progress: [{ value: '', disabled: true }],
      dateCompleteContract: [{ value: null, disabled: true }],
    });
  }

  switchToEdit(): void {
    if (!this.canEditCurrentCategory) return;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: this.categoryId, mode: 'edit' },
      queryParamsHandling: 'merge',
    });
  }

  cancelEdit(): void {
    this.router.navigate(['/scl-category']);
  }

  handleAssessmentSelected() {
    this.isOpenAssessment = true;
  }

  handleExportSelected(): void {
    const id = this.categoryDetail?.id ?? this.categoryId;

    if (typeof id !== 'number' || !Number.isFinite(id)) {
      this.dialog.error('Khong xac dinh duoc hang muc de export');
      return;
    }

    this.sclCategoryService.exportCategories({ id }).subscribe({
      next: (response) => {
        if (!response.body) {
          this.dialog.error('Khong nhan duoc file export');
          return;
        }

        const fileName = this.getExportFileName(
          response.headers.get('content-disposition'),
        );
        saveAs(response.body, fileName);
        this.dialog.success('Export hang muc thanh cong');
      },
      error: (err) => {
        this.dialog.error(
          'Loi export: ' +
            (err?.error?.message ||
              err?.message ||
              'Khong the export hang muc'),
        );
      },
    });
  }

  closeDialog() {
    this.isOpenAssessment = false;
    this.selectedUnits = []; // reset luôn
  }

  handleDialogOpenChange(open: boolean) {
    this.isOpenAssessment = open;

    if (!open) {
      this.closeDialog();
    }
  }

  save(): void {
    if (!this.canEditCurrentCategory) {
      this.dialog.error(
        'Bạn không có quyền chỉnh sửa hạng mục ở trạng thái hiện tại',
      );
      this.cancelEdit();
      return;
    }

    if (this.form.invalid) return;

    const payload: SclCategory = {
      ...this.categoryDetail,
      ...this.form.getRawValue(),
      id: this.categoryId!,
    };

    this.sclCategoryService.updateCategory(payload).subscribe({
      next: () => {
        this.categoryDetail = payload;
        this.dialog.success('Chỉnh sửa hạng mục thành công');
        this.isEditMode = true;
        this.loadDetail(this.categoryId!);
      },
      error: (err) => {
        this.dialog.error(
          'Lỗi chỉnh sửa hạng mục: ' +
            (err?.error?.message ||
              err?.message ||
              'Không thể chỉnh sửa hạng mục'),
        );
      },
    });
  }

  private applyEditModeByPermission(): void {
    // debugger;
    if (this.canEditCurrentCategory) {
      this.form.enable();
      return;
    }

    this.form.disable();
    if (this.isEditMode) {
      this.isEditMode = false;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { mode: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  onCancel() {
    this.isOpen = false;
  }

  handleAcceptEvent(): void {
    this.isOpen = false;
    const action = this.dialogData?.action;
    switch (action) {
      case 'confirmAssessment':
        this.onConfirmAssessment();
        break;
      case 'approveAssessment':
        this.onConfirmApprove();
        break;
      case 'reviseAssessment':
        this.onConfirmRevise();
        break;
    }
  }

  handleForwardSelected(): void {
    this.rejectAction = 'forward';
    this.rejectDialogTitle = 'Chuyển tiếp hạng mục';
    this.showRejectInputReason = false;
    this.showRejectInputFile = true;
    this.showRejectSelectYear = true;
    this.isOpenReject = true;
  }

  handleProposeCancelSelected(): void {
    this.rejectAction = 'propose-cancel';
    this.rejectDialogTitle = 'Đề xuất hủy hạng mục';
    this.showRejectInputReason = true;
    this.showRejectInputFile = true;
    this.showRejectSelectYear = false;
    this.isOpenReject = true;
  }

  onConfirmForward(event: RejectionAssessment): void {
    // TODO: gọi service chuyển tiếp khi BE sẵn sàng
    // event.year, event.attachments
    this.dialog.success('Chuyển tiếp hạng mục thành công');
  }

  onConfirmProposeCancel(event: RejectionAssessment): void {
    // TODO: gọi service đề xuất hủy khi BE sẵn sàng
    // event.reason, event.attachments
    this.dialog.success('Đề xuất hủy hạng mục thành công');
  }

  private getExportFileName(contentDisposition: string | null): string {
    const fallback = 'hang-muc-scl.xlsx';

    if (!contentDisposition) {
      return fallback;
    }

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const asciiMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    return asciiMatch?.[1] || fallback;
  }

  onHandleSendComment(event: any): void {
    const id = this.assessmentId ?? this.categoryDetail?.id;

    if (id === undefined) {
      this.dialog.error('Không tìm thấy ID để gửi góp ý');
      return;
    }

    this.commentsService
      .sendComment(
        {
          content: event.content,
          type: this.table,
          groupId: id,
        },
        event.files,
      )
      .subscribe({
        next: () => {
          this.dialog.success('Gửi góp ý thành công');
          this.loadComments(id);
        },
      });
  }

  onHandleSaveEdit(event: any): void {
    const id = this.assessmentId ?? this.categoryDetail?.id;
    if (id === undefined) {
      this.dialog.error('Không tìm thấy ID để lưu chỉnh sửa góp ý');
      return;
    }
    this.commentsService.editComment(event).subscribe({
      next: () => {
        this.dialog.success('Lưu chỉnh sửa góp ý thành công');
        this.loadComments(id);
      },
      error: (err) => {
        this.dialog.error('Lỗi khi lưu chỉnh sửa góp ý');
      },
    });
  }

  onHandleDeleteComment(event: any): void {
    const id = this.assessmentId ?? this.categoryDetail?.id;
    if (id === undefined) {
      this.dialog.error('Không tìm thấy ID để xóa góp ý');
      return;
    }
    this.commentsService.deleteComment(event).subscribe({
      next: () => {
        this.dialog.success('Xóa góp ý thành công');
        this.loadComments(id);
      },
      error: (err) => {
        this.dialog.error('Lỗi khi xóa góp ý');
      },
    });
  }

  toggleAccordion(id: number): void {
    if (this.openAccordions.has(id)) {
      this.openAccordions.delete(id);
    } else {
      this.openAccordions.add(id);
    }
  }

  isOpenCommnents(id: number): boolean {
    return this.openAccordions.has(id);
  }

  handleRejectAssessment(): void {
    this.rejectAction = 'reject';
    this.rejectDialogTitle = 'Từ chối thẩm định';
    this.showRejectInputReason = true;
    this.showRejectInputFile = true;
    this.showRejectSelectYear = false;
    this.isOpenReject = true;
  }

  onCancelReject(): void {
    this.isOpenReject = false;
  }

  onConfirmReject(event: RejectionAssessment): void {
    switch (this.rejectAction) {
      case 'reject':
        this.runRejectAssessment(event);
        break;
      case 'forward':
        this.onConfirmForward(event);
        break;
      case 'propose-cancel':
        this.onConfirmProposeCancel(event);
        break;
    }
  }

  private runRejectAssessment(event: RejectionAssessment): void {
    const id = this.assessmentId ?? '';
    if (id === undefined) {
      this.dialog.error('Không tìm thấy ID để gửi yêu cầu từ chối');
      return;
    }
    this.sclAssessmentService
      .reject(
        {
          id: Number(id),
          reason: event.reason,
        },
        event.attachments || [],
      )
      .subscribe({
        next: () => {
          this.dialog.success('Từ chối thẩm định thành công');
          this.loadDetail(Number(id));
        },
        error: (err) => {
          this.dialog.error('Lỗi khi từ chối thẩm định');
        },
      });
  }

  handleConfirmAssessment(): void {
    this.isOpen = true;

    this.dialogData = {
      title: 'Xác nhận thẩm định',
      message: `Xác nhận yêu cầu thẩm định?`,
      status: 'info',
      confirmText: 'Xác nhận',
      cancelText: 'Hủy',
      action: 'confirmAssessment',
    };
  }

  handleAcceptAssessment(): void {
    this.isOpen = true;

    this.dialogData = {
      title: 'Đồng ý thẩm định',
      message: `Xác nhận đồng ý thẩm định?`,
      status: 'info',
      confirmText: 'Xác nhận',
      cancelText: 'Hủy',
      action: 'approveAssessment',
    };
  }

  onConfirmApprove(): void {
    const id = this.assessmentId ?? this.categoryDetail?.id;
    if (id === undefined) {
      this.dialog.error('Không tìm thấy ID để gửi yêu cầu đồng ý');
      return;
    }
    this.sclAssessmentService.approve(Number(id)).subscribe({
      next: () => {
        this.dialog.success('Đồng ý thẩm định thành công');
        this.loadDetail(Number(id));
      },
      error: (err) => {
        this.dialog.error('Lỗi khi đồng ý thẩm định');
      },
    });
  }

  handleReviseAssessment(): void {
    this.isOpen = true;

    this.dialogData = {
      title: 'Yêu cầu hiệu chỉnh',
      message: `Xác nhận yêu cầu hiệu chỉnh?`,
      status: 'info',
      confirmText: 'Xác nhận',
      cancelText: 'Hủy',
      action: 'reviseAssessment',
    };
  }

  onConfirmRevise(): void {
    const id = this.assessmentId ?? this.categoryDetail?.id;
    if (id === undefined) {
      this.dialog.error('Không tìm thấy ID để gửi yêu cầu hiệu chỉnh');
      return;
    }

    const payload: ReviseRequest = {
      id: Number(id),
    };

    this.sclAssessmentService.revise(payload).subscribe({
      next: () => {
        this.dialog.success('Yêu cầu hiệu chỉnh thẩm định thành công');
        this.loadDetail(Number(id));
      },
      error: (err) => {
        this.dialog.error('Lỗi khi gửi yêu cầu hiệu chỉnh thẩm định');
      },
    });
  }

  onConfirmAssessment(): void {
    const id = this.assessmentId ?? this.assessmentDetail?.id;
    if (id === undefined || id === null) {
      this.dialog.error('Không tìm thấy ID hạng mục để gửi thẩm định');
      return;
    }

    const payload: IdsDTO = {
      ids: [Number(id)],
      assessmentUnit: this.selectedUnits,
    };

    this.sclAssessmentService.confirm(payload).subscribe({
      next: () => {
        this.dialog.success('Gửi thẩm định thành công');
        this.closeDialog();
        this.loadDetail(Number(id));
      },
      error: (err) => {
        this.dialog.error(
          'Lỗi khi gửi thẩm định: ' +
            (err?.error?.message || err?.message || 'Không thể gửi thẩm định'),
        );
      },
    });
  }

  handleUpdateStatusSelected() {
    this.isOpenUpdateStatus = true;
  }

  onChangeStatusConfirmed(status: CatalogItem): void {
    if (!status?.id || !this.categoryId) return;

    this.sclCategoryService
      .updateStatus([this.categoryId], status.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.dialog.success('Cập nhật trạng thái thành công');
          this.isOpenUpdateStatus = false;
          this.loadDetail(this.categoryId!);
        },
        error: (err: any) => {
          this.dialog.error(
            'Lỗi cập nhật trạng thái: ' +
              (err?.error?.message ||
                err?.message ||
                'Không thể cập nhật trạng thái'),
          );
        },
      });
  }

  onCustomBtnClick(btn: CustomButton): void {
    switch (btn.action) {
      case 'confirm_assessment':
        this.handleConfirmAssessment();
        break;
      case 'accept':
        this.handleAcceptAssessment();
        break;
      case 'reject':
        this.handleRejectAssessment();
        break;
      case 'revise':
        this.handleReviseAssessment();
        break;
      case 'update-status':
        this.handleUpdateStatusSelected();
        break;
      case 'forward':
        this.handleForwardSelected();
        break;
      case 'propose-cancel':
        this.handleProposeCancelSelected();
        break;
      case 'edit':
        this.switchToEdit();
        break;
      case 'required-edit':
        this.handleRequiredEditSelected();
        break;
      case 'history':
        this.openShowHistory();
        break;
      case 'export':
        this.handleExportSelected();
        break;
      case 'cancel':
        this.cancelEdit();
        break;
      case 'save':
        this.save();
        break;
    }
  }
}
