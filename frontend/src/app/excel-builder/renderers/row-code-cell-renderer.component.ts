import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, IRowNode } from 'ag-grid-community';

import { getRowKind, RowKind } from '../utils/row-kind.util';

/**
 * Cell renderer cho cột `row_code` ở Builder — hiển thị mã dòng + nút xóa (×)
 * khi hover row.
 *
 * Convention:
 * - `params.deleteRow(node)` được set qua `cellRendererParams` từ caller.
 * - Nút xóa CHỈ hiện cho `manualRow` (không cho `typeHeader` / `catalogItem`).
 * - Hover effect dùng CSS thuần — KHÔNG mouseenter/mouseleave listener.
 *   `:host-context(.ag-row:hover)` để bắt parent hover (AG Grid set hover class
 *   trên row container).
 */
type RowCodeCellRendererParams = ICellRendererParams & {
  deleteRow: (node: IRowNode) => void;
};

@Component({
  standalone: true,
  selector: 'app-row-code-cell-renderer',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.Emulated,
  template: `
    <span class="text">{{ value }}</span>
    <button
      *ngIf="kind === 'manualRow'"
      type="button"
      class="del-btn"
      title="Xóa dòng"
      (click)="onDelete($event)"
    >&#x2715;</button>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      width: 100%;
    }
    .text {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .del-btn {
      cursor: pointer;
      font-size: 11px;
      margin-left: 8px;
      padding: 0 4px;
      color: #dc2626;
      background: transparent;
      border: 0;
      opacity: 0;
      transition: opacity 0.2s;
    }
    /* AG Grid set class .ag-row-hover trên row container khi hover.
       :host-context bắt từ ancestor → hiện nút khi hover row. */
    :host-context(.ag-row-hover) .del-btn { opacity: 0.5; }
    .del-btn:hover { opacity: 1; }
  `],
})
export class RowCodeCellRendererComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  private params!: RowCodeCellRendererParams;
  value = '';
  kind: RowKind = 'manualRow';

  agInit(params: RowCodeCellRendererParams): void {
    this.params = params;
    this.value = params.value ?? '';
    this.kind = getRowKind(params.data);
  }

  /** OnPush component — `markForCheck()` để Angular CD pick up field mutations. */
  refresh(params: RowCodeCellRendererParams): boolean {
    this.params = params;
    this.value = params.value ?? '';
    this.kind = getRowKind(params.data);
    this.cdr.markForCheck();
    return true;
  }

  onDelete(ev: MouseEvent): void {
    ev.stopPropagation();
    this.params.deleteRow(this.params.node);
  }
}
