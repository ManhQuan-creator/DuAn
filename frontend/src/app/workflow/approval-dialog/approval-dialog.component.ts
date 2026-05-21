import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TuiButtonModule } from '@taiga-ui/core';
import { POLYMORPHEUS_CONTEXT } from '@tinkoff/ng-polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';

export interface ApprovalDialogData {
  taskName: string;
  entryId: number;
}

export interface ApprovalDialogResult {
  action: string;   // APPROVE, RETURN, REJECT
  comment: string;
}

@Component({
  selector: 'app-approval-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TuiButtonModule],
  templateUrl: './approval-dialog.component.html',
  styleUrls: ['./approval-dialog.component.scss'],
})
export class ApprovalDialogComponent {
  private readonly context = inject<TuiDialogContext<ApprovalDialogResult | null, ApprovalDialogData>>(POLYMORPHEUS_CONTEXT);

  selectedAction = '';
  comment = '';
  showError = false;

  get data(): ApprovalDialogData {
    return this.context.data;
  }

  onCancel(): void {
    this.context.completeWith(null);
  }

  onConfirm(): void {
    if ((this.selectedAction === 'RETURN' || this.selectedAction === 'REJECT')
        && !this.comment.trim()) {
      this.showError = true;
      return;
    }
    this.showError = false;
    this.context.completeWith({
      action: this.selectedAction,
      comment: this.comment.trim()
    });
  }
}
