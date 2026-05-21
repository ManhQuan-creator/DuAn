import { Injectable } from '@angular/core';
import type { GridApi } from 'ag-grid-community';
import type { CellFormat } from '../utils/cell-styles.const';
import type { RangeBounds } from './tsv-formatter.util';

export interface FormatClipboardPayload {
  /** Raw TSV đã write OS clipboard — dùng để verify match khi user paste. */
  tsv: string;
  rows: number;
  cols: number;
  /**
   * Format snapshot per cell, indexed `[r][c]` với r,c là offset từ top-left vùng copy.
   * `null` = cell không có format. Khi paste, cell `null` sẽ CLEAR format ở đích
   * (Excel-faithful: copy/paste replace format).
   */
  formats: (CellFormat | null)[][];
}

/**
 * In-memory buffer cho copy/paste **format** (bold/italic/fill/text color).
 *
 * Singleton root-level → Builder và Render share cùng buffer (user copy ở Builder
 * có thể paste sang Render entry vẫn giữ format). Buffer chỉ tồn tại trong tab/
 * session hiện tại — reload trang hoặc tab khác đều không thấy.
 *
 * Match qua `tsv`: khi paste, so OS-clipboard text với `payload.tsv`. Khớp →
 * apply format. Không khớp (vd user copy text khác từ Excel/Notepad đè lên) →
 * paste text-only như cũ. Cách này tránh case payload cũ "leak" vào lần paste mới.
 */
@Injectable({ providedIn: 'root' })
export class FormatClipboardService {
  private payload: FormatClipboardPayload | null = null;

  set(p: FormatClipboardPayload): void {
    this.payload = p;
  }

  /** Return payload nếu `clipboardTsv` khớp; null nếu không có buffer hoặc TSV khác. */
  tryMatch(clipboardTsv: string): FormatClipboardPayload | null {
    if (!this.payload) return null;
    if (this.payload.tsv !== clipboardTsv) return null;
    return this.payload;
  }

  clear(): void {
    this.payload = null;
  }
}

/**
 * Snapshot format của 1 vùng range trong grid → matrix `[r][c]` (offset từ top-left).
 * `null` = cell không có format. Caller dùng kết quả để set vào `FormatClipboardPayload`.
 */
export function captureFormatRange(
  gridApi: GridApi,
  bounds: RangeBounds,
): (CellFormat | null)[][] {
  const cols = gridApi.getAllDisplayedColumns();
  const out: (CellFormat | null)[][] = [];
  for (let r = bounds.r0; r <= bounds.r1; r++) {
    const rowNode = gridApi.getDisplayedRowAtIndex(r);
    const row: (CellFormat | null)[] = [];
    for (let c = bounds.c0; c <= bounds.c1; c++) {
      const col = cols[c];
      const field = col?.getColId();
      const fmt: CellFormat | undefined = field
        ? rowNode?.data?._cellConfig?.[field]?.format
        : undefined;
      row.push(fmt ? { ...fmt } : null);
    }
    out.push(row);
  }
  return out;
}
