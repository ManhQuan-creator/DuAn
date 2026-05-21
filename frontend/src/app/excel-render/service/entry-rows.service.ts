import { Injectable } from '@angular/core';

/** Shape tối thiểu cho validateRowOrder — đọc 2 flag để check invariant. */
export interface VisualRowShape {
  row_code?: string;
  _isCustomRow?: boolean;
  _isTypeHeader?: boolean;
}

/**
 * Quản lý state per-entry mà KHÔNG nằm trong rowData array trực tiếp:
 *  - Snapshot original `_cellConfig` per rowCode lúc `loadEntryData` (cho delta badge
 *    + reset row helper).
 *  - Pure helpers cho add/delete/drag handlers ở component (isCustomRow,
 *    validateRowOrder).
 *
 * KHÔNG quản lý rowData order — order là source of truth thẳng trong array của
 * component. KHÔNG còn `injectInto`/`afterRowCode`/cache cell values vì sau
 * snapshot model các thao tác mutate trực tiếp rowData → values persist tự nhiên.
 *
 * Provider scope component-level (`providers: [EntryRowsService]`) để snapshot
 * không leak giữa các route navigation.
 */
@Injectable()
export class EntryRowsService {
  private originalCellConfigByRowCode = new Map<string, any>();

  reset(): void {
    this.originalCellConfigByRowCode.clear();
  }

  /**
   * Snapshot deep-clone `_cellConfig` per rowCode — gọi 1 lần ngay sau parse
   * `entry.rowData` ở `loadEntryData`. Sau khi user mutate cellConfig, so sánh
   * với snapshot này để (a) hiện delta badge, (b) reset row về template gốc.
   */
  captureOriginal(rowData: any[]): void {
    this.originalCellConfigByRowCode.clear();
    for (const row of rowData) {
      if (!row?.row_code) continue;
      if (row._cellConfig) {
        this.originalCellConfigByRowCode.set(
          row.row_code,
          JSON.parse(JSON.stringify(row._cellConfig)),
        );
      }
    }
  }

  hasOriginalCellConfig(rowCode: string): boolean {
    return this.originalCellConfigByRowCode.has(rowCode);
  }

  getOriginalCellConfig(rowCode: string): any | undefined {
    return this.originalCellConfigByRowCode.get(rowCode);
  }

  /**
   * Compare formula của cell hiện tại vs snapshot gốc.
   * Cả 2 null/undefined → false (không thay đổi). Khác nhau → true.
   * Chỉ compare `formula` field; dropdown/datePicker/format/validation KHÔNG tính.
   */
  isCellFormulaModified(
    rowCode: string,
    field: string,
    currentCellConfig: any,
  ): boolean {
    const orig = this.originalCellConfigByRowCode.get(rowCode);
    const origFormula = orig?.[field]?.formula ?? null;
    const currFormula = currentCellConfig?.[field]?.formula ?? null;
    return origFormula !== currFormula;
  }

  /** Đọc flag `_isCustomRow` (KHÔNG infer từ rowCode prefix). */
  isCustomRow(row: any): boolean {
    return !!row?._isCustomRow;
  }

  /**
   * Invariant cho row order sau drag-drop:
   *  - typeHeader rows giữ nguyên vị trí (không drag, không xóa) — section boundary.
   *  - Mọi non-header row chỉ cần có ít nhất 1 row trên (không ở vị trí 0 nếu top
   *    row là typeHeader → chấp nhận, vì non-header có thể ở vị trí 0 nếu KHÔNG
   *    có typeHeader nào).
   *
   * Trả `{ok: true}` nếu hợp lệ, `{ok: false, reason}` nếu vi phạm.
   */
  validateRowOrder(visualOrder: ReadonlyArray<VisualRowShape>): { ok: true } | { ok: false; reason: string } {
    // Hiện tại chưa có constraint nghiêm ngặt — drag-drop AG Grid managed mode chỉ
    // shuffle thứ tự, không tự đặt typeHeader sai chỗ trừ khi user kéo. Nếu user
    // kéo non-header lên đầu trước typeHeader → vẫn OK theo spec "free freedom".
    // Chỉ reject khi rowData rỗng (defensive).
    if (visualOrder.length === 0) return { ok: false, reason: 'Bảng đang trống.' };
    return { ok: true };
  }
}
