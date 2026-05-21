import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  TuiButtonModule,
  TuiDataListModule,
  TuiTextfieldControllerModule,
  TuiSvgModule,
} from '@taiga-ui/core';
import {
  TuiInputModule,
  TuiSelectModule,
  TuiDataListWrapperModule,
  TuiBadgeModule,
} from '@taiga-ui/kit';
import { AppDialogDirective } from '../../../shared/components/app-dialog.directive';
import {
  AddPermissionRequest,
  GridPermission,
  GridPermissionRequest,
} from '../../models/grid.permission.model';
import { ColumnConfig } from '../../excel-builder.component';

export type PermLevel = 'COLUMN' | 'ROW' | 'CELL';
export type PermType = 'LOCK' | 'DENY' | 'ALLOW';

/** GridPermission mở rộng với flag nội bộ để phân biệt mới / cũ */
type PermissionEntry = GridPermission & { _isNew: boolean; _uid?: number };

let _uidCounter = 0;

@Component({
  selector: 'app-permission-template-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButtonModule,
    TuiDataListModule,
    TuiTextfieldControllerModule,
    TuiInputModule,
    TuiSelectModule,
    TuiDataListWrapperModule,
    AppDialogDirective,
    TuiBadgeModule,
    TuiSvgModule,
  ],
  templateUrl: './permission-template-dialog.component.html',
  styleUrl: './permission-template-dialog.component.scss',
})
export class PermissionTemplateDialogComponent implements OnChanges {
  // ── Inputs / Outputs ─────────────────────────────────────────────────────

  @Input() isOpen = false;
  @Output() isOpenChange = new EventEmitter<boolean>();

  @Input() title = 'Quản lý quyền';

  @Input() columnConfigs: ColumnConfig[] = [];

  /**
   * Danh sách permission nhận từ cha.
   * Chỉ chứa các permission đã tồn tại (có id từ server).
   */
  @Input() permissions: GridPermission[] = [];
  @Output() permissionsChange = new EventEmitter<GridPermission[]>();

  @Output() handleSavePermission = new EventEmitter<GridPermissionRequest>();
  @Output() handleCancelEvent = new EventEmitter<void>();

  // ── FormControls ─────────────────────────────────────────────────────────

  permLevel = new FormControl<PermLevel>('COLUMN', { nonNullable: true });
  permType = new FormControl<PermType>('LOCK', { nonNullable: true });
  permField = new FormControl<string>('', { nonNullable: true });
  permRowCode = new FormControl<string>('', { nonNullable: true });
  permUserId = new FormControl<string>('', { nonNullable: true });

  // ── State nội bộ ─────────────────────────────────────────────────────────

  /**
   * Danh sách hiển thị — gồm cả permission cũ (từ cha) và permission mới vừa thêm.
   * _isNew = true  → chưa có id, sẽ vào addPermissionRequest khi save
   * _isNew = false → có id từ server
   */
  displayList: PermissionEntry[] = [];

  /** id của các permission cũ đã bị xóa trong phiên này */
  idDeleted: number[] = [];

  // ── Select items ─────────────────────────────────────────────────────────

  readonly levelItems: PermLevel[] = ['COLUMN', 'ROW', 'CELL'];
  readonly typeItems: PermType[] = ['LOCK', 'DENY', 'ALLOW'];
  columnItems: string[] = [];

  // ── Stringify helpers ─────────────────────────────────────────────────────

  readonly stringifyLevel = (value: PermLevel): string =>
    ({ COLUMN: 'Cột', ROW: 'Dòng', CELL: 'Ô' }[value] ?? value);

  readonly stringifyType = (value: PermType): string =>
    ({
      LOCK: 'Khóa (tất cả)',
      DENY: 'Cấm (user cụ thể)',
      ALLOW: 'Cho phép (user cụ thể)',
    }[value] ?? value);

  readonly stringifyField = (value: string): string => {
    if (!value) return '-- Chọn --';
    const col = this.columnConfigs.find((c) => c.field === value);
    return col ? `${col.headerName} (${col.field})` : value;
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['columnConfigs']) {
      this.columnItems = ['', ...this.columnConfigs.map((c) => c.field)];
    }

    if (changes['isOpen'] && this.isOpen) {
      // Mỗi lần mở dialog: khởi tạo lại displayList từ permissions cha truyền vào
      this.initDisplayList();
      this.resetForm();
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Thêm permission mới vào displayList với _isNew = true.
   * Permission này chưa có id — sẽ được gửi lên server khi save.
   */
  addPermission(): void {
    const level = this.permLevel.value;
    const type = this.permType.value;

    const newEntry: PermissionEntry = {
      _isNew: true,
      _uid: ++_uidCounter,
      level,
      permissionType: type,
      targetField:
        level === 'COLUMN' || level === 'CELL'
          ? this.permField.value || undefined
          : undefined,
      targetRowCode:
        level === 'ROW' || level === 'CELL'
          ? this.permRowCode.value || undefined
          : undefined,
      userId: type !== 'LOCK' ? this.permUserId.value || undefined : undefined,
    };

    this.displayList = [...this.displayList, newEntry];
    this.emitPermissionsChange();
    this.resetForm();
  }

  /**
   * Xóa một permission khỏi displayList.
   * - Nếu _isNew → chỉ xóa khỏi list local (chưa tồn tại trên server).
   * - Nếu !_isNew && có id → thêm id vào idDeleted để gửi lên server khi save.
   */
  removePermission(entry: PermissionEntry): void {
    if (!entry._isNew && entry.id != null) {
      this.idDeleted = [...this.idDeleted, entry.id];
    }

    this.displayList = this.displayList.filter((p) =>
      entry._isNew ? p._uid !== entry._uid : p.id !== entry.id
    );

    this.emitPermissionsChange();
  }

  /**
   * Gửi GridPermissionRequest lên component cha.
   * - addPermissionRequest: các permission mới (_isNew = true), đã strip _isNew & _uid
   * - idDeleted: id của các permission cũ đã xóa
   */
  savePermission(): void {
    const addPermissionRequest: AddPermissionRequest[] = this.displayList
      .filter((p) => p._isNew)
      .map(({ _isNew, _uid, ...rest }) => rest as AddPermissionRequest);

    const request: GridPermissionRequest = {
      ...(addPermissionRequest.length ? { addPermissionRequest } : {}),
      ...(this.idDeleted.length ? { idDeleted: this.idDeleted } : {}),
    };

    this.handleSavePermission.emit(request);
    this.resetState();
  }

  onClose(): void {
    this.isOpen = false;
    this.isOpenChange.emit(false);
    this.handleCancelEvent.emit();
  }

  // ── Template helpers ──────────────────────────────────────────────────────

  /** trackBy cho *ngFor — dùng _uid cho item mới, id cho item cũ */
  trackByPermission(_index: number, entry: PermissionEntry): number | string {
    return entry._isNew ? `new_${entry._uid}` : entry.id!;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private initDisplayList(): void {
    this.displayList = this.permissions.map((p) => ({ ...p, _isNew: false }));
    this.idDeleted = [];
  }

  /** Emit danh sách hiển thị hiện tại về cha (chỉ dữ liệu thuần, không có flag nội bộ) */
  private emitPermissionsChange(): void {
    const clean: GridPermission[] = this.displayList.map(
      ({ _isNew, _uid, ...rest }) => rest as GridPermission
    );
    this.permissionsChange.emit(clean);
  }

  private resetForm(): void {
    this.permLevel.setValue('COLUMN');
    this.permType.setValue('LOCK');
    this.permField.setValue('');
    this.permRowCode.setValue('');
    this.permUserId.setValue('');
  }

  private resetState(): void {
    this.idDeleted = [];
    // Sau khi save, coi toàn bộ displayList là "cũ" (cha sẽ trả về permissions mới)
    // Không cần reset displayList ở đây — cha sẽ truyền lại @Input permissions
  }
}