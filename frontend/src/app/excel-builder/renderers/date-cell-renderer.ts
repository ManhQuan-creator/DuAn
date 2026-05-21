import { ICellRendererComp } from 'ag-grid-community';
import { COPY_SVG, GEAR_SVG, createActionIcon, wireIconHover } from './shared';

/**
 * AG Grid vanilla cell renderer cho date cells — share Builder + Render.
 *
 * Convention `cellRendererParams`:
 * - `field` (required): field name
 * - `showGearIcon: boolean` (default `false`): bật cặp icon (copy + gear) góc
 *   phải. Builder set `true`, Render set `false`.
 * - `openConfigDialog(node, field)`: cần khi `showGearIcon: true`.
 * - `copyCellAddress(node, field)`: cần khi `showGearIcon: true`.
 *
 * Click cell → mở native `<input type="date">` picker; blur/Enter → setDataValue
 * (fire `cellValueChanged`).
 *
 * TODO: convert sang Angular component renderer (xem dropdown-cell-renderer.ts).
 */
export class DateCellRenderer implements ICellRendererComp {
  private eGui!: HTMLElement;
  private params!: any;

  init(params: any): void {
    this.params = params;
    const rawValue = params.value ?? '';

    this.eGui = document.createElement('div');
    this.eGui.className = 'date-cell-container';
    this.eGui.style.cssText =
      'position:relative;display:flex;align-items:center;width:100%;height:100%;cursor:pointer;';

    const valSpan = document.createElement('span');
    valSpan.className = 'date-cell-value';
    valSpan.style.flex = '1';
    valSpan.textContent = rawValue ? this.formatDateDisplay(rawValue) : '';
    this.eGui.appendChild(valSpan);

    const calendarIcon = document.createElement('span');
    calendarIcon.className = 'date-cell-icon';
    calendarIcon.textContent = '\uD83D\uDCC5';
    calendarIcon.style.cssText =
      'opacity:0.5;transition:opacity 0.2s;font-size:14px;margin-right:4px;';
    this.eGui.appendChild(calendarIcon);

    // Action icons chỉ render khi `showGearIcon: true` (Builder mode).
    if (params.showGearIcon) {
      const copyIcon = createActionIcon({
        svg: COPY_SVG,
        right: 22,
        title: 'Copy địa chỉ cell',
        onClick: () => params.copyCellAddress?.(params.node, params.field),
      });
      const gearIcon = createActionIcon({
        svg: GEAR_SVG,
        right: 2,
        title: 'Cấu hình cell',
        onClick: () => params.openConfigDialog?.(params.node, params.field),
      });
      this.eGui.append(copyIcon, gearIcon);
      wireIconHover(this.eGui, [copyIcon, gearIcon]);
    }

    // Click on cell (skip if click on icon) → open native date picker
    this.eGui.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.formula-edit-icon')) return;
      e.stopPropagation();
      this.openDatePicker();
    });
  }

  private openDatePicker(): void {
    const cellEl = this.eGui.closest('.ag-cell') as HTMLElement;
    if (!cellEl) return;

    const rect = cellEl.getBoundingClientRect();
    const input = document.createElement('input');
    input.type = 'date';
    if (this.params.value) input.value = String(this.params.value);
    input.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:9999;font-size:13px;padding:0 8px;border:2px solid #3b82f6;border-radius:4px;background:#fff;color:#1e293b;outline:none;box-sizing:border-box;`;

    const cleanup = () => {
      input.remove();
    };

    // input.addEventListener('change', () => {
    //   const newVal = input.value; // ISO YYYY-MM-DD
    //   const rowNode = this.params.node;
    //   const field = this.params.field;
    //   const data = { ...rowNode.data };
    //   data[field] = newVal;
    //   rowNode.setData(data);
    //   this.params.api.refreshCells({ rowNodes: [rowNode], force: true });
    //   cleanup();
    // });

    // input.addEventListener('keydown', (e) => {
    //   if (e.key === 'Escape') cleanup();
    // });

    // input.addEventListener('blur', () => {
    //   setTimeout(cleanup, 150);
    // });

  const save = () => {
    const newVal = input.value;
    if (!newVal) return;
    const rowNode = this.params.node;
    const field = this.params.field;
    // setDataValue (KHÔNG setData) — fire `cellValueChanged` cho field cụ thể.
    // setData chỉ fire `rowValueChanged` → host component miss event → recalc validation
    // + force tooltip refresh KHÔNG chạy → panel + tooltip stale sau khi đổi date.
    rowNode.setDataValue(field, newVal);
    this.params.api.refreshCells({ rowNodes: [rowNode], force: true });
  };
    input.addEventListener('blur', () => {
    save();
    setTimeout(cleanup, 150);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      save();
      // cleanup();
    }
    if (e.key === 'Escape') cleanup();
  });

    document.body.appendChild(input);
    input.focus();
  }

  private formatDateDisplay(value: any): string {
    if (!value) return '';
    const str = String(value);
    // ISO YYYY-MM-DD → DD/MM/YYYY
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return str;
  }

  getGui(): HTMLElement {
    return this.eGui;
  }
  refresh(params: any): boolean {
    return false;
  }
  destroy(): void {}
}
