import { Component } from '@angular/core';
import { ICellRendererComp } from 'ag-grid-community';

@Component({
  selector: 'app-org-level-cell-render',
  imports: [],
  templateUrl: './org-level-cell-render.component.html',
  styleUrl: './org-level-cell-render.component.scss'
})
export class OrgLevelCellRenderComponent implements ICellRendererComp {
  private eGui!: HTMLElement;

  private static readonly LEVEL_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
    EVNNPC:       { label: 'Tổng công ty',       bg: '#e8f0fe', color: '#1967d2' },
    HQ_DEPT:      { label: 'Ban thuộc TCT',       bg: '#fce8e6', color: '#c5221f' },
    PC_COMPANY:   { label: 'Công ty điện lực',   bg: '#e6f4ea', color: '#137333' },
    PC_DEPT:      { label: 'Phòng ban',           bg: '#fef7e0', color: '#b06000' },
    HEADQUARTERS: { label: 'Tổng công ty',        bg: '#e8f0fe', color: '#1967d2' },
    SUBSIDIARY:   { label: 'Đơn vị thành viên',  bg: '#e6f4ea', color: '#137333' },
  };

  init(params: any): void {
    this.eGui = document.createElement('span');

    const level = params.value as string;
    const cfg = OrgLevelCellRenderComponent.LEVEL_CONFIG[level]
      ?? { label: level, bg: '#f1f5f9', color: '#475569' };

    this.eGui.textContent = cfg.label;
    this.eGui.style.cssText = `
      display:inline-flex;
      align-items:center;
      padding:0 8px;
      height:25px;
      border-radius:10px;
      font-size:13px;
      font-weight:500;
      white-space:nowrap;
      background:${cfg.bg};
      color:${cfg.color};
    `;
  }

  getGui(): HTMLElement { return this.eGui; }
  refresh(): boolean { return false; }
  destroy(): void {}
}