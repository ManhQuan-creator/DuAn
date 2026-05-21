import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TuiButtonModule } from '@taiga-ui/core';

export interface AgGridHeaderAction {
  id: string;
  label: string;
  icon?: string;
  appearance?: string;
  disabled?: boolean;
  visible?: boolean;
  className?: string;
}

@Component({
  selector: 'app-ag-grid-header',
  standalone: true,
  imports: [CommonModule, TuiButtonModule],
  templateUrl: './ag-grid-header.component.html',
  styleUrl: './ag-grid-header.component.scss'
})
export class AgGridHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() actions: AgGridHeaderAction[] = [];

  @Output() actionClick = new EventEmitter<string>();

  get visibleActions(): AgGridHeaderAction[] {
    return this.actions.filter((action) => action.visible !== false);
  }

  onActionClick(action: AgGridHeaderAction): void {
    if (action.disabled) return;
    this.actionClick.emit(action.id);
  }
}
