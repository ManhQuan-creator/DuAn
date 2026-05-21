import type { IRowNode } from 'ag-grid-community';
import { CellFormat, CellMerge } from '../../utils/cell-styles.const';

export type FormatBoolKey = 'bold' | 'italic' | 'percent';
export type FormatColorKey = 'fillColor' | 'textColor';
export type FormatKey = FormatBoolKey | FormatColorKey;

/** 1 cell sẽ chịu tác động của thao tác format. */
export interface FormatTarget {
  node: IRowNode;
  field: string;
}

/** Range bounds Builder/Render cùng dùng — khớp với rangeBounds() ở 2 bên. */
export interface RangeBounds {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
}

export type GetRangeBoundsFn = () => RangeBounds | null;
export type CanApplyToCellFn = (ctx: FormatTarget) => boolean;

/**
 * Snapshot 1 thay đổi `_cellConfig[field]` do toolbar gây ra. Parent dùng để push
 * undo/redo. `null` = không có entry (state ban đầu hoặc đã clear hoàn toàn).
 */
export interface FormatChange {
  node: IRowNode;
  field: string;
  oldEntry: any | null;
  newEntry: any | null;
}

export interface FormatChangeEvent {
  /** Nodes bị chạm — parent dùng để CD/recalc nếu cần. */
  touched: IRowNode[];
  /** Chi tiết từng cell thay đổi — parent dùng để build undo action. */
  changes: FormatChange[];
}

export type { CellFormat, CellMerge };
