import { SkippedCell } from '../excel-paste/paste-helper.util';
import { escapeCss } from './css-escape.util';

export interface PasteHighlightHandle {
  /** Apply highlight cho danh sách cell bị skip. Tự xóa sau `durationMs` (default 3000). */
  apply(skipped: SkippedCell[]): void;
  /** Xóa highlight + clear timer. */
  clear(): void;
}

export interface PasteHighlightOptions {
  /** Unique style tag id (tránh trùng khi nhiều grid trên page). */
  styleId: string;
  /** Animation keyframes name. Default `paste-skip-flash-{styleId}`. */
  animationName?: string;
  /** Duration trước khi tự clear (ms). Default 3000. */
  durationMs?: number;
}

/**
 * Factory tạo handle quản lý paste highlight CSS. Tách style id + animation name
 * theo từng instance để Builder + Render KHÔNG đụng nhau khi mở chung.
 */
export function createPasteHighlight(options: PasteHighlightOptions): PasteHighlightHandle {
  const styleId = options.styleId;
  const animation = options.animationName ?? `paste-skip-flash-${styleId}`;
  const duration = options.durationMs ?? 3000;
  let timer: any = null;

  function clear(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    document.getElementById(styleId)?.remove();
  }

  function apply(skipped: SkippedCell[]): void {
    clear();
    if (skipped.length === 0) return;

    const styleEl = document.createElement('style');
    styleEl.id = styleId;

    const rules = skipped
      .map(
        (s) =>
          `.ag-row[row-index="${s.rowIndex}"] .ag-cell[col-id="${escapeCss(s.colId)}"] { ` +
          `outline: 2px dashed #f59e0b !important; outline-offset: -2px; ` +
          `animation: ${animation} ${duration}ms ease-out; }`,
      )
      .join('\n');

    styleEl.textContent = `
      @keyframes ${animation} {
        0%   { background-color: rgba(245, 158, 11, 0.35); }
        60%  { background-color: rgba(245, 158, 11, 0.20); }
        100% { background-color: transparent; }
      }
      ${rules}
    `;
    document.head.appendChild(styleEl);

    timer = setTimeout(clear, duration);
  }

  return { apply, clear };
}
