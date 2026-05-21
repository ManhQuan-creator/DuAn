import { ColumnGroupConfig } from '../../excel-builder.component';

/**
 * Block hiển thị trong preview canvas: hoặc cột standalone, hoặc 1 root group.
 * Discriminated union — không dùng optional fields.
 */
export type PreviewBlock =
  | { kind: 'leaf'; field: string; headerName: string }
  | { kind: 'group'; group: ColumnGroupConfig };

/** Một option trong picker "Chuyển sang nhóm khác". */
export interface MoveTargetOption {
  /** Breadcrumb đầy đủ, vd: "Doanh thu › Q1". */
  label: string;
  /** Path tới target parent. `[]` = root level. */
  path: string[];
  /** True = không cho click (vd target hiện tại). */
  disabled?: boolean;
  /** Hiển thị bên cạnh label, vd "(đang ở đây)". */
  reason?: string;
}

/** Context lưu khi mở move picker — biết đang chuyển field hay group, và từ đâu. */
export type MoveContext =
  | { kind: 'group'; groupId: string; fromParentPath: string[] }
  | { kind: 'field'; field: string; fromParentPath: string[] };

/** Trạng thái move picker (null = đóng). */
export interface MovePickerState {
  title: string;
  context: MoveContext;
  targets: MoveTargetOption[];
}
