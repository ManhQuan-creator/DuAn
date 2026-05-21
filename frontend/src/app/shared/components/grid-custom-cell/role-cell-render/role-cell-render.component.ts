import { Component } from '@angular/core';
import { ICellRendererComp } from 'ag-grid-community';

@Component({
  selector: 'app-role-cell-render',
  imports: [],
  templateUrl: './role-cell-render.component.html',
  styleUrl: './role-cell-render.component.scss'
})
export class RoleCellRenderComponent implements ICellRendererComp {
  private eGui!: HTMLElement;

  init(params: any): void {
    this.eGui = document.createElement('div');

    this.eGui.style.cssText = `
      display:flex;
      flex-wrap:wrap;
      gap:4px;
      align-items:center;
      height:100%;
    `;

    const roles: string[] = params.value || [];

    // mapping màu theo semantic
    const roleColorMap: Record<string, { bg: string; color: string }> = {
      admin:         { bg: '#fce8e6', color: '#c5221f' }, // đỏ (quyền cao)
      viewer:        { bg: '#f1f3f4', color: '#3c4043' }, // xám (read-only)
      editor:        { bg: '#e8f0fe', color: '#1967d2' }, // xanh dương
      planner:       { bg: '#e6f4ea', color: '#137333' }, // xanh lá
      reviewer:      { bg: '#fef7e0', color: '#b06000' }, // vàng
      director:      { bg: '#f3e8fd', color: '#6b21a8' }, // tím
      board_member:  { bg: '#e0f2fe', color: '#0369a1' }  // xanh cyan
    };

    roles.forEach((roleRaw) => {
      const badge = document.createElement('span');

      // normalize role
      let role = (roleRaw || '').toLowerCase().trim();

      // fix typo phổ biến
      if (role === 'amin') role = 'admin';

      const color = roleColorMap[role] || { bg: '#f1f3f4', color: '#3c4043' };

      // format label cho đẹp (snake_case → Title Case)
      const label = role
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      badge.textContent = label;

      badge.style.cssText = `
        display:inline-flex;
        align-items:center;
        padding:0 8px;
        height:25px;
        border-radius:10px;
        font-size:13px;
        font-weight:500;
        white-space:nowrap;
        background:${color.bg};
        color:${color.color};
      `;

      this.eGui.appendChild(badge);
    });
  }

  getGui(): HTMLElement { return this.eGui; }
  refresh(): boolean { return false; }
  destroy(): void {}
}