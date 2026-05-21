import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TuiButtonModule,
  TuiHostedDropdownModule,
  TuiSvgModule,
} from '@taiga-ui/core';
import { Subject, takeUntil } from 'rxjs';
import { AppDialogDirective } from '../../shared/components/app-dialog.directive';
import { AppDialogService } from '../../shared/dialog.service';
import { DeptTypeItem, DeptTypeService } from '../../shared/dept-type.service';
import {
  PositionItem,
  PositionService,
} from '../../position-management/position.service';
import {
  CreateSidebarMenuRequest,
  PermissionRule,
  SidebarMenuNode,
  UpdateSidebarMenuRequest,
} from '../../shared/sidebar-menu.service';

interface SidebarMenuIconOption {
  readonly icon: string;
  readonly label: string;
  readonly category: string;
  readonly searchText: string;
}

const RAW_SIDEBAR_MENU_ICON_OPTIONS: ReadonlyArray<
  readonly [icon: string, label: string, category: string, keywords: string]
> = [
  ['tuiIconHomeLarge', 'Trang chủ', 'Điều hướng', 'home dashboard'],
  ['tuiIconLayoutLarge', 'Bố cục', 'Điều hướng', 'layout designer'],
  ['tuiIconGridLarge', 'Lưới', 'Điều hướng', 'grid table'],
  ['tuiIconListLarge', 'Danh sách', 'Điều hướng', 'list rows'],
  ['tuiIconMenuLarge', 'Menu', 'Điều hướng', 'menu nav'],
  ['tuiIconCompassLarge', 'Định hướng', 'Điều hướng', 'compass nav'],
  ['tuiIconMapLarge', 'Sơ đồ', 'Điều hướng', 'map location'],
  ['tuiIconMapPinLarge', 'Điểm địa phương', 'Điều hướng', 'pin location'],
  ['tuiIconGlobeLarge', 'Toàn hệ thống', 'Điều hướng', 'global network'],
  ['tuiIconBookLarge', 'Sổ tay', 'Tài liệu', 'book guide'],
  ['tuiIconBookOpenLarge', 'Tài liệu mở', 'Tài liệu', 'book open'],
  ['tuiIconBookmarkLarge', 'Đánh dấu', 'Tài liệu', 'bookmark mark'],
  ['tuiIconFileLarge', 'Tập tin', 'Tài liệu', 'file document'],
  ['tuiIconFileTextLarge', 'Văn bản', 'Tài liệu', 'document text report'],
  ['tuiIconFilePlusLarge', 'Thêm tài liệu', 'Tài liệu', 'file add'],
  ['tuiIconFileMinusLarge', 'Bỏ tài liệu', 'Tài liệu', 'file remove'],
  ['tuiIconFolderLarge', 'Thư mục', 'Tài liệu', 'folder directory'],
  ['tuiIconFolderPlusLarge', 'Thêm thư mục', 'Tài liệu', 'folder add'],
  ['tuiIconFolderMinusLarge', 'Bỏ thư mục', 'Tài liệu', 'folder remove'],
  ['tuiIconClipboardLarge', 'Phiếu nhập', 'Tài liệu', 'clipboard form'],
  ['tuiIconArchiveLarge', 'Lưu trữ', 'Tài liệu', 'archive store'],
  ['tuiIconPaperclipLarge', 'Đính kèm', 'Tài liệu', 'attachment file'],
  ['tuiIconPrinterLarge', 'In phiếu', 'Tài liệu', 'print paper'],
  ['tuiIconEditLarge', 'Cập nhật nhanh', 'Thao tác', 'edit update'],
  ['tuiIconEdit2Large', 'Chỉnh sửa', 'Thao tác', 'edit modify'],
  ['tuiIconEdit3Large', 'Đánh dấu chỉnh sửa', 'Thao tác', 'edit annotate'],
  ['tuiIconPlusLarge', 'Thêm mới', 'Thao tác', 'add create'],
  ['tuiIconPlusCircleLarge', 'Thêm bản ghi', 'Thao tác', 'add create new'],
  ['tuiIconMinusLarge', 'Giảm trừ', 'Thao tác', 'remove subtract'],
  ['tuiIconTrashLarge', 'Xóa', 'Thao tác', 'delete trash'],
  ['tuiIconTrash2Large', 'Xóa vĩnh viễn', 'Thao tác', 'delete remove'],
  ['tuiIconSaveLarge', 'Lưu dữ liệu', 'Thao tác', 'save store'],
  ['tuiIconCopyLarge', 'Sao chép', 'Thao tác', 'copy duplicate'],
  ['tuiIconRefreshCwLarge', 'Làm mới', 'Thao tác', 'refresh reload'],
  ['tuiIconRefreshCcwLarge', 'Khôi phục', 'Thao tác', 'restore reset'],
  ['tuiIconLinkLarge', 'Liên kết', 'Thao tác', 'link attach'],
  ['tuiIconExternalLinkLarge', 'Mở liên kết ngoài', 'Thao tác', 'external open new'],
  ['tuiIconShareLarge', 'Chia sẻ', 'Thao tác', 'share distribute'],
  ['tuiIconShare2Large', 'Chuyển tiếp', 'Thao tác', 'forward share'],
  ['tuiIconSendLarge', 'Gửi', 'Quy trình', 'send submit'],
  ['tuiIconCheckLarge', 'Xác nhận', 'Phê duyệt', 'confirm done'],
  ['tuiIconCheckCircleLarge', 'Hoàn tất', 'Phê duyệt', 'complete success'],
  ['tuiIconCheckSquareLarge', 'Danh sách duyệt', 'Phê duyệt', 'checklist approve'],
  ['tuiIconXLarge', 'Hủy thao tác', 'Phê duyệt', 'cancel close'],
  ['tuiIconXCircleLarge', 'Từ chối', 'Phê duyệt', 'reject deny'],
  ['tuiIconFlagLarge', 'Đánh dấu ưu tiên', 'Quy trình', 'flag priority'],
  ['tuiIconAwardLarge', 'Vai trò', 'Quy trình', 'award badge'],
  ['tuiIconClockLarge', 'Thời gian', 'Điều hướng', 'clock time'],
  ['tuiIconCalendarLarge', 'Lịch công tác', 'Điều hướng', 'calendar schedule'],
  ['tuiIconUploadLarge', 'Tải lên', 'Dữ liệu', 'upload import'],
  ['tuiIconUploadCloudLarge', 'Đồng bộ lên', 'Dữ liệu', 'sync cloud upload'],
  ['tuiIconDownloadLarge', 'Tải xuống', 'Dữ liệu', 'download export'],
  ['tuiIconDownloadCloudLarge', 'Lấy dữ liệu cloud', 'Dữ liệu', 'cloud download'],
  ['tuiIconDatabaseLarge', 'Cơ sở dữ liệu', 'Dữ liệu', 'database storage'],
  ['tuiIconServerLarge', 'Máy chủ', 'Dữ liệu', 'server backend'],
  ['tuiIconHardDriveLarge', 'Lưu trữ', 'Dữ liệu', 'drive disk storage'],
  ['tuiIconLayersLarge', 'Tổng hợp lớp', 'Dữ liệu', 'layers aggregate'],
  ['tuiIconColumnsLarge', 'Cột dữ liệu', 'Dữ liệu', 'columns'],
  ['tuiIconPackageLarge', 'Gói dữ liệu', 'Dữ liệu', 'package bundle'],
  ['tuiIconBoxLarge', 'Hộp', 'Dữ liệu', 'box package'],
  ['tuiIconTagLarge', 'Nhãn', 'Dữ liệu', 'tag label'],
  ['tuiIconBarChartLarge', 'Báo cáo cột', 'Báo cáo', 'chart report'],
  ['tuiIconBarChart2Large', 'Thống kê cột', 'Báo cáo', 'analytics bar'],
  ['tuiIconPieChartLarge', 'Báo cáo tỉ lệ', 'Báo cáo', 'pie chart'],
  ['tuiIconTrendingUpLarge', 'Tăng trưởng', 'Báo cáo', 'trend up'],
  ['tuiIconTrendingDownLarge', 'Giảm trưởng', 'Báo cáo', 'trend down'],
  ['tuiIconTargetLarge', 'Chỉ tiêu', 'Báo cáo', 'target goal kpi'],
  ['tuiIconActivityLarge', 'Tiến độ xử lý', 'Báo cáo', 'activity progress'],
  ['tuiIconUserLarge', 'Người dùng', 'Nhân sự', 'user profile'],
  ['tuiIconUsersLarge', 'Nhóm người dùng', 'Nhân sự', 'users team'],
  ['tuiIconUserCheckLarge', 'Người duyệt', 'Nhân sự', 'approver reviewer'],
  ['tuiIconUserPlusLarge', 'Thêm người', 'Nhân sự', 'invite add user'],
  ['tuiIconUserMinusLarge', 'Bỏ người', 'Nhân sự', 'remove user'],
  ['tuiIconBriefcaseLarge', 'Đơn vị công tác', 'Nhân sự', 'organization office'],
  ['tuiIconSettingsLarge', 'Cài đặt', 'Quản trị', 'settings config'],
  ['tuiIconSlidersLarge', 'Tùy chỉnh bộ lọc', 'Quản trị', 'adjust sliders'],
  ['tuiIconToolLarge', 'Công cụ', 'Quản trị', 'tool utility'],
  ['tuiIconShieldLarge', 'Bảo mật', 'Quản trị', 'security shield'],
  ['tuiIconShieldOffLarge', 'Bỏ bảo vệ', 'Quản trị', 'disable security'],
  ['tuiIconLockLarge', 'Khóa', 'Quản trị', 'lock protect'],
  ['tuiIconUnlockLarge', 'Mở khóa', 'Quản trị', 'unlock open'],
  ['tuiIconKeyLarge', 'Cấp quyền', 'Quản trị', 'permission access'],
  ['tuiIconBellLarge', 'Thông báo', 'Liên lạc', 'bell alert'],
  ['tuiIconMailLarge', 'Email', 'Liên lạc', 'mail notification'],
  ['tuiIconPhoneLarge', 'Điện thoại', 'Liên lạc', 'phone call'],
  ['tuiIconMessageCircleLarge', 'Trao đổi', 'Liên lạc', 'message chat'],
  ['tuiIconMessageSquareLarge', 'Ghi chú', 'Liên lạc', 'comment note'],
  ['tuiIconInfoLarge', 'Thông tin', 'Hỗ trợ', 'info details'],
  ['tuiIconHelpCircleLarge', 'Trợ giúp', 'Hỗ trợ', 'help support'],
  ['tuiIconAlertCircleLarge', 'Cảnh báo', 'Hỗ trợ', 'alert warning'],
  ['tuiIconAlertTriangleLarge', 'Rủi ro', 'Hỗ trợ', 'risk caution'],
  ['tuiIconStarLarge', 'Đánh dấu sao', 'Hỗ trợ', 'favorite star'],
  ['tuiIconHeartLarge', 'Quan tâm', 'Hỗ trợ', 'heart care'],
  ['tuiIconZapLarge', 'Xử lý nhanh', 'Hỗ trợ', 'fast quick'],
  ['tuiIconCoffeeLarge', 'Chờ xử lý', 'Hỗ trợ', 'pause pending'],
  ['tuiIconSearchLarge', 'Tìm kiếm', 'Tiện ích', 'search find'],
  ['tuiIconFilterLarge', 'Lọc dữ liệu', 'Tiện ích', 'filter sort'],
  ['tuiIconEyeLarge', 'Xem chi tiết', 'Tiện ích', 'view preview'],
  ['tuiIconEyeOffLarge', 'Ẩn thông tin', 'Tiện ích', 'hide private'],
  ['tuiIconMonitorLarge', 'Màn hình', 'Thiết bị', 'desktop monitor'],
  ['tuiIconSmartphoneLarge', 'Di động', 'Thiết bị', 'mobile phone'],
];

const SIDEBAR_MENU_ICON_OPTIONS: ReadonlyArray<SidebarMenuIconOption> =
  RAW_SIDEBAR_MENU_ICON_OPTIONS.map(([icon, label, category, keywords]) => ({
    icon,
    label,
    category,
    searchText: `${icon} ${label} ${category} ${keywords}`.toLowerCase(),
  }));

export interface SidebarMenuFormResult {
  mode: 'create' | 'edit';
  payload: CreateSidebarMenuRequest | UpdateSidebarMenuRequest;
}

interface OrgGroupOption {
  readonly value: '' | 'EVNNPC' | 'PC_COMPANY';
  readonly label: string;
  readonly hint: string;
}

const ORG_GROUP_OPTIONS: ReadonlyArray<OrgGroupOption> = [
  { value: '', label: 'Tất cả nhóm tổ chức', hint: 'Mọi user xem được' },
  { value: 'EVNNPC', label: 'EVNNPC (Tổng công ty)', hint: 'Cán bộ TCT + các Ban' },
  { value: 'PC_COMPANY', label: 'PC_COMPANY (Công ty Điện lực)', hint: 'Cán bộ PC thành viên' },
];

@Component({
  selector: 'app-sidebar-menu-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiButtonModule,
    TuiHostedDropdownModule,
    TuiSvgModule,
    AppDialogDirective,
  ],
  templateUrl: './sidebar-menu-form-dialog.component.html',
  styleUrls: ['./sidebar-menu-form-dialog.component.scss'],
})
export class SidebarMenuFormDialogComponent implements OnChanges, OnInit, OnDestroy {
  @Input() isOpen = false;
  @Output() isOpenChange = new EventEmitter<boolean>();

  @Input() mode: 'create' | 'edit' = 'create';
  @Input() parentId: number | null = null;
  @Input() parentLabel: string | null = null;
  @Input() editingNode: SidebarMenuNode | null = null;

  @Output() saved = new EventEmitter<SidebarMenuFormResult>();

  private readonly deptTypeService = inject(DeptTypeService);
  private readonly positionService = inject(PositionService);
  private readonly dialog = inject(AppDialogService);
  private readonly destroy$ = new Subject<void>();

  readonly iconOptions = SIDEBAR_MENU_ICON_OPTIONS;
  readonly orgGroupOptions = ORG_GROUP_OPTIONS;

  iconSearch = '';
  private _iconDropdownOpen = false;
  get iconDropdownOpen(): boolean {
    return this._iconDropdownOpen;
  }
  set iconDropdownOpen(value: boolean) {
    this._iconDropdownOpen = value;
    if (!value) this.iconSearch = '';
  }

  // Lookup
  deptTypes: DeptTypeItem[] = [];
  positions: PositionItem[] = [];
  loadingLookup = false;

  // Form
  form = {
    label: '',
    menuKey: '',
    path: '',
    icon: '',
    sortOrder: 0,
    active: true,
    orgGroupCode: '' as '' | 'EVNNPC' | 'PC_COMPANY',
  };

  /**
   * Phân quyền per-dept: Map<deptCode, Set<positionCode>>.
   *  - dept có mặt trong Map = được phép xem
   *  - Set rỗng cho 1 dept = mọi chức danh thuộc dept đó
   */
  rules = new Map<string, Set<string>>();

  /**
   * Phân quyền cho lãnh đạo cấp cao (không thuộc Ban/Phòng nào — deptCode null trong AppUser).
   *   EVNNPC: HDTV, TGD, PTGD
   *   PC_COMPANY: GD, PGD
   * Lưu vào permissionRules dưới dạng 1 rule có deptCode = null.
   */
  topLevelPositions = new Set<string>();

  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.resetForm();
      this.applyEditingNode();
      if (this.deptTypes.length === 0 || this.positions.length === 0) {
        this.loadLookups();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===== Computed =====

  get dialogTitle(): string {
    if (this.mode === 'edit') {
      return `Sửa menu "${this.editingNode?.label ?? ''}"`;
    }
    if (this.parentId && this.parentLabel) {
      return `Thêm menu con của "${this.parentLabel}"`;
    }
    return 'Thêm menu cấp gốc';
  }

  get selectedIconOption(): SidebarMenuIconOption | null {
    return this.iconOptions.find((o) => o.icon === this.form.icon) ?? null;
  }

  get filteredIconOptions(): readonly SidebarMenuIconOption[] {
    const q = this.iconSearch.trim().toLowerCase();
    if (!q) return this.iconOptions;
    return this.iconOptions.filter((o) => o.searchText.includes(q));
  }

  get isPermissionEnabled(): boolean {
    return this.form.orgGroupCode === 'EVNNPC' || this.form.orgGroupCode === 'PC_COMPANY';
  }

  /** Danh sách dept hiển thị theo orgGroupCode hiện tại. */
  get visibleDepts(): DeptTypeItem[] {
    if (this.form.orgGroupCode === 'EVNNPC') {
      return this.deptTypes.filter((d) => d.orgLevelScope === 'HQ_DEPT');
    }
    if (this.form.orgGroupCode === 'PC_COMPANY') {
      return this.deptTypes.filter((d) => d.orgLevelScope === 'PC_DEPT');
    }
    return [];
  }

  /**
   * Lãnh đạo cấp cao có thể chọn theo orgGroup hiện tại.
   *   EVNNPC → positions có scope = EVNNPC (HDTV, TGD, PTGD)
   *   PC_COMPANY → positions có scope = PC_COMPANY (GD, PGD)
   */
  get topLevelPositionOptions(): PositionItem[] {
    const targetScope = this.form.orgGroupCode === 'EVNNPC' ? 'EVNNPC' : 'PC_COMPANY';
    return this.positions
      .filter((p) => p.orgLevelScope === targetScope)
      .sort((a, b) => (a.positionRank ?? 0) - (b.positionRank ?? 0));
  }

  /**
   * Position hiển thị cho 1 dept — chỉ những position cùng scope với dept.
   *   HQ_DEPT dept (BAN_*) → chỉ HQ_DEPT positions (TRUONG_BAN/PHO_BAN/CHUYEN_VIEN_BAN)
   *   PC_DEPT dept (PHONG_*) → chỉ PC_DEPT positions (TRUONG_PHONG/PHO_PHONG/CHUYEN_VIEN_PHONG)
   * KHÔNG bao gồm positions cấp cao (HDTV/TGD/PTGD/GD/PGD) vì chúng không thuộc dept.
   */
  positionsForDept(deptCode: string): PositionItem[] {
    const dept = this.deptTypes.find((d) => d.deptTypeCode === deptCode);
    if (!dept) return [];
    return this.positions
      .filter((p) => p.orgLevelScope === dept.orgLevelScope)
      .sort((a, b) => (a.positionRank ?? 0) - (b.positionRank ?? 0));
  }

  get topLevelSectionTitle(): string {
    return this.form.orgGroupCode === 'EVNNPC'
      ? 'Lãnh đạo cấp Tổng công ty (không thuộc Ban)'
      : 'Lãnh đạo cấp Công ty Điện lực (không thuộc Phòng)';
  }

  get permissionSummary(): string {
    if (!this.isPermissionEnabled) return 'Mọi user xem được';
    const totalRules = this.rules.size + (this.topLevelPositions.size > 0 ? 1 : 0);
    if (totalRules === 0) {
      return `Mọi ${this.form.orgGroupCode === 'EVNNPC' ? 'cán bộ TCT' : 'cán bộ PC'}`;
    }
    const parts: string[] = [];
    if (this.topLevelPositions.size > 0) {
      parts.push(`${this.topLevelPositions.size} lãnh đạo`);
    }
    if (this.rules.size > 0) {
      parts.push(`${this.rules.size} ban/phòng`);
    }
    return parts.join(' • ');
  }

  // ===== Lookup loading =====

  private loadLookups(): void {
    this.loadingLookup = true;
    this.deptTypeService
      .getAllActive()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => (this.deptTypes = data),
        error: () => this.dialog.error('Không tải được danh sách loại đơn vị'),
      });
    this.positionService
      .getAllActive()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.positions = data;
          this.loadingLookup = false;
        },
        error: () => {
          this.dialog.error('Không tải được danh sách chức danh');
          this.loadingLookup = false;
        },
      });
  }

  // ===== Form actions =====

  onMenuKeyChange(value: string): void {
    this.form.menuKey = value ?? '';
  }

  selectIcon(option: SidebarMenuIconOption): void {
    this.form.icon = option.icon;
    this.iconDropdownOpen = false;
  }

  clearIcon(): void {
    this.form.icon = '';
    this.iconDropdownOpen = false;
  }

  /** Khi đổi orgGroup, xóa toàn bộ rule + top-level (vì danh sách dept/position thay đổi). */
  onOrgGroupChange(): void {
    this.rules = new Map();
    this.topLevelPositions = new Set();
  }

  // ===== Top-level positions =====

  isTopLevelSelected(positionCode: string): boolean {
    return this.topLevelPositions.has(positionCode);
  }

  toggleTopLevelPosition(positionCode: string): void {
    if (this.topLevelPositions.has(positionCode)) {
      this.topLevelPositions.delete(positionCode);
    } else {
      this.topLevelPositions.add(positionCode);
    }
  }

  selectAllTopLevel(): void {
    for (const p of this.topLevelPositionOptions) {
      this.topLevelPositions.add(p.positionCode);
    }
  }

  clearTopLevel(): void {
    this.topLevelPositions = new Set();
  }

  isDeptSelected(deptCode: string): boolean {
    return this.rules.has(deptCode);
  }

  toggleDept(deptCode: string): void {
    if (this.rules.has(deptCode)) {
      this.rules.delete(deptCode);
    } else {
      this.rules.set(deptCode, new Set());
    }
  }

  isPositionSelected(deptCode: string, positionCode: string): boolean {
    return !!this.rules.get(deptCode)?.has(positionCode);
  }

  togglePosition(deptCode: string, positionCode: string): void {
    let positions = this.rules.get(deptCode);
    if (!positions) {
      positions = new Set();
      this.rules.set(deptCode, positions);
    }
    if (positions.has(positionCode)) positions.delete(positionCode);
    else positions.add(positionCode);
  }

  positionsCountForDept(deptCode: string): number {
    return this.rules.get(deptCode)?.size ?? 0;
  }

  /** Quick: thêm tất cả dept hiện hành (mọi chức danh). */
  selectAllVisibleDepts(): void {
    for (const d of this.visibleDepts) {
      if (!this.rules.has(d.deptTypeCode)) {
        this.rules.set(d.deptTypeCode, new Set());
      }
    }
  }

  clearAllRules(): void {
    this.rules = new Map();
    this.topLevelPositions = new Set();
  }

  canSave(): boolean {
    return !!this.form.label.trim() && !!this.form.menuKey.trim();
  }

  private buildPermissionRules(): PermissionRule[] {
    if (!this.isPermissionEnabled) return [];
    const result: PermissionRule[] = [];
    // Top-level rule (deptCode null) — chỉ thêm khi có ít nhất 1 position
    if (this.topLevelPositions.size > 0) {
      result.push({
        deptCode: null,
        positionCodes: Array.from(this.topLevelPositions),
      });
    }
    for (const [deptCode, positions] of this.rules.entries()) {
      result.push({
        deptCode,
        positionCodes: Array.from(positions),
      });
    }
    return result;
  }

  save(): void {
    if (!this.canSave()) return;
    const orgGroup = this.form.orgGroupCode || null;
    const rules = this.buildPermissionRules();

    if (this.mode === 'create') {
      const payload: CreateSidebarMenuRequest = {
        parentId: this.parentId,
        menuKey: this.form.menuKey.trim(),
        label: this.form.label.trim(),
        path: this.form.path.trim() || null,
        icon: this.form.icon.trim() || null,
        sortOrder: this.form.sortOrder ? Number(this.form.sortOrder) : undefined,
        orgGroupCode: orgGroup,
        permissionRules: rules,
      };
      this.saved.emit({ mode: 'create', payload });
    } else {
      const payload: UpdateSidebarMenuRequest = {
        menuKey: this.form.menuKey.trim(),
        label: this.form.label.trim(),
        path: this.form.path.trim() || null,
        icon: this.form.icon.trim() || null,
        sortOrder: this.form.sortOrder ? Number(this.form.sortOrder) : undefined,
        active: this.form.active,
        orgGroupCode: orgGroup,
        permissionRules: rules,
        updateOrgGroupCode: true,
        updatePermissionRules: true,
      };
      this.saved.emit({ mode: 'edit', payload });
    }
  }

  onClose(): void {
    this.isOpen = false;
    this.isOpenChange.emit(false);
  }

  trackByIcon(_: number, option: SidebarMenuIconOption): string {
    return option.icon;
  }

  trackByDept(_: number, item: DeptTypeItem): string {
    return item.deptTypeCode;
  }

  trackByPosition(_: number, item: PositionItem): string {
    return item.positionCode;
  }

  // ===== Helpers =====

  private resetForm(): void {
    this.form = {
      label: '',
      menuKey: '',
      path: '',
      icon: '',
      sortOrder: 0,
      active: true,
      orgGroupCode: '',
    };
    this.rules = new Map();
    this.topLevelPositions = new Set();
    this.iconDropdownOpen = false;
  }

  private applyEditingNode(): void {
    if (this.mode !== 'edit' || !this.editingNode) return;
    const n = this.editingNode;
    const og = (n.orgGroupCode || '') as '' | 'EVNNPC' | 'PC_COMPANY';
    const menuKey = n.menuKey || '';
    this.form = {
      label: n.label || '',
      menuKey,
      path: n.path || '',
      icon: n.icon || '',
      sortOrder: n.sortOrder ?? 0,
      active: n.active !== false,
      orgGroupCode: og,
    };
    this.rules = new Map();
    this.topLevelPositions = new Set();
    if (n.permissionRules?.length) {
      for (const r of n.permissionRules) {
        const positions = (r.positionCodes ?? []).map((c) => c.toUpperCase());
        if (!r.deptCode) {
          // Top-level rule (lãnh đạo cấp cao)
          for (const p of positions) this.topLevelPositions.add(p);
        } else {
          this.rules.set(r.deptCode.toUpperCase(), new Set(positions));
        }
      }
    }
  }
}
