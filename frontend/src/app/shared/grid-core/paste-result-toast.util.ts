import { Observable, Subject, takeUntil } from 'rxjs';
import { GridApi } from 'ag-grid-community';
import {
  PasteColumnSpec,
  PasteResult,
  SkipReason,
} from '../excel-paste/paste-helper.util';
import type { CatalogItem } from '../../excel-builder/models/catalog.data';

export interface PasteToastDialog {
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
}

const REASON_LABEL: Record<SkipReason, string> = {
  formula: 'công thức',
  catalog: 'danh mục',
  date: 'ngày lỗi',
  number: 'số lỗi',
  dropdown: 'dropdown không match',
  permission: 'không có quyền',
  'out-of-bounds': 'vượt khung lưới',
  readonly: 'chỉ đọc',
};

/** Hiển thị toast tóm tắt kết quả paste (success/warning/error tùy applied vs skipped). */
export function showPasteResultToast(dialog: PasteToastDialog, result: PasteResult): void {
  const applied = result.applied;
  const skipped = result.skipped.length;
  const warn = result.warnings;
  if (applied === 0 && skipped === 0) return;

  const skipParts: string[] = [];
  (Object.keys(result.skipCountByReason) as SkipReason[]).forEach((k) => {
    const n = result.skipCountByReason[k];
    if (n > 0) skipParts.push(`${n} ${REASON_LABEL[k]}`);
  });
  const skipDetail = skipParts.length > 0 ? ` (${skipParts.join(', ')})` : '';

  if (applied > 0 && skipped === 0) {
    const warnTail = warn > 0 ? ` · ${warn} ô cảnh báo validate` : '';
    dialog.success(`Đã paste ${applied} ô${warnTail}`);
  } else if (applied > 0 && skipped > 0) {
    dialog.warning(
      `Đã paste ${applied} ô · Bỏ qua ${skipped}${skipDetail}` +
        (warn > 0 ? ` · ${warn} cảnh báo` : ''),
    );
  } else {
    dialog.error(`Không paste được ô nào. Bỏ qua ${skipped}${skipDetail}`);
  }
}

export interface CatalogFetcher {
  getCatalogs(catalogType: string): Observable<CatalogItem[]>;
}

/**
 * Preload dropdown catalogs cho range paste để `applyPaste` validate
 * dropdown match được. Skip catalog đã có trong cache. Lỗi → resolve silent
 * (không block paste, chỉ làm dropdown validate strict bị skip ô đó).
 */
export function preloadDropdownCatalogsForPaste(opts: {
  gridApi: GridApi;
  matrix: string[][];
  anchorRow: number;
  anchorCol: number;
  columns: PasteColumnSpec[];
  cache: Map<string, string[]>;
  catalogService: CatalogFetcher;
  destroy$: Subject<void>;
}): Promise<void> {
  const { gridApi, matrix, anchorRow, anchorCol, columns, cache, catalogService, destroy$ } = opts;
  const toLoad = new Set<string>();

  for (let r = 0; r < matrix.length; r++) {
    const node = gridApi.getDisplayedRowAtIndex(anchorRow + r);
    if (!node?.data) continue;
    for (let c = 0; c < matrix[r].length; c++) {
      const col = columns[anchorCol + c];
      if (!col) continue;
      const catalogType = node.data?._cellConfig?.[col.field]?.dropdown?.catalogType;
      if (catalogType && !cache.has(catalogType)) {
        toLoad.add(catalogType);
      }
    }
  }
  if (toLoad.size === 0) return Promise.resolve();

  const jobs = Array.from(toLoad).map(
    (ct) =>
      new Promise<void>((resolve) => {
        catalogService
          .getCatalogs(ct)
          .pipe(takeUntil(destroy$))
          .subscribe({
            next: (items) => {
              cache.set(
                ct,
                items.map((i) => i.name),
              );
              resolve();
            },
            error: () => resolve(),
          });
      }),
  );
  return Promise.all(jobs).then(() => undefined);
}
