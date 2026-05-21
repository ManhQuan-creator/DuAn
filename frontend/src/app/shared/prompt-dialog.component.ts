import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { POLYMORPHEUS_CONTEXT } from '@tinkoff/ng-polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';

export interface PromptFieldOption {
  value: string;
  label: string;
}

export interface PromptField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'select';
  options?: PromptFieldOption[];
  /** 1 = chiếm 1 cột (col-6), 2 = chiếm cả hàng (col-12). Mặc định: 1 */
  colSpan?: 1 | 2;
}

export interface PromptDialogData {
  title?: string;
  icon?: string;
  status?: 'info' | 'success' | 'error' | 'warning';
  fields: PromptField[];
  initialValues?: Record<string, string>;
  confirmText?: string;
  cancelText?: string;
}

@Component({
  selector: 'app-prompt-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pd-dialog">
      <div class="pd-icon-wrap" [ngClass]="'pd-icon--' + (data.status || 'info')">
        <span class="pd-icon">{{ data.icon || '+' }}</span>
      </div>
      <div class="pd-title">{{ data.title || 'Nhập thông tin' }}</div>

      <div class="pd-fields">
        <div
          *ngFor="let field of data.fields"
          class="pd-field"
          [class.pd-field--full]="field.colSpan === 2"
        >
          <label class="pd-label">
            {{ field.label }}
            <span *ngIf="field.required" class="pd-required">*</span>
          </label>
          <select
            *ngIf="field.type === 'select'; else textInput"
            class="pd-input pd-select"
            [(ngModel)]="values[field.key]"
          >
            <option *ngIf="!field.required" value="">— Không chọn —</option>
            <option *ngFor="let opt of field.options" [value]="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <ng-template #textInput>
            <input
              class="pd-input"
              [placeholder]="field.placeholder || ''"
              [(ngModel)]="values[field.key]"
              (keydown.enter)="submit()"
            />
          </ng-template>
        </div>
      </div>

      <div class="pd-actions">
        <button class="pd-btn pd-btn--cancel" (click)="cancel()">
          {{ data.cancelText || 'Hủy' }}
        </button>
        <button class="pd-btn pd-btn--confirm" (click)="submit()">
          {{ data.confirmText || 'Tạo mới' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .pd-dialog {
      text-align: center;
      padding: 24px 20px 20px;
    }
    .pd-icon-wrap {
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
    .pd-icon--info    { background: #e8f0fe; color: #1a73e8; }
    .pd-icon--success { background: #e6f4ea; color: #1e8e3e; }
    .pd-icon--error   { background: #fce8e6; color: #d93025; }
    .pd-icon--warning { background: #fef7e0; color: #f9a825; }

    .pd-title {
      font-size: 17px;
      font-weight: 700;
      color: #202124;
      margin-bottom: 20px;
    }
    .pd-fields {
      text-align: left;
      margin-bottom: 24px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 16px;
    }
    .pd-field {
      min-width: 0;
    }
    .pd-field--full {
      grid-column: span 2;
    }
    .pd-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #202124;
      margin-bottom: 6px;
    }
    .pd-required {
      color: #d93025;
    }
    .pd-input {
      width: 100%;
      padding: 10px 12px;
      border: 1.5px solid #dadce0;
      border-radius: 8px;
      font-size: 14px;
      color: #202124;
      background: #fff;
      outline: none;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }
    .pd-input:focus {
      border-color: #1a73e8;
      box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.15);
    }
    .pd-input::placeholder {
      color: #9aa0a6;
    }
    .pd-select {
      appearance: auto;
      cursor: pointer;
    }
    .pd-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
    }
    .pd-btn {
      padding: 9px 28px;
      border-radius: 8px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .pd-btn--cancel {
      background: #f1f3f4;
      color: #5f6368;
    }
    .pd-btn--cancel:hover { background: #e8eaed; }
    .pd-btn--confirm {
      background: #1a73e8;
      color: #fff;
    }
    .pd-btn--confirm:hover { background: #1557b0; }
  `]
})
export class PromptDialogComponent {
  readonly data: PromptDialogData;
  values: Record<string, string> = {};

  constructor(
    @Inject(POLYMORPHEUS_CONTEXT)
    private readonly context: TuiDialogContext<Record<string, string> | null, PromptDialogData>
  ) {
    this.data = context.data;
    for (const field of this.data.fields) {
      this.values[field.key] = this.data.initialValues?.[field.key] ?? '';
    }
  }

  cancel(): void {
    this.context.completeWith(null);
  }

  submit(): void {
    for (const field of this.data.fields) {
      if (field.required && !this.values[field.key]?.trim()) {
        return;
      }
    }
    this.context.completeWith(this.values);
  }
}
