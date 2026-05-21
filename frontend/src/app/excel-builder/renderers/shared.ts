/** Gear icon SVG (mở Cell Config dialog) — share giữa các cell renderer. */
export const GEAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>`;

/** Copy icon SVG (clipboard) — copy địa chỉ cell `{rowCode}_{field}`. */
export const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

/** Địa chỉ cell theo Tier 1 ROW_COL — `{rowCode}_{field}` (xem `excelpro-formula.md`). */
export function cellAddressOf(rowCode: unknown, field: string): string {
  return `${rowCode ?? ''}_${field}`;
}

/**
 * Build action icon (gear / copy) absolute-positioned ở góc phải trên cell.
 * Chỉ dùng cho legacy imperative renderer (`DropdownCellRenderer`/`DateCellRenderer`).
 * Renderer Angular dùng template + `:hover` CSS thuần — KHÔNG gọi helper này.
 *
 * `right` (px): khoảng cách từ cạnh phải. Gear=2, Copy=22 (16px width + 4px gap).
 */
export function createActionIcon(opts: {
  svg: string;
  right: number;
  title: string;
  onClick: (ev: MouseEvent) => void;
}): HTMLElement {
  const span = document.createElement('span');
  span.className = 'formula-edit-icon';
  span.title = opts.title;
  span.innerHTML = opts.svg;
  span.style.cssText =
    `position:absolute;top:2px;right:${opts.right}px;width:16px;height:16px;` +
    `display:inline-flex;align-items:center;justify-content:center;border-radius:3px;` +
    `cursor:pointer;z-index:2;opacity:0;pointer-events:none;color:#2563eb;` +
    `background-color:#ffffff;border:1px solid rgba(37,99,235,0.45);` +
    `box-shadow:0 1px 2px rgba(37,99,235,0.12);transition:opacity 0.15s ease;`;
  span.addEventListener('click', (e) => {
    e.stopPropagation();
    opts.onClick(e);
  });
  return span;
}

/** Toggle visibility của icon array khi container hover. */
export function wireIconHover(container: HTMLElement, icons: HTMLElement[]): void {
  container.addEventListener('mouseenter', () => {
    for (const i of icons) {
      i.style.opacity = '1';
      i.style.pointerEvents = 'auto';
    }
  });
  container.addEventListener('mouseleave', () => {
    for (const i of icons) {
      i.style.opacity = '0';
      i.style.pointerEvents = 'none';
    }
  });
}
