// Custom AG Grid header for catalog columns — shows column name + pencil edit icon + delete icon
export class CatalogHeaderComponent {
  private eGui!: HTMLElement;

  init(params: any): void {
    this.eGui = document.createElement('div');
    this.eGui.style.cssText =
      'display:flex;align-items:center;gap:4px;width:100%;';
    // Tooltip render bởi AG Grid via colDef.headerTooltip + tooltipShowDelay=0.

    const label = document.createElement('span');
    label.textContent = params.displayName;
    label.style.cssText =
      'flex:1;white-space:normal;word-break:break-word;line-height:1.2;';
    this.eGui.appendChild(label);

    const editBtn = document.createElement('span');
    editBtn.innerHTML = '✎';
    editBtn.style.color = '#ffffff';
    editBtn.title = 'Sửa cấu hình cột';
    editBtn.style.cssText = `
      cursor:pointer;
      font-size:13px;
      font-weight:700;
      opacity:0.7;
      transition:all 0.2s ease;
      padding:2px 6px;
      border-radius:6px;
      border:1px solid transparent;
      background:#164397;
    `;

    editBtn.addEventListener('mouseenter', () => {
      editBtn.style.opacity = '1';
      editBtn.style.background = '#164397';
      editBtn.style.borderColor = '#ffffff';
    });

    editBtn.addEventListener('mouseleave', () => {
      editBtn.style.opacity = '0.8';
      editBtn.style.background = '#164397';
      editBtn.style.borderColor = '#164397';
    });
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      params.onEditColumn?.();
    });
    this.eGui.appendChild(editBtn);

    const deleteBtn = document.createElement('span');
    deleteBtn.innerHTML = '&#10005;';
    deleteBtn.title = 'Xóa cột';
    deleteBtn.style.cssText = `
      cursor:pointer;
      font-size:13px;
      font-weight:700;
      opacity:0.7;
      transition:all 0.2s ease;
      padding:2px 6px;
      border-radius:6px;
      border:1px solid transparent;
      background:#164397;
      color:#ff4d4f;
    `;

    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.opacity = '1';
      deleteBtn.style.background = '#164397';
      deleteBtn.style.borderColor = '#ffffff';
    });

    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.opacity = '0.8';
      deleteBtn.style.background = '#164397';
      deleteBtn.style.borderColor = '#164397';
    });
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      params.onDeleteColumn?.();
    });
    this.eGui.appendChild(deleteBtn);
  }

  getGui(): HTMLElement {
    return this.eGui;
  }
  refresh(): boolean {
    return false;
  }
  destroy(): void {}
}
