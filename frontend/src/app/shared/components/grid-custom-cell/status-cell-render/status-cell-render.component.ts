import { Component } from '@angular/core';
import { ICellRendererComp } from 'ag-grid-community';

@Component({
  selector: 'app-status-cell-render',
  imports: [],
  templateUrl: './status-cell-render.component.html',
  styleUrl: './status-cell-render.component.scss'
})

export class StatusCellRenderComponent implements ICellRendererComp {
  private eGui!: HTMLElement;

  init(params: any): void {
    this.eGui = document.createElement('span');

    const active = params.value;

    this.eGui.textContent = active ? 'Đang hoạt động' : 'Ngừng hoạt động';

    this.eGui.style.cssText = `
      display:inline-flex;
      align-items:center;
      padding:0 8px;
      height:25px;
      border-radius:10px;
      font-size:13px;
      font-weight:500;
      white-space:nowrap;
      ${active 
        ? 'background:#e6f4ea;color:#137333'   // xanh dịu Google style
        : 'background:#fce8e6;color:#c5221f'   // đỏ dịu
      }
    `;
  }

  getGui(): HTMLElement { return this.eGui; }
  refresh(): boolean { return false; }
  destroy(): void {}
}