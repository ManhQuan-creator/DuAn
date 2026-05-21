import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, IRowNode } from 'ag-grid-community';

/**
 * Cell renderer mặc định cho các cột Builder (formula + data) — hiển thị value
 * + 2 action icon ở góc phải khi hover:
 *   - Copy (clipboard): copy địa chỉ cell `{rowCode}_{field}` (left)
 *   - Gear: mở Cell Config dialog (right)
 *
 * Convention `cellRendererParams`:
 * - `field` (required): field name
 * - `openConfigDialog(node, field)`: callback mở Cell Config dialog
 * - `copyCellAddress(node, field)`: callback copy `{rowCode}_{field}` vào clipboard
 *
 * Hover effect dùng `:host:hover` CSS thuần — KHÔNG mouseenter/mouseleave listener.
 * Encapsulation Emulated → CSS scoped theo component.
 */
type FormulaCellRendererParams = ICellRendererParams & {
  field: string;
  openConfigDialog: (node: IRowNode, field: string) => void;
  copyCellAddress: (node: IRowNode, field: string) => void;
};

@Component({
  standalone: true,
  selector: 'app-formula-cell-renderer',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.Emulated,
  template: `
    <span class="value">{{ displayValue }}</span>
    <span class="action-icon copy-icon" title="Copy địa chỉ cell" (click)="onCopyClick($event)">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    </span>
    <span class="action-icon gear-icon" title="Cấu hình cell" (click)="onGearClick($event)">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 7h-9"/>
        <path d="M14 17H5"/>
        <circle cx="17" cy="17" r="3"/>
        <circle cx="7" cy="7" r="3"/>
      </svg>
    </span>
  `,
  styles: [`
    :host {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      height: 100%;
    }
    .value {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .action-icon {
      position: absolute;
      top: 2px;
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 3px;
      cursor: pointer;
      z-index: 2;
      opacity: 0;
      pointer-events: none;
      color: #2563eb;
      background-color: #ffffff;
      border: 1px solid rgba(37, 99, 235, 0.45);
      box-shadow: 0 1px 2px rgba(37, 99, 235, 0.12);
      transition: opacity 0.15s ease;
    }
    /* Gear bám sát góc phải; Copy nằm bên trái gear (16px width + 4px gap). */
    .gear-icon { right: 2px; }
    .copy-icon { right: 22px; }
    :host:hover .action-icon {
      opacity: 1;
      pointer-events: auto;
    }
  `],
})
export class FormulaCellRendererComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  private params!: FormulaCellRendererParams;
  displayValue = '';

  agInit(params: FormulaCellRendererParams): void {
    this.params = params;
    this.displayValue = this.computeDisplay(params);
  }

  /**
   * AG Grid gọi khi cell value thay đổi mà cell vẫn cùng instance — return true để
   * skip recreate (perf). OnPush component → BẮT BUỘC `cdr.markForCheck()` để
   * template binding `{{ displayValue }}` re-render.
   */
  refresh(params: FormulaCellRendererParams): boolean {
    this.params = params;
    this.displayValue = this.computeDisplay(params);
    this.cdr.markForCheck();
    return true;
  }

  onGearClick(ev: MouseEvent): void {
    ev.stopPropagation();
    this.params.openConfigDialog(this.params.node, this.params.field);
  }

  onCopyClick(ev: MouseEvent): void {
    ev.stopPropagation();
    this.params.copyCellAddress(this.params.node, this.params.field);
  }

  private computeDisplay(params: FormulaCellRendererParams): string {
    if (params.valueFormatted != null) return String(params.valueFormatted);
    if (params.value == null || params.value === '') return '';
    return new Intl.NumberFormat('vi-VN').format(Number(params.value));
  }
}
