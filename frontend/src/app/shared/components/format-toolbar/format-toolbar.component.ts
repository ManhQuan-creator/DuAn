import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import type { GridApi, IRowNode } from 'ag-grid-community';
import { ColorPickerPopupComponent } from './color-picker-popup.component';
import {
  CanApplyToCellFn,
  CellFormat,
  FormatBoolKey,
  FormatChange,
  FormatChangeEvent,
  FormatColorKey,
  FormatTarget,
  GetRangeBoundsFn,
  RangeBounds,
} from './format-toolbar.types';
import { AppDialogService } from '../../dialog.service';

interface MergeOp {
  node: IRowNode;
  anchorField: string;
  hiddenFields: string[];
}
type MergeValidation =
  | { kind: 'ok'; ops: MergeOp[]; formulaCount: number }
  | { kind: 'error'; message: string };

/**
 * Toolbar Bold / Italic / Fill / Text color + Merge / Unmerge dùng chung
 * Excel Builder + Excel Render.
 *
 * Lấy targets từ rangeSelection (qua callback `getRangeBounds`); fallback cell focus.
 * Lưu vào `node.data._cellConfig[field].format` (format) hoặc `.merge / .mergedBy` (merge).
 *
 * Ngoài range, có thể truyền `canApplyToCell` để gate per-cell (Render check `canEdit`).
 * `disabled` tắt cả toolbar.
 */
@Component({
  selector: 'app-format-toolbar',
  standalone: true,
  imports: [CommonModule, ColorPickerPopupComponent],
  templateUrl: './format-toolbar.component.html',
  styleUrls: ['./format-toolbar.component.scss'],
})
export class FormatToolbarComponent {
  @Input() gridApi: GridApi | null = null;
  @Input() getRangeBounds: GetRangeBoundsFn = () => null;
  @Input() canApplyToCell?: CanApplyToCellFn;
  @Input() disabled = false;

  @Output() formatChanged = new EventEmitter<FormatChangeEvent>();

  openPicker: 'fill' | 'text' | null = null;

  private appDialog = inject(AppDialogService);

  constructor(private cdr: ChangeDetectorRef) {}

  // ========== Public API (parent gọi qua @ViewChild) ==========

  toggleBoolean(key: FormatBoolKey): void {
    if (this.disabled) return;
    const targets = this.getTargets();
    if (!targets.length) return;
    const allOn = targets.every((t) => !!this.readFormatFlag(t, key));
    const next = !allOn;
    this.applyFormatMutation(targets, (fmt) => {
      if (next) fmt[key] = true;
      else delete fmt[key];
    });
  }

  setColor(key: FormatColorKey, color: string | null): void {
    if (this.disabled) return;
    const targets = this.getTargets();
    if (!targets.length) return;
    this.applyFormatMutation(targets, (fmt) => {
      if (color) fmt[key] = color;
      else delete fmt[key];
    });
  }

  // ========== Decimal + Percent ==========

  /** Số chữ số thập phân tối đa cho phép format. */
  private readonly MAX_DECIMALS = 10;

  /**
   * Tăng `decimals` +1 (cap MAX_DECIMALS). KHÔNG đổi raw value — chỉ format display.
   *
   * **Smart inference (Excel parity)**: nếu cell chưa có `fmt.decimals` explicit,
   * dùng số decimals của raw value HIỆN TẠI làm baseline rồi mới +1. Ví dụ raw=1.5
   * (display "1,5" với 1 decimal) → bấm lần đầu → decimals=2 → display "1,50".
   * Tránh trường hợp click đầu không thấy gì thay đổi (vì decimals=1 trùng display).
   */
  increaseDecimal(): void {
    if (this.disabled) return;
    const targets = this.getTargets();
    if (!targets.length) return;
    this.applyFormatMutation(targets, (fmt, target) => {
      const baseline = fmt.decimals ?? this.inferDecimalsFromTarget(target);
      const next = baseline + 1;
      if (next > this.MAX_DECIMALS) return;
      fmt.decimals = next;
    });
  }

  /**
   * Giảm `decimals` -1 (floor at 0). KHÔNG đổi raw value — chỉ format display.
   * decimals=0 explicit → display ROUND về integer (vd 1.5 → "2").
   *
   * **Smart inference**: tương tự `increaseDecimal` — dùng raw decimals của cell
   * làm baseline khi `fmt.decimals` chưa set.
   */
  decreaseDecimal(): void {
    if (this.disabled) return;
    const targets = this.getTargets();
    if (!targets.length) return;
    this.applyFormatMutation(targets, (fmt, target) => {
      const baseline = fmt.decimals ?? this.inferDecimalsFromTarget(target);
      fmt.decimals = Math.max(0, baseline - 1);
    });
  }

  /**
   * Đọc raw value của cell qua AG Grid `getCellValue` — gọi qua valueGetter
   * nên formula cells trả result từ shadow store (KHÔNG phải formula string).
   * Fallback `node.data[field]` nếu API chưa sẵn sàng.
   */
  private inferDecimalsFromTarget(target: FormatTarget): number {
    let raw: any;
    try {
      raw = this.gridApi?.getCellValue({ rowNode: target.node, colKey: target.field })
        ?? target.node.data?.[target.field];
    } catch {
      raw = target.node.data?.[target.field];
    }
    const num = Number(raw);
    if (!Number.isFinite(num)) return 0;
    const str = num.toString();
    const dot = str.indexOf('.');
    if (dot === -1) return 0;
    return Math.min(str.length - dot - 1, MAX_INFER_DECIMALS);
  }

  /**
   * Toggle format chỉ phần nguyên (`decimals=0`).
   *   - Mọi target đang `decimals=0` explicit → click → xoá `decimals` (bỏ làm tròn,
   *     trở về display mặc định cap 10 decimals).
   *   - Ngược lại → set `decimals=0` cho tất cả targets.
   */
  formatIntegerOnly(): void {
    if (this.disabled) return;
    const targets = this.getTargets();
    if (!targets.length) return;
    const allInteger = targets.every(
      (t) => t.node.data?._cellConfig?.[t.field]?.format?.decimals === 0,
    );
    this.applyFormatMutation(targets, (fmt) => {
      if (allInteger) delete fmt.decimals;
      else fmt.decimals = 0;
    });
  }

  /** Active khi mọi target có decimals=0 explicit (nút "INT" sáng). */
  isIntegerOnlyActive(): boolean {
    const targets = this.getTargets();
    if (!targets.length) return false;
    return targets.every(
      (t) => t.node.data?._cellConfig?.[t.field]?.format?.decimals === 0,
    );
  }

  /**
   * Toggle `percent` flag — CHỈ là format config, không thay đổi raw value.
   *
   * Excel-standard: cell raw=0.1 + format `%` → display `10%`. Raw cells dùng cho
   * formula tham chiếu vẫn là 0.1 (display ×100 chỉ ở layer hiển thị + Excel numFmt).
   *
   * Decimals giữ nguyên độc lập — user dùng Increase/Decrease Decimal để chỉnh.
   */
  togglePercent(): void {
    if (this.disabled) return;
    const targets = this.getTargets();
    if (!targets.length) return;
    const allOn = targets.every((t) => !!this.readFormatFlag(t, 'percent'));
    const next = !allOn;
    this.applyFormatMutation(targets, (fmt) => {
      if (next) fmt.percent = true;
      else delete fmt.percent;
    });
  }

  // ========== State cho template ==========

  isBoolActive(key: FormatBoolKey): boolean {
    const targets = this.getTargets();
    if (!targets.length) return false;
    return targets.every((t) => !!this.readFormatFlag(t, key));
  }

  /** Trả màu đồng nhất nếu mọi target có cùng giá trị; ngược lại null. */
  unifiedColor(key: FormatColorKey): string | null {
    const targets = this.getTargets();
    if (!targets.length) return null;
    const first = this.readFormatColor(targets[0], key);
    for (let i = 1; i < targets.length; i++) {
      if (this.readFormatColor(targets[i], key) !== first) return null;
    }
    return first ?? null;
  }

  // ========== Picker handlers ==========

  togglePicker(which: 'fill' | 'text', ev: MouseEvent): void {
    if (this.disabled) return;
    ev.stopPropagation();
    this.openPicker = this.openPicker === which ? null : which;
  }

  closePicker(): void {
    this.openPicker = null;
  }

  onFillPicked(color: string | null): void {
    this.setColor('fillColor', color);
    this.openPicker = null;
  }

  onTextPicked(color: string | null): void {
    this.setColor('textColor', color);
    this.openPicker = null;
  }

  // ========== MERGE / UNMERGE ==========

  /** Range hợp lệ để merge: ít nhất 2 cột (multi-row → per-row merge). */
  canMerge(): boolean {
    if (this.disabled || !this.gridApi) return false;
    const b = this.getRangeBounds();
    return !!b && b.c1 > b.c0;
  }

  /** Có ít nhất 1 anchor merged trong focus/range. */
  canUnmerge(): boolean {
    if (this.disabled || !this.gridApi) return false;
    return this.findAnchors().length > 0;
  }

  /** Orchestrator: validate → confirm (nếu có formula) → apply. */
  mergeRange(): void {
    if (!this.gridApi) return;
    const b = this.getRangeBounds();
    if (!b || b.c0 === b.c1) return;

    const result = this.validateMergeRange(b);
    if (result.kind === 'error') {
      this.appDialog.warning(result.message);
      return;
    }
    if (!result.ops.length) return;

    if (result.formulaCount > 0) {
      this.appDialog
        .confirm({
          title: 'Xác nhận gộp ô',
          message: `Có ${result.formulaCount} ô chứa công thức sẽ bị mất khi gộp. Tiếp tục?`,
          status: 'warning',
          confirmText: 'Gộp',
          cancelText: 'Hủy',
        })
        .subscribe((ok) => {
          if (ok) this.applyMergeOps(result.ops);
        });
    } else {
      this.applyMergeOps(result.ops);
    }
  }

  /** Bỏ gộp anchor đang focus; báo lỗi nếu range chứa nhiều anchors. */
  unmergeRange(): void {
    if (!this.gridApi) return;
    const anchors = this.findAnchors();
    if (!anchors.length) return;
    if (anchors.length > 1) {
      this.appDialog.warning(
        'Vùng chọn chứa nhiều ô đã gộp — chọn 1 ô anchor để bỏ gộp.',
      );
      return;
    }
    const { node, field, colSpan } = anchors[0];
    const cols = this.gridApi.getAllDisplayedColumns();
    const anchorIdx = cols.findIndex((c) => c.getColId() === field);
    if (anchorIdx < 0) return;

    const targets: FormatTarget[] = [{ node, field }];
    for (let c = anchorIdx + 1; c < anchorIdx + colSpan; c++) {
      const fId = cols[c]?.getColId();
      if (fId) targets.push({ node, field: fId });
    }
    this.applyEntryMutation(targets, (entry, t) => {
      if (t.field === field) delete entry.merge;
      else if (entry.mergedBy === field) delete entry.mergedBy;
    });
  }

  // ========== Internal — merge helpers ==========

  /** Quét từng row trong range bounds, validate per-cell, build ops + đếm formula. */
  private validateMergeRange(b: RangeBounds): MergeValidation {
    const cols = this.gridApi!.getAllDisplayedColumns();
    const ops: MergeOp[] = [];
    let formulaCount = 0;

    for (let r = b.r0; r <= b.r1; r++) {
      const node = this.gridApi!.getDisplayedRowAtIndex(r);
      if (!node?.data || node.data._isTypeHeader) continue;

      const fields: string[] = [];
      for (let c = b.c0; c <= b.c1; c++) {
        const colId = cols[c]?.getColId();
        if (!colId || colId === 'row_code') {
          return { kind: 'error', message: 'Không thể merge cột Mã dòng.' };
        }
        const target: FormatTarget = { node, field: colId };
        if (this.canApplyToCell && !this.canApplyToCell(target)) {
          return {
            kind: 'error',
            message: `Không có quyền sửa ô ${colId} — không thể merge.`,
          };
        }
        const cfg = node.data._cellConfig?.[colId];
        // Cell hidden không được có dropdown/datePicker (anchor c0 cho phép).
        if (c !== b.c0 && (cfg?.dropdown || cfg?.datePicker)) {
          return {
            kind: 'error',
            message: `Ô ${colId} có dropdown/ngày — không thể merge.`,
          };
        }
        if (c !== b.c0 && cfg?.formula) formulaCount++;
        fields.push(colId);
      }
      if (fields.length >= 2) {
        ops.push({ node, anchorField: fields[0], hiddenFields: fields.slice(1) });
      }
    }
    return { kind: 'ok', ops, formulaCount };
  }

  private applyMergeOps(ops: MergeOp[]): void {
    if (!this.gridApi) return;
    const targets: FormatTarget[] = [];
    for (const op of ops) {
      targets.push({ node: op.node, field: op.anchorField });
      for (const f of op.hiddenFields) targets.push({ node: op.node, field: f });
    }
    const colSpanByOp = new Map(ops.map((op) => [op.anchorField + '|' + op.node.id, op]));
    this.applyEntryMutation(targets, (entry, t) => {
      const op = colSpanByOp.get(t.field + '|' + t.node.id);
      if (op && t.field === op.anchorField) {
        entry.merge = { colSpan: op.hiddenFields.length + 1 };
      } else {
        // hidden cell — tìm op chứa field này
        for (const o of ops) {
          if (o.node === t.node && o.hiddenFields.includes(t.field)) {
            entry.mergedBy = o.anchorField;
            break;
          }
        }
      }
    });
  }

  /** Tìm tất cả anchors merged trong focus + range. */
  private findAnchors(): { node: IRowNode; field: string; colSpan: number }[] {
    if (!this.gridApi) return [];
    const seen = new Set<string>();
    const out: { node: IRowNode; field: string; colSpan: number }[] = [];
    const consider = (node: IRowNode | undefined | null, field: string) => {
      if (!node?.data || !field) return;
      const span = node.data._cellConfig?.[field]?.merge?.colSpan ?? 1;
      if (span <= 1) return;
      const key = node.id + '|' + field;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ node, field, colSpan: span });
    };

    const focused = this.gridApi.getFocusedCell();
    if (focused) {
      consider(this.gridApi.getDisplayedRowAtIndex(focused.rowIndex), focused.column.getColId());
    }
    const b = this.getRangeBounds();
    if (b) {
      const cols = this.gridApi.getAllDisplayedColumns();
      for (let r = b.r0; r <= b.r1; r++) {
        const node = this.gridApi.getDisplayedRowAtIndex(r);
        for (let c = b.c0; c <= b.c1; c++) {
          consider(node, cols[c]?.getColId() ?? '');
        }
      }
    }
    return out;
  }

  // ========== Internal — targets + mutators ==========

  /**
   * Cache `getTargets()` per CD cycle: template gọi 4-6 lần (B/I/Fill/Text/canMerge/canUnmerge).
   * Key = range bounds + focus cell. Invalidate khi commit changes (apply mutation).
   */
  private _targetsCache: { key: string; targets: FormatTarget[] } | null = null;

  private targetsCacheKey(): string {
    const b = this.getRangeBounds();
    const f = this.gridApi?.getFocusedCell();
    const range = b ? `${b.r0}-${b.r1}-${b.c0}-${b.c1}` : '';
    const focus = f ? `${f.rowIndex}-${f.column?.getColId() ?? ''}` : '';
    return `${range}|${focus}`;
  }

  /** Build danh sách cell áp tác động (skip header/row_code/cells bị canApply chặn). */
  private getTargets(): FormatTarget[] {
    if (!this.gridApi) return [];
    const key = this.targetsCacheKey();
    if (this._targetsCache?.key === key) return this._targetsCache.targets;

    const targets = this.computeTargets();
    this._targetsCache = { key, targets };
    return targets;
  }

  private computeTargets(): FormatTarget[] {
    const b = this.getRangeBounds();
    if (b) return this.collectTargetsInRange(b);

    const focused = this.gridApi!.getFocusedCell();
    if (!focused) return [];
    const node = this.gridApi!.getDisplayedRowAtIndex(focused.rowIndex);
    const field = focused.column.getColId();
    const target: FormatTarget = { node: node as IRowNode, field };
    return this.isApplicable(target) ? [target] : [];
  }

  private collectTargetsInRange(b: RangeBounds): FormatTarget[] {
    const cols = this.gridApi!.getAllDisplayedColumns();
    const out: FormatTarget[] = [];
    for (let r = b.r0; r <= b.r1; r++) {
      const node = this.gridApi!.getDisplayedRowAtIndex(r);
      if (!node?.data || node.data._isTypeHeader) continue;
      for (let c = b.c0; c <= b.c1; c++) {
        const colId = cols[c]?.getColId();
        if (!colId || colId === 'row_code') continue;
        const target: FormatTarget = { node, field: colId };
        if (this.isApplicable(target)) out.push(target);
      }
    }
    return out;
  }

  private isApplicable(t: FormatTarget): boolean {
    if (!t.node?.data || t.node.data._isTypeHeader) return false;
    if (!t.field || t.field === 'row_code') return false;
    return !this.canApplyToCell || this.canApplyToCell(t);
  }

  private readFormatFlag(t: FormatTarget, key: FormatBoolKey): boolean {
    return !!t.node.data?._cellConfig?.[t.field]?.format?.[key];
  }

  private readFormatColor(t: FormatTarget, key: FormatColorKey): string | undefined {
    return t.node.data?._cellConfig?.[t.field]?.format?.[key];
  }

  /**
   * Mutate `_cellConfig[field].format` — thường dùng cho B/I/Fill/Text + decimal/percent.
   *
   * Callback nhận `target` thứ 2 cho các thao tác cần đọc raw value của cell
   * (smart inference của Increase/Decrease Decimal). Caller chỉ cần `(fmt) => ...`
   * cũng vẫn type-check OK (TS cho phép lambda với ít params hơn).
   */
  private applyFormatMutation(
    targets: FormatTarget[],
    mutate: (fmt: CellFormat, target: FormatTarget) => void,
  ): void {
    this.applyEntryMutation(targets, (entry, target) => {
      const fmt: CellFormat = { ...(entry.format ?? {}) };
      mutate(fmt, target);
      if (Object.keys(fmt).length) entry.format = fmt;
      else delete entry.format;
    });
  }

  /**
   * Mutate `_cellConfig[field]` (toàn entry) — generalized cho cả format + merge.
   * Tự cleanup empty entry/cellConfig + commit AG Grid + emit + CD.
   *
   * Capture old/new entry snapshot per cell để parent push undo/redo. Skip cells
   * có snapshot không đổi (vd toggle bold ở cell đã bold + cell chưa bold cùng
   * range → cell đã bold không thay đổi sau toggle "ON" common state).
   */
  private applyEntryMutation(
    targets: FormatTarget[],
    mutate: (entry: any, target: FormatTarget) => void,
  ): void {
    if (!this.gridApi || !targets.length) return;
    const touched = new Set<IRowNode>();
    const changes: FormatChange[] = [];
    for (const target of targets) {
      const data = target.node.data;
      if (!data._cellConfig) data._cellConfig = {};
      const cfg = data._cellConfig;
      const oldSnap = snapshotEntry(cfg[target.field]);
      const entry = { ...(cfg[target.field] ?? {}) };
      mutate(entry, target);
      if (Object.keys(entry).length) cfg[target.field] = entry;
      else delete cfg[target.field];
      if (Object.keys(cfg).length === 0) delete data._cellConfig;
      const newSnap = snapshotEntry(entry);
      if (entrySnapshotEqual(oldSnap, newSnap)) continue;
      changes.push({
        node: target.node,
        field: target.field,
        oldEntry: oldSnap,
        newEntry: newSnap,
      });
      touched.add(target.node);
    }
    if (changes.length === 0) return;
    this.commitChanges(touched, changes);
  }

  /** Redraw + refresh + emit + CD cho các nodes bị chạm. Invalidate targets cache. */
  private commitChanges(touched: Set<IRowNode>, changes: FormatChange[]): void {
    const nodes = Array.from(touched);
    this._targetsCache = null; // data đã thay đổi → cache stale
    this.gridApi!.redrawRows({ rowNodes: nodes });
    this.gridApi!.refreshCells({ rowNodes: nodes, force: true });
    this.formatChanged.emit({ touched: nodes, changes });
    this.cdr.detectChanges();
  }
}

/** Cap số decimals infer được từ raw — tránh float artifact (vd 0.1+0.2=0.30000000000000004). */
const MAX_INFER_DECIMALS = 10;

/**
 * Deep-clone entry để snapshot trước/sau mutate. Trả null nếu entry rỗng/không
 * có. Caller dùng cho undo/redo: applyEntrySnapshot khôi phục state.
 *
 * Dùng JSON-clone vì entry chỉ chứa primitive + nested objects (format/merge/
 * dropdown/datePicker/formula) — không có Date/Function/Set.
 */
export function snapshotEntry(entry: any): any | null {
  if (!entry || typeof entry !== 'object') return null;
  if (Object.keys(entry).length === 0) return null;
  return JSON.parse(JSON.stringify(entry));
}

function entrySnapshotEqual(a: any | null, b: any | null): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Khôi phục `_cellConfig[field]` về snapshot. Parent gọi trong undo/redo callback
 * sau khi pop action từ UndoRedoService. `null` = clear entry.
 *
 * Caller phải tự gọi `gridApi.redrawRows()` + `refreshCells()` cho node sau cùng
 * khi đã apply tất cả snapshots — gom 1 lần để tránh redraw lặp.
 */
export function applyEntrySnapshot(
  node: IRowNode,
  field: string,
  snap: any | null,
): void {
  const data = node.data;
  if (!data) return;
  if (!snap) {
    if (data._cellConfig?.[field]) {
      delete data._cellConfig[field];
      if (Object.keys(data._cellConfig).length === 0) delete data._cellConfig;
    }
    return;
  }
  if (!data._cellConfig) data._cellConfig = {};
  data._cellConfig[field] = JSON.parse(JSON.stringify(snap));
}
