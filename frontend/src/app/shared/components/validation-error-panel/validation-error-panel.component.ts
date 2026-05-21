import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiSvgModule } from '@taiga-ui/core';

export interface ValidationErrorEntry {
  /** `row_code` của dòng vi phạm. */
  rowCode: string;
  /** Tên dòng (row_name) — nếu trống fallback rowCode. */
  rowName: string;
  /** Field name của cột vi phạm. */
  field: string;
  /** Header name của cột — đẹp hơn raw field cho user. */
  columnName: string;
  /** Error message từ validation rule. */
  message: string;
}

/**
 * Panel hiển thị danh sách cell vi phạm validation. Dùng chung Builder + Render.
 *
 * - Collapsed mặc định: hiện badge "N ô vi phạm validation" + nút mở rộng.
 * - Expanded: list chi tiết (dòng, cột, lỗi). Click 1 entry → emit `(entryClick)` để
 *   parent navigate focus đến cell đó.
 */
@Component({
  selector: 'app-validation-error-panel',
  standalone: true,
  imports: [CommonModule, TuiSvgModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (errors.length > 0) {
      <div class="vep">
        <button
          type="button"
          class="vep__header"
          (click)="toggle.emit()"
          [attr.aria-expanded]="expanded"
        >
          <tui-svg src="tuiIconAlertCircle" class="vep__icon"></tui-svg>
          <span class="vep__count">{{ errors.length }} ô vi phạm validation</span>
          <tui-svg
            [src]="expanded ? 'tuiIconChevronUp' : 'tuiIconChevronDown'"
            class="vep__chevron"
          ></tui-svg>
        </button>
        @if (expanded) {
          <ul class="vep__list">
            @for (err of errors; track err.rowCode + ':' + err.field) {
              <li class="vep__item" (click)="entryClick.emit(err)">
                <code class="vep__row">{{ err.rowCode }}</code>
                <span class="vep__sep">·</span>
                <span class="vep__col">{{ err.columnName }}</span>
                <span class="vep__sep">→</span>
                <span class="vep__msg">{{ err.message }}</span>
              </li>
            }
          </ul>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .vep {
        margin-top: 4px;
        border: 1px solid #fecaca;
        background: #fef2f2;
        border-radius: 6px;
        font-size: 12px;
      }
      .vep__header {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 6px 10px;
        background: transparent;
        border: none;
        cursor: pointer;
        color: #dc2626;
        font-weight: 600;
        text-align: left;
      }
      .vep__header:hover {
        background: #fee2e2;
      }
      .vep__icon {
        width: 14px;
        height: 14px;
        color: #dc2626;
      }
      .vep__count {
        flex: 1;
      }
      .vep__chevron {
        width: 14px;
        height: 14px;
      }
      .vep__list {
        list-style: none;
        margin: 0;
        padding: 4px 0;
        border-top: 1px solid #fecaca;
        max-height: 240px;
        overflow-y: auto;
      }
      .vep__item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        cursor: pointer;
        color: #7f1d1d;
      }
      .vep__item:hover {
        background: #fee2e2;
      }
      .vep__row {
        font-family: 'JetBrains Mono', 'Consolas', monospace;
        font-size: 11px;
        padding: 1px 5px;
        background: #fff;
        border-radius: 3px;
        color: #2563eb;
      }
      .vep__sep {
        color: #9ca3af;
      }
      .vep__col {
        font-weight: 500;
      }
      .vep__msg {
        color: #dc2626;
      }
    `,
  ],
})
export class ValidationErrorPanelComponent {
  @Input() errors: ValidationErrorEntry[] = [];
  @Input() expanded = false;
  @Output() readonly toggle = new EventEmitter<void>();
  @Output() readonly entryClick = new EventEmitter<ValidationErrorEntry>();
}
