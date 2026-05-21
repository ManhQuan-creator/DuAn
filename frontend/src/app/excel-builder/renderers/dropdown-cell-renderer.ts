import { ICellRendererComp } from 'ag-grid-community';
import { COPY_SVG, GEAR_SVG, createActionIcon, wireIconHover } from './shared';

/**
 * AG Grid vanilla cell renderer cho dropdown cells — share Builder + Render.
 *
 * Convention `cellRendererParams`:
 * - `field` (required): field name
 * - `getDropdownValues(field, data)` (required): callback fetch list values
 * - `showGearIcon: boolean` (default `false`): bật cặp icon (copy + gear) góc
 *   phải để copy địa chỉ cell / mở cell config dialog. Builder set `true`,
 *   Render set `false`.
 * - `openConfigDialog(node, field)`: cần khi `showGearIcon: true`.
 * - `copyCellAddress(node, field)`: cần khi `showGearIcon: true`.
 *
 * Single click trên cell → mở dropdown popup; click item → set value qua
 * `setDataValue` (fire `cellValueChanged`) → AG Grid `refreshCells`.
 *
 * TODO: convert sang Angular component (`ICellRendererAngularComp`) — pattern
 * giống [`formula-cell-renderer.component.ts`](./formula-cell-renderer.component.ts).
 * Cần CDK overlay cho popup (escape AG Grid cell `overflow:hidden`).
 */
export class DropdownCellRenderer implements ICellRendererComp {
  private eGui!: HTMLElement;
  private params!: any;
  private overlay: HTMLElement | null = null;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

  init(params: any): void {
    this.params = params;
    const value = params.valueFormatted ?? params.value ?? '';

    this.eGui = document.createElement('div');
    this.eGui.className = 'cell-formula-container';
    this.eGui.style.cssText = 'position:relative;display:flex;align-items:center;width:100%;height:100%;cursor:pointer;';

    const valSpan = document.createElement('span');
    valSpan.textContent = value ? `${value} \u25BC` : '\u25BC';
    valSpan.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    this.eGui.appendChild(valSpan);

    // Action icons chỉ render khi `showGearIcon: true` (Builder mode). Render
    // không có cell config / không cần copy địa chỉ → bỏ qua block này.
    if (params.showGearIcon) {
      const copyIcon = createActionIcon({
        svg: COPY_SVG,
        right: 22,
        title: 'Copy địa chỉ cell',
        onClick: () => {
          this.closeDropdown();
          params.copyCellAddress?.(params.node, params.field);
        },
      });
      const gearIcon = createActionIcon({
        svg: GEAR_SVG,
        right: 2,
        title: 'Cấu hình cell',
        onClick: () => {
          this.closeDropdown();
          params.openConfigDialog?.(params.node, params.field);
        },
      });
      this.eGui.append(copyIcon, gearIcon);
      wireIconHover(this.eGui, [copyIcon, gearIcon]);
    }

    // Single click on cell → open dropdown
    this.eGui.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.overlay) {
        this.closeDropdown();
      } else {
        this.openDropdown();
      }
    });
  }

  private async openDropdown(): Promise<void> {
    const currentValue = this.params.value ?? '';

    // Create overlay container
    const list = document.createElement('div');
    list.style.cssText =
      'position:fixed;z-index:9999;max-height:200px;min-width:180px;overflow-y:auto;background:#fff;border:1px solid #d1d5db;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,0.18);padding:4px 0;';

    // Position relative to the cell
    const cellEl = this.eGui.closest('.ag-cell') as HTMLElement;
    if (cellEl) {
      const rect = cellEl.getBoundingClientRect();
      list.style.left = rect.left + 'px';
      list.style.top = rect.bottom + 'px';
      list.style.minWidth = rect.width + 'px';
    }

    // Show loading state
    const loading = document.createElement('div');
    loading.style.cssText =
      'padding:8px 12px;color:#64748b;font-size:13px;display:flex;align-items:center;gap:8px;';
    loading.innerHTML =
      '<span style="display:inline-block;width:14px;height:14px;border:2px solid #e2e8f0;border-top-color:#6366f1;border-radius:50%;animation:cc-spin 0.6s linear infinite;"></span> Đang tải...';
    list.appendChild(loading);

    document.body.appendChild(list);
    this.overlay = list;

    // Setup outside click handler
    this.outsideClickHandler = (e: MouseEvent) => {
      if (
        !list.contains(e.target as Node) &&
        !this.eGui.contains(e.target as Node)
      ) {
        this.closeDropdown();
      }
    };
    // Defer registration đến SAU khi click vừa mở popup finish bubbling — tránh
    // same click trigger outside-click → đóng ngay. queueMicrotask chạy sau
    // current task drain (CLAUDE.md: không dùng setTimeout(0) anti-pattern).
    queueMicrotask(() => document.addEventListener('click', this.outsideClickHandler!));

    // Fetch data (may be cached → instant, or API call → loading shown)
    const values: string[] =
      (await this.params.getDropdownValues?.(
        this.params.field,
        this.params.data,
      )) || [];

    // If overlay was closed while loading, abort
    if (!this.overlay) return;

    // Replace loading with items
    list.innerHTML = '';

    if (values.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'Không có dữ liệu';
      empty.style.cssText = 'padding:8px 12px;color:#9ca3af;font-size:13px;';
      list.appendChild(empty);
    } else {
      values.forEach((val) => {
        const item = document.createElement('div');
        item.textContent = val;
        const isSelected = val === currentValue;
        item.style.cssText = `padding:6px 12px;cursor:pointer;font-size:13px;transition:background 0.1s;${isSelected ? 'background:#f5f3ff;color:#6d28d9;font-weight:600;' : ''}`;
        item.addEventListener('mouseenter', () => {
          item.style.backgroundColor = isSelected ? '#ede9fe' : '#f3f4f6';
        });
        item.addEventListener('mouseleave', () => {
          item.style.backgroundColor = isSelected ? '#f5f3ff' : '';
        });
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const rowNode = this.params.node;
          const field = this.params.field;
          // setDataValue (KHÔNG setData) — fire `cellValueChanged` cho field cụ thể.
          // setData chỉ fire `rowValueChanged` → host miss event → recalc + tooltip stale.
          rowNode.setDataValue(field, val);
          this.params.api.refreshCells({ rowNodes: [rowNode], force: true });
          this.closeDropdown();
        });
        list.appendChild(item);
      });

      // Scroll selected into view
      if (currentValue) {
        const idx = values.indexOf(currentValue);
        if (idx >= 0 && list.children[idx]) {
          (list.children[idx] as HTMLElement).scrollIntoView({
            block: 'nearest',
          });
        }
      }
    }
  }

  private closeDropdown(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
  }

  getGui(): HTMLElement {
    return this.eGui;
  }
  refresh(params: any): boolean {
    return false;
  }
  destroy(): void {
    this.closeDropdown();
  }
}
