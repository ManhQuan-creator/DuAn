import { Injectable, OnDestroy } from '@angular/core';
import { GridApi } from 'ag-grid-community';
import { escapeCss } from './css-escape.util';
import type { RangeBounds } from './tsv-formatter.util';

interface RangeSelection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface RangeSelectionAttachOptions {
  gridApi: GridApi;
  /** Unique style tag id (Builder + Render khác nhau). */
  styleId: string;
  /** Callback chạy sau mỗi state change (component dùng để `cdr.detectChanges()`). */
  onChange?: () => void;
}

/**
 * Service quản lý Excel-style range selection: drag từ anchor → head, shift+click extend,
 * highlight CSS, escape clear. State per-instance — provide ở component-level.
 *
 * Component:
 * - `onGridReady`: gọi `attach({ gridApi, styleId, onChange })`
 * - `ngOnDestroy`: gọi `detach()`
 * - Wire AG Grid `cellMouseDown` → `service.onCellMouseDown(event)`
 * - Wire AG Grid `cellMouseOver` → `service.onCellMouseOver(event)`
 * - Phím Escape: `clear()`
 *
 * Public queries: `bounds()`, `cellCount()`, `hasRange()`.
 */
@Injectable()
export class RangeSelectionService implements OnDestroy {
  private gridApi: GridApi | null = null;
  private styleId = '';
  private onChange?: () => void;

  private rangeSelection: RangeSelection | null = null;
  private dragActive = false;

  private readonly windowMouseUp = (): void => {
    if (this.dragActive) this.dragActive = false;
  };

  attach(opts: RangeSelectionAttachOptions): void {
    this.gridApi = opts.gridApi;
    this.styleId = opts.styleId;
    this.onChange = opts.onChange;
    window.addEventListener('mouseup', this.windowMouseUp);
  }

  detach(): void {
    window.removeEventListener('mouseup', this.windowMouseUp);
    this.clearStyle();
    this.rangeSelection = null;
    this.dragActive = false;
    this.gridApi = null;
    this.onChange = undefined;
  }

  ngOnDestroy(): void {
    this.detach();
  }

  onCellMouseDown(e: any): void {
    const ev = e?.event as MouseEvent | undefined;
    if (!ev || ev.button !== 0) return;
    const rowIdx = e.rowIndex;
    const colIdx = this.colIndexFromId(e.column?.getColId());
    if (rowIdx == null || colIdx < 0) return;

    if (ev.shiftKey && this.rangeSelection) {
      this.rangeSelection.endRow = rowIdx;
      this.rangeSelection.endCol = colIdx;
    } else {
      this.rangeSelection = {
        startRow: rowIdx,
        startCol: colIdx,
        endRow: rowIdx,
        endCol: colIdx,
      };
      this.dragActive = true;
    }
    this.applyHighlight();
    this.onChange?.();
  }

  onCellMouseOver(e: any): void {
    if (!this.dragActive || !this.rangeSelection) return;
    const rowIdx = e.rowIndex;
    const colIdx = this.colIndexFromId(e.column?.getColId());
    if (rowIdx == null || colIdx < 0) return;
    if (rowIdx === this.rangeSelection.endRow && colIdx === this.rangeSelection.endCol) return;
    this.rangeSelection.endRow = rowIdx;
    this.rangeSelection.endCol = colIdx;
    this.applyHighlight();
    this.onChange?.();
  }

  hasRange(): boolean {
    return this.rangeSelection != null;
  }

  bounds(): RangeBounds | null {
    if (!this.rangeSelection) return null;
    const r0 = Math.min(this.rangeSelection.startRow, this.rangeSelection.endRow);
    const r1 = Math.max(this.rangeSelection.startRow, this.rangeSelection.endRow);
    const c0 = Math.min(this.rangeSelection.startCol, this.rangeSelection.endCol);
    const c1 = Math.max(this.rangeSelection.startCol, this.rangeSelection.endCol);
    return { r0, r1, c0, c1 };
  }

  cellCount(): number {
    const b = this.bounds();
    if (!b) return 0;
    return (b.r1 - b.r0 + 1) * (b.c1 - b.c0 + 1);
  }

  clear(): void {
    if (!this.rangeSelection) return;
    this.rangeSelection = null;
    this.dragActive = false;
    this.clearStyle();
    this.onChange?.();
  }

  private colIndexFromId(colId?: string): number {
    if (!colId || !this.gridApi) return -1;
    const cols = this.gridApi.getAllDisplayedColumns();
    return cols.findIndex((c) => c.getColId() === colId);
  }

  private applyHighlight(): void {
    const b = this.bounds();
    if (!b || !this.gridApi) return;
    const cols = this.gridApi.getAllDisplayedColumns();
    const selectors: string[] = [];
    for (let r = b.r0; r <= b.r1; r++) {
      for (let c = b.c0; c <= b.c1; c++) {
        const colId = cols[c]?.getColId();
        if (!colId) continue;
        selectors.push(`.ag-row[row-index="${r}"] .ag-cell[col-id="${escapeCss(colId)}"]`);
      }
    }
    if (selectors.length === 0) return;
    let styleEl = document.getElementById(this.styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = this.styleId;
      document.head.appendChild(styleEl);
    }
    // Box-shadow inset thay outline — đảm bảo 2px ĐỀU 4 cạnh, không bị tương
    // tác với row border-bottom 1px (`.ag-row { border-bottom }`) hoặc browser
    // z-index clip ở bottom edge. Outline ở cell edge dễ bị visual lệch giữa
    // top/bottom do row separator overlap. Box-shadow inset vẽ trên bề mặt cell.
    styleEl.textContent = `
      ${selectors.join(',\n')} {
        box-shadow: inset 0 0 0 1.5px rgba(59, 130, 246, 1) !important;
        z-index: 2 !important;
      }
    `;
  }

  private clearStyle(): void {
    document.getElementById(this.styleId)?.remove();
  }
}
