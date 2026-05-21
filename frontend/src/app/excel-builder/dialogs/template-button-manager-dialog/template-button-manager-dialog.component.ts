import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TuiButtonModule,
  TuiDropdownModule,
  TuiHostedDropdownModule,
  TuiSvgModule,
  TuiTextfieldControllerModule,
} from '@taiga-ui/core';
import { TuiInputModule, TuiInputNumberModule } from '@taiga-ui/kit';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { AppDialogDirective } from '../../../shared/components/app-dialog.directive';
import {
  MultiSelectComponent,
  SelectOption,
  SingleSelectComponent,
} from '../../../shared/components/multi-select';
import {
  TemplateButtonItem,
  TemplateButtonService,
  CreateTemplateButtonRequest,
  UpdateTemplateButtonRequest,
  ActionHandlerInfo,
} from '../../service/template-button.service';
import { AppDialogService } from '../../../shared/dialog.service';
import {
  TemplateAccessService,
  TemplateAccessItem,
  CreateTemplateAccessRequest,
} from '../../../shared/template-access.service';
import { DeptTypeItem, DeptTypeService } from '../../../shared/dept-type.service';
import { PositionItem, PositionService } from '../../../position-management/position.service';

interface TemplateButtonIconOption {
  readonly icon: string;
  readonly label: string;
  readonly category: string;
  readonly searchText: string;
}

const RAW_TEMPLATE_BUTTON_ICON_OPTIONS: ReadonlyArray<
  readonly [icon: string, label: string, category: string, keywords: string]
> = [
  ['tuiIconEye', 'Xem chi tiết', 'Thao tác', 'view preview'],
  ['tuiIconEyeOff', 'Ẩn thông tin', 'Thao tác', 'hide private'],
  ['tuiIconEdit', 'Cập nhật nhanh', 'Thao tác', 'edit update'],
  ['tuiIconEdit2', 'Chỉnh sửa', 'Thao tác', 'edit modify'],
  ['tuiIconEdit3', 'Đánh dấu chỉnh sửa', 'Thao tác', 'edit annotate'],
  ['tuiIconPlus', 'Thêm mới', 'Thao tác', 'add create'],
  ['tuiIconPlusCircle', 'Thêm bản ghi', 'Thao tác', 'add create new'],
  ['tuiIconMinus', 'Giảm trừ', 'Thao tác', 'remove subtract'],
  ['tuiIconMinusCircle', 'Loại bỏ', 'Thao tác', 'remove delete'],
  ['tuiIconTrash', 'Xóa', 'Thao tác', 'delete trash'],
  ['tuiIconTrash2', 'Xóa vĩnh viễn', 'Thao tác', 'delete remove'],
  ['tuiIconSave', 'Lưu dữ liệu', 'Thao tác', 'save store'],
  ['tuiIconCheck', 'Xác nhận', 'Phê duyệt', 'confirm done'],
  ['tuiIconCheckCircle', 'Hoàn tất', 'Phê duyệt', 'complete success'],
  ['tuiIconX', 'Hủy thao tác', 'Phê duyệt', 'cancel close'],
  ['tuiIconXCircle', 'Từ chối', 'Phê duyệt', 'reject deny'],
  ['tuiIconSend', 'Gửi phê duyệt', 'Quy trình', 'send submit'],
  ['tuiIconUpload', 'Tải lên', 'Dữ liệu', 'upload import'],
  ['tuiIconUploadCloud', 'Đồng bộ lên hệ thống', 'Dữ liệu', 'sync cloud upload'],
  ['tuiIconDownload', 'Tải xuống', 'Dữ liệu', 'download export'],
  ['tuiIconDownloadCloud', 'Lấy dữ liệu từ cloud', 'Dữ liệu', 'cloud download backup'],
  ['tuiIconRefreshCw', 'Làm mới', 'Thao tác', 'refresh reload'],
  ['tuiIconRefreshCcw', 'Khôi phục', 'Thao tác', 'restore reset'],
  ['tuiIconSearch', 'Tìm kiếm', 'Điều hướng', 'search find'],
  ['tuiIconFilter', 'Lọc dữ liệu', 'Điều hướng', 'filter sort'],
  ['tuiIconSettings', 'Cài đặt', 'Quản trị', 'settings config'],
  ['tuiIconSliders', 'Tùy chỉnh bộ lọc', 'Quản trị', 'adjust sliders'],
  ['tuiIconTool', 'Công cụ', 'Quản trị', 'tool utility'],
  ['tuiIconShield', 'Bảo mật', 'Quản trị', 'security shield'],
  ['tuiIconShieldOff', 'Bỏ bảo vệ', 'Quản trị', 'disable security'],
  ['tuiIconLock', 'Khóa', 'Quản trị', 'lock protect'],
  ['tuiIconUnlock', 'Mở khóa', 'Quản trị', 'unlock open'],
  ['tuiIconKey', 'Cấp quyền', 'Quản trị', 'permission access'],
  ['tuiIconUser', 'Người dùng', 'Nhân sự', 'user profile'],
  ['tuiIconUsers', 'Nhóm người dùng', 'Nhân sự', 'users team'],
  ['tuiIconUserCheck', 'Người duyệt', 'Nhân sự', 'approver reviewer'],
  ['tuiIconUserPlus', 'Thêm người', 'Nhân sự', 'invite add user'],
  ['tuiIconUserMinus', 'Bỏ người', 'Nhân sự', 'remove user'],
  ['tuiIconBriefcase', 'Đơn vị công tác', 'Nhân sự', 'organization office'],
  ['tuiIconAward', 'Vai trò', 'Nhân sự', 'role badge title'],
  ['tuiIconFile', 'Tập tin', 'Tài liệu', 'file document'],
  ['tuiIconFileText', 'Văn bản', 'Tài liệu', 'document text report'],
  ['tuiIconFilePlus', 'Thêm tài liệu', 'Tài liệu', 'file add'],
  ['tuiIconFileMinus', 'Bỏ tài liệu', 'Tài liệu', 'file remove'],
  ['tuiIconFolder', 'Thư mục', 'Tài liệu', 'folder directory'],
  ['tuiIconFolderPlus', 'Thêm thư mục', 'Tài liệu', 'folder add'],
  ['tuiIconFolderMinus', 'Bỏ thư mục', 'Tài liệu', 'folder remove'],
  ['tuiIconClipboard', 'Phiếu nhập', 'Tài liệu', 'clipboard form'],
  ['tuiIconCopy', 'Sao chép', 'Thao tác', 'copy duplicate'],
  ['tuiIconGrid', 'Dạng lưới', 'Dữ liệu', 'grid table'],
  ['tuiIconList', 'Danh sách', 'Dữ liệu', 'list rows'],
  ['tuiIconTable', 'Bảng dữ liệu', 'Dữ liệu', 'table sheet'],
  ['tuiIconLayout', 'Bố cục', 'Dữ liệu', 'layout designer'],
  ['tuiIconColumns', 'Cột dữ liệu', 'Dữ liệu', 'columns'],
  ['tuiIconLayers', 'Tổng hợp lớp', 'Dữ liệu', 'layers aggregate'],
  ['tuiIconDatabase', 'Cơ sở dữ liệu', 'Dữ liệu', 'database storage'],
  ['tuiIconServer', 'Máy chủ', 'Dữ liệu', 'server backend'],
  ['tuiIconTag', 'Nhãn mã', 'Dữ liệu', 'tag label'],
  ['tuiIconFlag', 'Đánh dấu ưu tiên', 'Quy trình', 'flag priority'],
  ['tuiIconCalendar', 'Lịch công tác', 'Điều hướng', 'calendar schedule'],
  ['tuiIconClock', 'Thời gian', 'Điều hướng', 'clock time'],
  ['tuiIconTime', 'Hạn xử lý', 'Điều hướng', 'deadline time'],
  ['tuiIconBarChart', 'Báo cáo cột', 'Báo cáo', 'chart report'],
  ['tuiIconBarChart2', 'Thống kê cột', 'Báo cáo', 'analytics bar'],
  ['tuiIconPieChart', 'Báo cáo tỉ lệ', 'Báo cáo', 'pie chart'],
  ['tuiIconTrendingUp', 'Tăng trưởng', 'Báo cáo', 'trend up'],
  ['tuiIconTrendingDown', 'Giảm trưởng', 'Báo cáo', 'trend down'],
  ['tuiIconTarget', 'Chỉ tiêu', 'Báo cáo', 'target goal kpi'],
  ['tuiIconActivity', 'Tiến độ xử lý', 'Báo cáo', 'activity progress'],
  ['tuiIconGlobe', 'Toàn hệ thống', 'Điều hướng', 'global network'],
  ['tuiIconHome', 'Trang tổng quan', 'Điều hướng', 'home dashboard'],
  ['tuiIconMap', 'Sơ đồ địa bàn', 'Điều hướng', 'map location'],
  ['tuiIconMapPin', 'Điểm đơn vị', 'Điều hướng', 'pin location'],
  ['tuiIconMail', 'Email thông báo', 'Liên lạc', 'mail notification'],
  ['tuiIconPhone', 'Liên hệ điện thoại', 'Liên lạc', 'phone call'],
  ['tuiIconMessageCircle', 'Trao đổi', 'Liên lạc', 'message chat'],
  ['tuiIconMessageSquare', 'Ghi chú', 'Liên lạc', 'comment note'],
  ['tuiIconBell', 'Thông báo', 'Liên lạc', 'bell alert'],
  ['tuiIconInfo', 'Thông tin', 'Hỗ trợ', 'info details'],
  ['tuiIconHelpCircle', 'Trợ giúp', 'Hỗ trợ', 'help support'],
  ['tuiIconAlertCircle', 'Cảnh báo', 'Hỗ trợ', 'alert warning'],
  ['tuiIconAlertTriangle', 'Rủi ro', 'Hỗ trợ', 'risk caution'],
  ['tuiIconStar', 'Đánh dấu sao', 'Hỗ trợ', 'favorite star'],
  ['tuiIconHeart', 'Quan tâm', 'Hỗ trợ', 'heart care'],
  ['tuiIconLink', 'Liên kết', 'Thao tác', 'link attach'],
  ['tuiIconLink2', 'Ghép liên kết', 'Thao tác', 'merge link'],
  ['tuiIconExternalLink', 'Mở liên kết ngoài', 'Thao tác', 'external open new'],
  ['tuiIconShare', 'Chia sẻ', 'Thao tác', 'share distribute'],
  ['tuiIconShare2', 'Chuyển tiếp', 'Thao tác', 'forward share'],
  ['tuiIconPaperclip', 'Đính kèm', 'Tài liệu', 'attachment file'],
  ['tuiIconPrinter', 'In phiếu', 'Tài liệu', 'print paper'],
  ['tuiIconMonitor', 'Màn hình', 'Thiết bị', 'desktop monitor'],
  ['tuiIconSmartphone', 'Di động', 'Thiết bị', 'mobile phone'],
  ['tuiIconTv', 'Màn hình lớn', 'Thiết bị', 'display tv'],
  ['tuiIconPackage', 'Gói dữ liệu', 'Dữ liệu', 'package bundle'],
  ['tuiIconHardDrive', 'Lưu trữ', 'Dữ liệu', 'drive disk storage'],
  ['tuiIconArchive', 'Lưu kho', 'Dữ liệu', 'archive store'],
  ['tuiIconCoffee', 'Chờ xử lý', 'Hỗ trợ', 'pause pending'],
  ['tuiIconZap', 'Xử lý nhanh', 'Thao tác', 'fast quick'],
  ['tuiIconCheckSquare', 'Danh sách duyệt', 'Phê duyệt', 'checklist approve'],
];

const TEMPLATE_BUTTON_ICON_OPTIONS: ReadonlyArray<TemplateButtonIconOption> =
  RAW_TEMPLATE_BUTTON_ICON_OPTIONS.map(([icon, label, category, keywords]) => ({
    icon,
    label,
    category,
    searchText: `${icon} ${label} ${category} ${keywords}`.toLowerCase(),
  }));

@Component({
  selector: 'app-template-button-manager-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiButtonModule,
    TuiDropdownModule,
    TuiHostedDropdownModule,
    TuiSvgModule,
    TuiInputModule,
    TuiInputNumberModule,
    TuiTextfieldControllerModule,
    AppDialogDirective,
    SingleSelectComponent,
    MultiSelectComponent,
  ],
  templateUrl: './template-button-manager-dialog.component.html',
  styleUrl: './template-button-manager-dialog.component.scss',
})
export class TemplateButtonManagerDialogComponent implements OnChanges {
  @Input() isOpen = false;
  @Output() isOpenChange = new EventEmitter<boolean>();

  @Input() templateId: number | null = null;

  buttons: TemplateButtonItem[] = [];
  loading = false;
  saving = false;
  readonly iconOptions = TEMPLATE_BUTTON_ICON_OPTIONS;
  iconSearch = '';

  /** Tất cả entry status mà nút có thể dựa vào để ẩn/disable. */
  readonly statusSelectOptions: SelectOption<string>[] = [
    { value: 'DRAFT',       label: 'DRAFT — Nháp' },
    { value: 'SUBMITTED',   label: 'SUBMITTED — Đã gửi duyệt' },
    { value: 'APPROVED',    label: 'APPROVED — Đã duyệt' },
    { value: 'REJECTED',    label: 'REJECTED — Từ chối' },
    { value: 'RETURNED',    label: 'RETURNED — Trả lại' },
    { value: 'DISTRIBUTED', label: 'DISTRIBUTED — Đã giao' },
  ];

  /** Options cho `<app-single-select>` "Logic xử lý" — sync khi `actionHandlers` load. */
  actionHandlerSelectOptions: SelectOption<string>[] = [];

  /** Options cho `<app-single-select>` "Target điều hướng". */
  readonly navigationTargetOptions: SelectOption<string>[] = [
    { value: '_self', label: '_self — Cùng tab' },
    { value: '_blank', label: '_blank — Tab mới' },
  ];

  private _iconDropdownOpen = false;
  get iconDropdownOpen(): boolean {
    return this._iconDropdownOpen;
  }
  set iconDropdownOpen(value: boolean) {
    this._iconDropdownOpen = value;
    if (!value) {
      this.iconSearch = '';
    }
  }

  form: {
    buttonKey: string;
    buttonLabel: string;
    buttonIcon: string;
    sortOrder: number;
    actionHandlerKey: string;
    visibleStatuses: string[];
    disabledStatuses: string[];
    navigationUrl: string;
    navigationTarget: string;
  } = {
    buttonKey: '',
    buttonLabel: '',
    buttonIcon: '',
    sortOrder: 0,
    actionHandlerKey: '',
    visibleStatuses: [],
    disabledStatuses: [],
    navigationUrl: '',
    navigationTarget: '_self',
  };

  /** Danh sách handler đã đăng ký trên backend */
  actionHandlers: ActionHandlerInfo[] = [];
  handlersLoaded = false;

  /** Frontend duplicate key check message */
  keyError = '';

  // ── Edit mode ──────────────────────────────────────────
  editForm: {
    buttonLabel: string;
    buttonIcon: string;
    sortOrder: number;
    actionHandlerKey: string;
    visibleStatuses: string[];
    disabledStatuses: string[];
    navigationUrl: string;
    navigationTarget: string;
  } = {
    buttonLabel: '',
    buttonIcon: '',
    sortOrder: 0,
    actionHandlerKey: '',
    visibleStatuses: [],
    disabledStatuses: [],
    navigationUrl: '',
    navigationTarget: '_self',
  };
  editIconSearch = '';
  private _editIconDropdownOpen = false;
  get editIconDropdownOpen(): boolean { return this._editIconDropdownOpen; }
  set editIconDropdownOpen(value: boolean) {
    this._editIconDropdownOpen = value;
    if (!value) this.editIconSearch = '';
  }
  savingEdit = false;

  // ── Permission management ──────────────────────────────
  private readonly accessService = inject(TemplateAccessService);
  private readonly deptTypeService = inject(DeptTypeService);
  private readonly positionService = inject(PositionService);

  selectedButton: TemplateButtonItem | null = null;
  permissions: TemplateAccessItem[] = [];
  loadingPermissions = false;
  savingPermission = false;
  showPermForm = false;

  allDepts: DeptTypeItem[] = [];
  allPositions: PositionItem[] = [];
  lookupsLoaded = false;

  permForm = {
    orgGroupCode: '' as '' | 'EVNNPC' | 'PC_COMPANY',
  };

  readonly orgGroupOptions = [
    { value: '' as const, label: 'Tất cả tổ chức', hint: 'Mọi đơn vị / chức danh đều được phép' },
    { value: 'EVNNPC' as const, label: 'EVNNPC (Tổng công ty)', hint: 'Chỉ cán bộ thuộc cơ quan Tổng công ty' },
    { value: 'PC_COMPANY' as const, label: 'Công ty Điện lực', hint: 'Cán bộ các Công ty Điện lực' },
  ];

  topLevelPositions = new Set<string>();
  deptRules = new Map<string, Set<string>>();

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly buttonService: TemplateButtonService,
    private readonly dialog: AppDialogService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen && this.templateId) {
      this.loadButtons();
      this.resetForm();
      this.deselectButton();
      this.loadActionHandlers();
    }
  }

  private loadActionHandlers(): void {
    if (this.handlersLoaded) return;
    this.buttonService.getActionHandlers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: list => {
          this.actionHandlers = list;
          this.actionHandlerSelectOptions = list.map(h => ({ value: h.key, label: h.label }));
          this.handlersLoaded = true;
        },
        error: () => { /* silent */ },
      });
  }

  // ── Status CSV ↔ array boundary (DB lưu CSV, UI dùng string[]) ─────────
  private parseStatusCsv(csv: string | null | undefined): string[] {
    if (!csv) return [];
    return csv.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  }
  private toStatusCsv(arr: string[]): string | null {
    const cleaned = [...new Set(arr.map(s => s.trim().toUpperCase()).filter(Boolean))];
    return cleaned.length ? cleaned.join(',') : null;
  }

  // ── Button CRUD ────────────────────────────────────────

  loadButtons(): void {
    if (!this.templateId) return;
    this.loading = true;
    this.buttonService.getByTemplateId(this.templateId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: data => {
          this.buttons = data.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          this.loading = false;
        },
        error: () => {
          this.dialog.error('Không thể tải danh sách nút');
          this.loading = false;
        },
      });
  }

  canAdd(): boolean {
    return !!this.form.buttonKey.trim() && !!this.form.buttonLabel.trim() && !this.keyError;
  }

  onKeyInput(): void {
    const key = this.form.buttonKey.trim().toUpperCase();
    if (!key) { this.keyError = ''; return; }
    const exists = this.buttons.some(b => b.buttonKey.toUpperCase() === key);
    this.keyError = exists ? `Key "${key}" đã tồn tại` : '';
  }

  get selectedIconOption(): TemplateButtonIconOption | null {
    return this.iconOptions.find(o => o.icon === this.form.buttonIcon) ?? null;
  }

  get filteredIconOptions(): readonly TemplateButtonIconOption[] {
    const q = this.iconSearch.trim().toLowerCase();
    return q ? this.iconOptions.filter(o => o.searchText.includes(q)) : this.iconOptions;
  }

  get editSelectedIconOption(): TemplateButtonIconOption | null {
    return this.iconOptions.find(o => o.icon === this.editForm.buttonIcon) ?? null;
  }

  get editFilteredIconOptions(): readonly TemplateButtonIconOption[] {
    const q = this.editIconSearch.trim().toLowerCase();
    return q ? this.iconOptions.filter(o => o.searchText.includes(q)) : this.iconOptions;
  }

  addButton(): void {
    if (!this.canAdd() || !this.templateId) return;
    const req: CreateTemplateButtonRequest = {
      templateId: this.templateId,
      buttonKey: this.form.buttonKey.trim().toUpperCase(),
      buttonLabel: this.form.buttonLabel.trim(),
      buttonIcon: this.form.buttonIcon.trim() || undefined,
      sortOrder: this.form.sortOrder ?? 0,
      actionHandlerKey: this.form.actionHandlerKey || null,
      visibleStatuses: this.toStatusCsv(this.form.visibleStatuses),
      disabledStatuses: this.toStatusCsv(this.form.disabledStatuses),
      navigationUrl: this.form.navigationUrl.trim() || null,
      navigationTarget: this.form.navigationUrl.trim() ? (this.form.navigationTarget === '_blank' ? '_blank' : '_self') : null,
    };
    this.saving = true;
    this.buttonService.create(req)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: created => {
          this.buttons = [...this.buttons, created].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          this.resetForm();
          this.saving = false;
          this.dialog.success('Đã thêm nút chức năng');
        },
        error: err => {
          this.dialog.error(err.error?.message || 'Lỗi thêm nút');
          this.saving = false;
        },
      });
  }

  isSaveButton(btn: TemplateButtonItem): boolean {
    return btn.buttonKey?.toUpperCase() === 'SAVE';
  }

  deleteButton(btn: TemplateButtonItem): void {
    this.dialog.confirm({
      title: 'Xác nhận xóa',
      message: `Xóa nút "${btn.buttonLabel}" (${btn.buttonKey})?`,
      status: 'warning',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.buttonService.delete(btn.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.buttons = this.buttons.filter(b => b.id !== btn.id);
            if (this.selectedButton?.id === btn.id) {
              this.deselectButton();
            }
            this.dialog.success('Đã xóa nút');
          },
          error: (err) => this.dialog.error(err.error?.message || 'Lỗi xóa nút'),
        });
    });
  }

  // ── Icon selection (shared) ────────────────────────────

  selectButtonIcon(option: TemplateButtonIconOption): void {
    this.form.buttonIcon = option.icon;
    this.iconDropdownOpen = false;
  }

  clearButtonIcon(): void {
    this.form.buttonIcon = '';
    this.iconDropdownOpen = false;
  }

  selectEditIcon(option: TemplateButtonIconOption): void {
    this.editForm.buttonIcon = option.icon;
    this.editIconDropdownOpen = false;
  }

  clearEditIcon(): void {
    this.editForm.buttonIcon = '';
    this.editIconDropdownOpen = false;
  }

  getHandlerDescription(key: string): string {
    return this.actionHandlers.find(h => h.key === key)?.description || '';
  }

  /** Hint mô tả hành vi tổng thể dựa trên cặp (handlerKey, navigationUrl). */
  getBehaviorHint(handlerKey: string, navUrl: string): string {
    const hasHandler = !!handlerKey;
    const hasNav = !!navUrl.trim();
    if (hasHandler && hasNav) return 'Gọi BE handler → nếu success sẽ điều hướng tới URL bên dưới.';
    if (hasHandler && !hasNav) return 'Chỉ gọi BE handler, không điều hướng.';
    if (!hasHandler && hasNav) return 'Chỉ điều hướng, không gọi BE. Không hỗ trợ placeholder {$data.xxx} (vì không có response).';
    return 'Chưa cấu hình logic — nút sẽ không có hành vi gì khi nhấn.';
  }

  getIconLabel(icon: string | undefined): string {
    if (!icon) return '';
    return this.iconOptions.find(o => o.icon === icon)?.label ?? icon;
  }

  trackByIcon(_: number, option: TemplateButtonIconOption): string {
    return option.icon;
  }

  // ── Edit button ────────────────────────────────────────

  selectButton(btn: TemplateButtonItem): void {
    if (this.selectedButton?.id === btn.id) return;
    this.selectedButton = btn;
    this.editForm = {
      buttonLabel: btn.buttonLabel,
      buttonIcon: btn.buttonIcon || '',
      sortOrder: btn.sortOrder ?? 0,
      actionHandlerKey: btn.actionHandlerKey || '',
      visibleStatuses: this.parseStatusCsv(btn.visibleStatuses),
      disabledStatuses: this.parseStatusCsv(btn.disabledStatuses),
      navigationUrl: btn.navigationUrl || '',
      navigationTarget: btn.navigationTarget || '_self',
    };
    this.showPermForm = false;
    this.resetPermForm();
    this.loadPermissions();
    this.ensureLookups();
  }

  deselectButton(): void {
    this.selectedButton = null;
    this.permissions = [];
    this.showPermForm = false;
  }

  get editDirty(): boolean {
    if (!this.selectedButton) return false;
    return this.editForm.buttonLabel !== this.selectedButton.buttonLabel
      || (this.editForm.buttonIcon || '') !== (this.selectedButton.buttonIcon || '')
      || (this.editForm.sortOrder ?? 0) !== (this.selectedButton.sortOrder ?? 0)
      || (this.editForm.actionHandlerKey || '') !== (this.selectedButton.actionHandlerKey || '')
      || (this.toStatusCsv(this.editForm.visibleStatuses) ?? '') !== (this.selectedButton.visibleStatuses || '')
      || (this.toStatusCsv(this.editForm.disabledStatuses) ?? '') !== (this.selectedButton.disabledStatuses || '')
      || (this.editForm.navigationUrl.trim()) !== (this.selectedButton.navigationUrl || '')
      || (this.editForm.navigationUrl.trim() ? this.editForm.navigationTarget : '') !== (this.selectedButton.navigationTarget || '');
  }

  canSaveEdit(): boolean {
    return this.editDirty && !!this.editForm.buttonLabel.trim();
  }

  saveEdit(): void {
    if (!this.canSaveEdit() || !this.selectedButton) return;
    const req: UpdateTemplateButtonRequest = {
      buttonLabel: this.editForm.buttonLabel.trim(),
      buttonIcon: this.editForm.buttonIcon.trim() || undefined,
      sortOrder: this.editForm.sortOrder ?? 0,
      actionHandlerKey: this.editForm.actionHandlerKey || null,
      visibleStatuses: this.toStatusCsv(this.editForm.visibleStatuses),
      disabledStatuses: this.toStatusCsv(this.editForm.disabledStatuses),
      navigationUrl: this.editForm.navigationUrl.trim() || null,
      navigationTarget: this.editForm.navigationUrl.trim() ? (this.editForm.navigationTarget === '_blank' ? '_blank' : '_self') : null,
    };
    this.savingEdit = true;
    this.buttonService.update(this.selectedButton.id, req)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: updated => {
          const idx = this.buttons.findIndex(b => b.id === updated.id);
          if (idx >= 0) {
            this.buttons[idx] = { ...this.buttons[idx], ...updated };
            this.buttons = [...this.buttons].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          }
          this.selectedButton = { ...this.selectedButton!, ...updated };
          this.savingEdit = false;
          this.dialog.success('Đã cập nhật nút');
        },
        error: (err) => {
          this.dialog.error(err.error?.message || 'Lỗi cập nhật');
          this.savingEdit = false;
        },
      });
  }

  // ── Permission management ──────────────────────────────

  private loadPermissions(): void {
    if (!this.templateId || !this.selectedButton) return;
    this.loadingPermissions = true;
    this.accessService.getByTemplateId(this.templateId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: data => {
          this.permissions = data.filter(p => p.actionKey === this.selectedButton!.buttonKey);
          this.loadingPermissions = false;
        },
        error: () => {
          this.dialog.error('Không thể tải danh sách phân quyền');
          this.loadingPermissions = false;
        },
      });
  }

  private ensureLookups(): void {
    if (this.lookupsLoaded) return;
    this.deptTypeService.getAllActive().subscribe(d => this.allDepts = d);
    this.positionService.getAllActive().subscribe(p => this.allPositions = p);
    this.lookupsLoaded = true;
  }

  deletePermission(perm: TemplateAccessItem): void {
    this.dialog.confirm({
      title: 'Xóa phân quyền',
      message: `Xóa rule: ${this.formatPermission(perm)}?`,
      status: 'warning',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.accessService.delete(perm.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.permissions = this.permissions.filter(p => p.id !== perm.id);
            this.dialog.success('Đã xóa rule phân quyền');
          },
          error: () => this.dialog.error('Lỗi xóa rule phân quyền'),
        });
    });
  }

  formatPermission(perm: TemplateAccessItem): string {
    const org = perm.subjectOrgCode || 'Tất cả';
    const pos = perm.subjectPositionCode || 'Tất cả';
    return `${org} / ${pos}`;
  }

  getOrgLabel(code: string | null): string {
    if (!code) return 'Tất cả đơn vị';
    const dept = this.allDepts.find(d => d.deptTypeCode === code);
    return dept ? dept.deptTypeName : code;
  }

  getPositionLabel(code: string | null): string {
    if (!code) return 'Tất cả chức danh';
    const pos = this.allPositions.find(p => p.positionCode === code);
    return pos ? pos.positionName : code;
  }

  // ── Permission add form ────────────────────────────────

  togglePermForm(): void {
    this.showPermForm = !this.showPermForm;
    if (this.showPermForm) this.resetPermForm();
  }

  onOrgGroupChange(): void {
    this.topLevelPositions.clear();
    this.deptRules.clear();
  }

  get isPermissionEnabled(): boolean {
    return this.permForm.orgGroupCode === 'EVNNPC' || this.permForm.orgGroupCode === 'PC_COMPANY';
  }

  get topLevelSectionTitle(): string {
    return this.permForm.orgGroupCode === 'EVNNPC' ? 'Lãnh đạo Tổng công ty' : 'Lãnh đạo Công ty Điện lực';
  }

  get deptSectionLabel(): string {
    return this.permForm.orgGroupCode === 'EVNNPC' ? 'Ban' : 'Phòng';
  }

  get visibleDepts(): DeptTypeItem[] {
    const scope = this.permForm.orgGroupCode === 'EVNNPC' ? 'HQ_DEPT' : 'PC_DEPT';
    return this.allDepts.filter(d => d.orgLevelScope === scope).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  get topLevelPositionOptions(): PositionItem[] {
    return this.allPositions.filter(p => p.orgLevelScope === this.permForm.orgGroupCode).sort((a, b) => a.positionRank - b.positionRank);
  }

  positionsForDept(deptCode: string): PositionItem[] {
    const dept = this.allDepts.find(d => d.deptTypeCode === deptCode);
    if (!dept) return [];
    return this.allPositions.filter(p => p.orgLevelScope === dept.orgLevelScope).sort((a, b) => a.positionRank - b.positionRank);
  }

  isTopLevelSelected(code: string): boolean { return this.topLevelPositions.has(code); }
  toggleTopLevelPosition(code: string): void {
    this.topLevelPositions.has(code) ? this.topLevelPositions.delete(code) : this.topLevelPositions.add(code);
  }
  selectAllTopLevel(): void { for (const p of this.topLevelPositionOptions) this.topLevelPositions.add(p.positionCode); }
  clearTopLevel(): void { this.topLevelPositions.clear(); }

  isDeptSelected(code: string): boolean { return this.deptRules.has(code); }
  toggleDept(code: string): void { this.deptRules.has(code) ? this.deptRules.delete(code) : this.deptRules.set(code, new Set()); }
  isPositionSelected(deptCode: string, posCode: string): boolean { return this.deptRules.get(deptCode)?.has(posCode) ?? false; }
  togglePosition(deptCode: string, posCode: string): void {
    const set = this.deptRules.get(deptCode);
    if (!set) return;
    set.has(posCode) ? set.delete(posCode) : set.add(posCode);
  }
  positionsCountForDept(deptCode: string): number { return this.deptRules.get(deptCode)?.size ?? 0; }
  selectAllVisibleDepts(): void { for (const d of this.visibleDepts) if (!this.deptRules.has(d.deptTypeCode)) this.deptRules.set(d.deptTypeCode, new Set()); }
  clearAllDeptRules(): void { this.deptRules.clear(); }

  get permRuleCount(): number {
    if (!this.permForm.orgGroupCode) return 1;
    let n = this.topLevelPositions.size;
    for (const [, pos] of this.deptRules) n += pos.size === 0 ? 1 : pos.size;
    return n;
  }

  canSubmitPerm(): boolean {
    if (!this.permForm.orgGroupCode) return true;
    return this.topLevelPositions.size > 0 || this.deptRules.size > 0;
  }

  submitPermissions(): void {
    if (!this.canSubmitPerm() || !this.templateId || !this.selectedButton) return;
    const rules = this.buildPermRules();
    if (rules.length === 0) return;

    this.savingPermission = true;
    forkJoin(rules.map(r => this.accessService.create(r))).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.dialog.success(`Đã thêm ${rules.length} rule phân quyền`);
        this.showPermForm = false;
        this.resetPermForm();
        this.loadPermissions();
        this.savingPermission = false;
      },
      error: (err) => {
        this.dialog.error(err.error?.message || 'Lỗi thêm phân quyền');
        this.savingPermission = false;
      },
    });
  }

  private buildPermRules(): CreateTemplateAccessRequest[] {
    const templateId = this.templateId!;
    const actionKey = this.selectedButton!.buttonKey;
    if (!this.permForm.orgGroupCode) {
      return [{ templateId, actionKey, subjectOrgCode: null, subjectPositionCode: null }];
    }
    const out: CreateTemplateAccessRequest[] = [];
    for (const posCode of this.topLevelPositions) {
      out.push({ templateId, actionKey, subjectOrgCode: null, subjectPositionCode: posCode });
    }
    for (const [deptCode, positions] of this.deptRules) {
      if (positions.size === 0) {
        out.push({ templateId, actionKey, subjectOrgCode: deptCode, subjectPositionCode: null });
      } else {
        for (const posCode of positions) out.push({ templateId, actionKey, subjectOrgCode: deptCode, subjectPositionCode: posCode });
      }
    }
    return out;
  }

  private resetPermForm(): void {
    this.permForm = { orgGroupCode: '' };
    this.topLevelPositions.clear();
    this.deptRules.clear();
  }

  trackByDept(_: number, d: DeptTypeItem): string { return d.deptTypeCode; }
  trackByPosition(_: number, p: PositionItem): string { return p.positionCode; }
  trackByPerm(_: number, p: TemplateAccessItem): number { return p.id; }

  // ── Dialog lifecycle ───────────────────────────────────

  onClose(): void {
    this.isOpen = false;
    this.isOpenChange.emit(false);
    this.destroy$.next();
  }

  private resetForm(): void {
    this.iconDropdownOpen = false;
    this.keyError = '';
    this.form = { buttonKey: '', buttonLabel: '', buttonIcon: '', sortOrder: 0, actionHandlerKey: '', visibleStatuses: [], disabledStatuses: [], navigationUrl: '', navigationTarget: '_self' };
  }
}
