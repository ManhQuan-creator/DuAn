import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButtonModule } from '@taiga-ui/core';
import { AppDialogService } from '../shared/dialog.service';
import {
  PageHeaderBreadcrumb,
  PageHeaderComponent,
} from '../shared/components/page-header/page-header.component';
import {
  SelectOption,
  SingleSelectComponent,
} from '../shared/components/multi-select';

type LookupType = 'ENTRY' | 'TEMPLATE';

const BREADCRUMBS: PageHeaderBreadcrumb[] = [
  { label: 'Trang chủ', link: '' },
  { label: 'Hệ thống', link: '' },
  { label: 'Dump dữ liệu Grid', link: '' },
];

@Component({
  selector: 'app-grid-dump-debug',
  standalone: true,
  imports: [CommonModule, FormsModule, TuiButtonModule, PageHeaderComponent, SingleSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header
        title="Dump dữ liệu Grid (debug)"
        subtitle="Trả về JSON gộp: GRID_TEMPLATE.COLUMN_CONFIGS / COLUMN_GROUPS, GRID_ROW của template, GRID_DATA_ENTRY.ROW_DATA — phục vụ AI/dev khảo sát."
        [breadcrumbs]="breadcrumbs"
      ></app-page-header>

      <section class="card">
        <div class="control-row">
          <label class="field type-field">
            <span class="label">Loại</span>
            <app-single-select
              class="type-select"
              [options]="typeOptions"
              [(ngModel)]="lookupType"
              [clearable]="false"
              size="m"
            ></app-single-select>
          </label>

          <label class="field">
            <span class="label">{{ lookupType === 'TEMPLATE' ? 'Template ID' : 'Entry ID' }}</span>
            <input
              type="number"
              class="input"
              [(ngModel)]="idValue"
              (keydown.enter)="fetch()"
              [placeholder]="lookupType === 'TEMPLATE' ? 'VD: 141' : 'VD: 375'"
              min="1"
            />
          </label>

          <button
            tuiButton
            size="m"
            type="button"
            appearance="primary"
            [disabled]="!idValue || loading"
            (click)="fetch()"
          >
            {{ loading ? 'Đang tra cứu...' : 'Tra cứu' }}
          </button>

          <button
            tuiButton
            size="m"
            type="button"
            appearance="secondary"
            [disabled]="!jsonText"
            (click)="download()"
          >
            Tải JSON
          </button>

          <button
            tuiButton
            size="m"
            type="button"
            appearance="flat"
            [disabled]="!jsonText"
            (click)="copy()"
          >
            Sao chép
          </button>
        </div>

        <div *ngIf="error" class="error">{{ error }}</div>

        <div *ngIf="jsonText" class="meta">
          <span>Kích thước: {{ jsonSize }}</span>
          <span *ngIf="response?.entryId != null">entryId: {{ response.entryId }}</span>
          <span *ngIf="response?.templateId != null">templateId: {{ response.templateId }}</span>
          <span *ngIf="response?.rows != null">rows: {{ response.rows.length }}</span>
          <span *ngIf="response?.entryOrgCode">orgCode: {{ response.entryOrgCode }}</span>
        </div>

        <pre *ngIf="jsonText" class="json"><code>{{ jsonText }}</code></pre>

        <div *ngIf="!jsonText && !error && !loading" class="hint">
          Nhập Entry ID rồi bấm <strong>Tra cứu</strong> để xem JSON.
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .page {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px 24px 32px;
      }
      .card {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .control-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .field {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 40px;
      }
      .label {
        font-size: 13px;
        color: #374151;
        font-weight: 500;
        white-space: nowrap;
      }
      .input {
        width: 220px;
        height: 40px;
        box-sizing: border-box;
        padding: 0 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 14px;
        outline: none;
      }
      .type-select {
        width: 160px;
      }
      .input:focus {
        border-color: #2563eb;
      }
      .meta {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        font-size: 12px;
        color: #4b5563;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 8px 12px;
      }
      .error {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #b91c1c;
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 13px;
      }
      .json {
        background: #0b1021;
        color: #e5e7eb;
        padding: 16px;
        border-radius: 10px;
        max-height: 70vh;
        overflow: auto;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 12.5px;
        line-height: 1.55;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .hint {
        color: #6b7280;
        font-size: 13px;
      }
    `,
  ],
})
export class GridDumpDebugComponent {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(AppDialogService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly breadcrumbs = BREADCRUMBS;

  protected readonly typeOptions: SelectOption<LookupType>[] = [
    { value: 'ENTRY', label: 'Entry ID' },
    { value: 'TEMPLATE', label: 'Template ID' },
  ];

  protected lookupType: LookupType = 'ENTRY';
  protected idValue: number | null = null;
  protected loading = false;
  protected response: any = null;
  protected jsonText = '';
  protected error: string | null = null;

  protected get jsonSize(): string {
    const bytes = new Blob([this.jsonText]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  fetch(): void {
    if (!this.idValue || this.idValue <= 0) {
      this.error = `Vui lòng nhập ${this.lookupType === 'TEMPLATE' ? 'Template' : 'Entry'} ID hợp lệ`;
      this.jsonText = '';
      this.response = null;
      return;
    }
    const path = this.lookupType === 'TEMPLATE' ? 'templates' : 'entries';
    this.loading = true;
    this.error = null;
    this.http
      .get<any>(`/excelpro-service/v1/grid-debug/${path}/${this.idValue}`)
      .subscribe({
        next: (resp) => {
          this.response = resp?.data ?? resp;
          this.jsonText = JSON.stringify(this.response, null, 2);
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.response = null;
          this.jsonText = '';
          const msg = err.error?.message || err.message || 'Không tra cứu được dữ liệu';
          this.error = `${err.status} ${err.statusText}: ${msg}`;
          this.dialog.error(this.error, 'Tra cứu thất bại');
          this.cdr.markForCheck();
        },
      });
  }

  download(): void {
    if (!this.jsonText) return;
    const blob = new Blob([this.jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const prefix = this.lookupType === 'TEMPLATE' ? 'template' : 'entry';
    a.download = `grid-dump-${prefix}-${this.idValue}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  copy(): void {
    if (!this.jsonText) return;
    navigator.clipboard.writeText(this.jsonText).then(
      () => this.dialog.success('Đã sao chép JSON vào clipboard'),
      () => this.dialog.error('Không sao chép được — trình duyệt từ chối truy cập clipboard'),
    );
  }
}
