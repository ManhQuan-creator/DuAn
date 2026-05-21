import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { POLYMORPHEUS_CONTEXT } from '@tinkoff/ng-polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';

export interface ConfirmDialogData {
  title?: string;
  message: string;
  status?: 'info' | 'success' | 'error' | 'warning';
  confirmText?: string;
  cancelText?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cd-dialog">
      <div class="cd-icon-wrap" [ngClass]="'cd-icon--' + (data.status || 'info')">
        <span class="cd-icon">{{ icon }}</span>
      </div>
      <div class="cd-title">{{ data.title || 'Xác nhận' }}</div>
      <div class="cd-message">{{ data.message }}</div>
      <div class="cd-actions">
        <button class="cd-btn cd-btn--cancel" (click)="cancel()">
          {{ data.cancelText || 'Hủy' }}
        </button>
        <button class="cd-btn" [ngClass]="'cd-btn--' + (data.status || 'info')" (click)="confirm()">
          {{ data.confirmText || 'Xác nhận' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .cd-dialog {
      text-align: center;
      padding: 24px 20px 20px;
    }
    .cd-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 16px;
    }
    .cd-icon--info    { background: #e8f0fe; color: #1a73e8; }
    .cd-icon--success { background: #e6f4ea; color: #1e8e3e; }
    .cd-icon--error   { background: #fce8e6; color: #d93025; }
    .cd-icon--warning { background: #fef7e0; color: #f9a825; }

    .cd-title {
      font-size: 17px;
      font-weight: 700;
      color: #202124;
      margin-bottom: 8px;
    }
    .cd-message {
      font-size: 14px;
      color: #5f6368;
      line-height: 1.5;
      margin-bottom: 24px;
      white-space: pre-line;
    }
    .cd-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
    }
    .cd-btn {
      padding: 9px 28px;
      border-radius: 8px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .cd-btn--cancel {
      background: #f1f3f4;
      color: #5f6368;
    }
    .cd-btn--cancel:hover { background: #e8eaed; }
    .cd-btn--info    { background: #1a73e8; color: #fff; }
    .cd-btn--info:hover { background: #1557b0; }
    .cd-btn--success { background: #1e8e3e; color: #fff; }
    .cd-btn--success:hover { background: #137333; }
    .cd-btn--error   { background: #d93025; color: #fff; }
    .cd-btn--error:hover { background: #b3261e; }
    .cd-btn--warning { background: #f9a825; color: #fff; }
    .cd-btn--warning:hover { background: #f57f17; }
  `]
})
export class ConfirmDialogComponent {
  readonly data: ConfirmDialogData;

  constructor(
    @Inject(POLYMORPHEUS_CONTEXT)
    private readonly context: TuiDialogContext<boolean, ConfirmDialogData>
  ) {
    this.data = context.data;
  }

  get icon(): string {
    switch (this.data.status) {
      case 'success': return '\u2713';
      case 'error':   return '!';
      case 'warning': return '!';
      default:        return '?';
    }
  }

  cancel(): void {
    this.context.completeWith(false);
  }

  confirm(): void {
    this.context.completeWith(true);
  }
}
