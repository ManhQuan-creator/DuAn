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
import { TuiButtonModule, TuiSvgModule } from '@taiga-ui/core';
import { Subject, takeUntil } from 'rxjs';
import { AppDialogDirective } from '../../shared/components/app-dialog.directive';
import { AppDialogService } from '../../shared/dialog.service';
import { DeptTypeItem, DeptTypeService } from '../../shared/dept-type.service';
import {
  PositionItem,
  PositionService,
} from '../../position-management/position.service';
import {
  CreateUserRequest,
  UpdateUserRequest,
} from '../models/app-user.model';
import { PcCompanyOption, UserItem, UserService } from '../service/user.service';

export type UserFormMode = 'create' | 'edit';

export interface UserFormResult {
  mode: UserFormMode;
  payload: CreateUserRequest | UpdateUserRequest;
}

interface OrgGroupOption {
  readonly value: '' | 'EVNNPC' | 'PC_COMPANY';
  readonly label: string;
  readonly hint: string;
}

const ORG_GROUP_OPTIONS: ReadonlyArray<OrgGroupOption> = [
  { value: 'EVNNPC', label: 'EVNNPC (Tổng công ty)', hint: 'HĐTV / TGĐ / PTGĐ + cán bộ Ban' },
  { value: 'PC_COMPANY', label: 'PC_COMPANY (Công ty Điện lực)', hint: 'GĐ / PGĐ + cán bộ Phòng' },
];

interface RoleOption {
  readonly value: string;
  readonly label: string;
}

const ROLE_OPTIONS: ReadonlyArray<RoleOption> = [
  { value: 'ADMIN', label: 'ADMIN — Quản trị viên' },
  { value: 'EDITOR', label: 'EDITOR — Biên tập viên' },
  { value: 'VIEWER', label: 'VIEWER — Người xem' },
];

@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiButtonModule,
    TuiSvgModule,
    AppDialogDirective,
  ],
  templateUrl: './user-form-dialog.component.html',
  styleUrls: ['./user-form-dialog.component.scss'],
})
export class UserFormDialogComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Output() isOpenChange = new EventEmitter<boolean>();

  @Input() mode: UserFormMode = 'create';
  @Input() editingUser: UserItem | null = null;

  @Output() saved = new EventEmitter<UserFormResult>();

  private readonly deptTypeService = inject(DeptTypeService);
  private readonly positionService = inject(PositionService);
  private readonly userService = inject(UserService);
  private readonly dialog = inject(AppDialogService);
  private readonly destroy$ = new Subject<void>();

  readonly orgGroupOptions = ORG_GROUP_OPTIONS;
  readonly roleOptions = ROLE_OPTIONS;

  // Lookups
  pcCompanies: PcCompanyOption[] = [];
  deptTypes: DeptTypeItem[] = [];
  positions: PositionItem[] = [];
  loadingLookup = false;

  // Form state
  form = {
    username: '',
    password: '',
    fullName: '',
    email: '',
    phone: '',
    orgGroupCode: '' as '' | 'EVNNPC' | 'PC_COMPANY',
    companyCode: '',
    /** TOP = lãnh đạo cấp cao (không thuộc Ban/Phòng); DEPT = thuộc 1 Ban/Phòng */
    employeeKind: '' as '' | 'TOP' | 'DEPT',
    deptCode: '',
    positionCode: '',
    roleCode: 'VIEWER',
  };

  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.resetForm();
      this.applyEditingUser();
      if (this.deptTypes.length === 0 || this.positions.length === 0 || this.pcCompanies.length === 0) {
        this.loadLookups();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===== Computed visibility flags (hierarchical reveal) =====

  get dialogTitle(): string {
    return this.mode === 'edit'
      ? `Sửa người dùng "${this.editingUser?.username ?? ''}"`
      : 'Thêm người dùng mới';
  }

  /** Bước 1: đã chọn nhóm tổ chức? */
  get hasOrgGroup(): boolean {
    return !!this.form.orgGroupCode;
  }

  /** Bước 1.5: nếu PC_COMPANY thì cần chọn công ty trước. */
  get needsCompany(): boolean {
    return this.form.orgGroupCode === 'PC_COMPANY';
  }

  /** Bước 1.5 OK: company đã chọn (chỉ check khi cần). */
  get hasCompanyIfNeeded(): boolean {
    return !this.needsCompany || !!this.form.companyCode;
  }

  /** Bước 2: hiện radio loại nhân sự. */
  get showEmployeeKind(): boolean {
    return this.hasOrgGroup && this.hasCompanyIfNeeded;
  }

  /** Bước 3a: đã chọn loại nhân sự = lãnh đạo cấp cao */
  get isTopLevel(): boolean {
    return this.showEmployeeKind && this.form.employeeKind === 'TOP';
  }

  /** Bước 3b: đã chọn loại nhân sự = thuộc dept */
  get isDeptLevel(): boolean {
    return this.showEmployeeKind && this.form.employeeKind === 'DEPT';
  }

  /** Bước 4: cần chọn dept (chỉ hiện khi đã chọn loại = DEPT) */
  get showDeptPicker(): boolean {
    return this.isDeptLevel;
  }

  /** Bước 5: chọn position
   *  - TOP: hiện ngay (sau khi chọn loại)
   *  - DEPT: chỉ hiện sau khi chọn dept
   */
  get showPositionPicker(): boolean {
    if (this.isTopLevel) return true;
    if (this.isDeptLevel) return !!this.form.deptCode;
    return false;
  }

  // ===== Filtered options =====

  get topLevelLabel(): string {
    return this.form.orgGroupCode === 'EVNNPC'
      ? 'Lãnh đạo cấp Tổng công ty (HĐTV / TGĐ / PTGĐ)'
      : 'Lãnh đạo Công ty Điện lực (GĐ / PGĐ)';
  }

  get deptLevelLabel(): string {
    return this.form.orgGroupCode === 'EVNNPC' ? 'Cán bộ Ban thuộc TCT' : 'Cán bộ Phòng thuộc Công ty';
  }

  get deptPickerLabel(): string {
    return this.form.orgGroupCode === 'EVNNPC' ? 'Ban' : 'Phòng';
  }

  /** Danh sách dept hiển thị theo orgGroup. */
  get availableDepts(): DeptTypeItem[] {
    if (this.form.orgGroupCode === 'EVNNPC') {
      return this.deptTypes.filter((d) => d.orgLevelScope === 'HQ_DEPT');
    }
    if (this.form.orgGroupCode === 'PC_COMPANY') {
      return this.deptTypes.filter((d) => d.orgLevelScope === 'PC_DEPT');
    }
    return [];
  }

  /**
   * Danh sách position hiển thị theo bước hiện tại:
   *  - TOP + EVNNPC → HDTV/TGD/PTGD (scope EVNNPC)
   *  - TOP + PC_COMPANY → GD/PGD (scope PC_COMPANY)
   *  - DEPT + EVNNPC + dept đã chọn → TRUONG_BAN/PHO_BAN/CHUYEN_VIEN_BAN (scope HQ_DEPT)
   *  - DEPT + PC_COMPANY + dept đã chọn → TRUONG_PHONG/PHO_PHONG/CHUYEN_VIEN_PHONG (scope PC_DEPT)
   */
  get availablePositions(): PositionItem[] {
    let targetScope: string | null = null;
    if (this.isTopLevel) {
      targetScope = this.form.orgGroupCode === 'EVNNPC' ? 'EVNNPC' : 'PC_COMPANY';
    } else if (this.isDeptLevel && this.form.deptCode) {
      targetScope = this.form.orgGroupCode === 'EVNNPC' ? 'HQ_DEPT' : 'PC_DEPT';
    }
    if (!targetScope) return [];
    return this.positions
      .filter((p) => p.orgLevelScope === targetScope)
      .sort((a, b) => (a.positionRank ?? 0) - (b.positionRank ?? 0));
  }

  // ===== Lookup loading =====

  private loadLookups(): void {
    this.loadingLookup = true;
    this.userService
      .getPcCompanies()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => (this.pcCompanies = data),
        error: () => this.dialog.error('Không tải được danh sách công ty điện lực'),
      });
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

  // ===== Cascade reset on parent changes =====

  /** Khi đổi nhóm tổ chức, reset toàn bộ các bước phụ thuộc. */
  onOrgGroupChange(): void {
    this.form.companyCode = '';
    this.form.employeeKind = '';
    this.form.deptCode = '';
    this.form.positionCode = '';
  }

  /** Khi đổi công ty (PC), reset employee kind + dept + position. */
  onCompanyChange(): void {
    this.form.employeeKind = '';
    this.form.deptCode = '';
    this.form.positionCode = '';
  }

  /** Khi đổi loại nhân sự, reset dept + position. */
  onEmployeeKindChange(): void {
    this.form.deptCode = '';
    this.form.positionCode = '';
  }

  /** Khi đổi dept, reset position. */
  onDeptChange(): void {
    this.form.positionCode = '';
  }

  // ===== Save =====

  canSave(): boolean {
    if (!this.form.fullName.trim()) return false;
    if (this.mode === 'create') {
      if (!this.form.username.trim() || !this.form.password.trim()) return false;
    }
    if (!this.form.orgGroupCode) return false;
    if (this.needsCompany && !this.form.companyCode) return false;
    if (!this.form.employeeKind) return false;
    if (this.isDeptLevel && !this.form.deptCode) return false;
    if (!this.form.positionCode) return false;
    if (!this.form.roleCode) return false;
    return true;
  }

  save(): void {
    if (!this.canSave()) return;

    const deptCode = this.isDeptLevel ? this.form.deptCode : undefined;
    const companyCode = this.form.orgGroupCode === 'PC_COMPANY' ? this.form.companyCode : undefined;

    if (this.mode === 'create') {
      const payload: CreateUserRequest = {
        username: this.form.username.trim(),
        password: this.form.password,
        fullName: this.form.fullName.trim(),
        email: this.form.email.trim(),
        phone: this.form.phone.trim(),
        orgGroupCode: this.form.orgGroupCode,
        companyCode,
        deptCode,
        positionCode: this.form.positionCode,
        roleCodes: [this.form.roleCode],
      };
      this.saved.emit({ mode: 'create', payload });
    } else {
      const payload: UpdateUserRequest = {
        fullName: this.form.fullName.trim() || undefined,
        email: this.form.email.trim() || undefined,
        phone: this.form.phone.trim() || undefined,
        orgGroupCode: this.form.orgGroupCode,
        companyCode,
        deptCode,
        positionCode: this.form.positionCode,
        password: this.form.password.trim() || undefined,
        roleCodes: [this.form.roleCode],
      };
      this.saved.emit({ mode: 'edit', payload });
    }
  }

  onClose(): void {
    this.isOpen = false;
    this.isOpenChange.emit(false);
  }

  trackByCompany(_: number, item: PcCompanyOption): string {
    return item.companyCode;
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
      username: '',
      password: '',
      fullName: '',
      email: '',
      phone: '',
      orgGroupCode: '',
      companyCode: '',
      employeeKind: '',
      deptCode: '',
      positionCode: '',
      roleCode: 'VIEWER',
    };
  }

  /** Khi edit: nạp lại đầy đủ và auto-derive employeeKind từ deptCode. */
  private applyEditingUser(): void {
    if (this.mode !== 'edit' || !this.editingUser) return;
    const u = this.editingUser;
    const og = (u.orgGroupCode || '') as '' | 'EVNNPC' | 'PC_COMPANY';
    this.form = {
      username: u.username || '',
      password: '',
      fullName: u.fullName || '',
      email: u.email || '',
      phone: u.phone || '',
      orgGroupCode: og,
      companyCode: u.companyCode || '',
      employeeKind: u.deptCode ? 'DEPT' : 'TOP',
      deptCode: u.deptCode || '',
      positionCode: u.positionCode || '',
      roleCode: u.roles?.[0] || 'VIEWER',
    };
  }
}
