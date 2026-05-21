import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ITooltipAngularComp } from 'ag-grid-angular';
import { ITooltipParams } from 'ag-grid-community';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tt" [class.tt--header]="isHeaderTooltip" [class.tt--cell]="!isHeaderTooltip">

      <!-- HEADER tooltip — DataField + Excel + Công thức cột -->
      <ng-container *ngIf="isHeaderTooltip; else cellTooltip">
        <div class="tt__row">
          <span class="tt__label">DataField:</span>
          <code class="tt__code tt__code--blue">{{ field }}</code>
          <ng-container *ngIf="excelCol">
            <span class="tt__sep">—</span>
            <span class="tt__label">Excel:</span>
            <code class="tt__code tt__code--purple">{{ excelCol }}</code>
          </ng-container>
        </div>
        <div class="tt__formula-block" *ngIf="colFormula">
          <div class="tt__formula-title">Công thức cột:</div>
          <code class="tt__code tt__code--block">{{ colFormula }}</code>
        </div>
      </ng-container>

      <!-- CELL tooltip — formula/error/dropdown info. Validation error KHÔNG render ở đây
           (border đỏ + app-validation-error-panel đã đủ; tooltip validation hay stale). -->
      <ng-template #cellTooltip>
        <div class="tt__title">{{ headerName }}</div>

        <ng-container *ngIf="formulaError">
          <div class="tt__error-line">
            <span>&#10060;</span>
            <span class="tt__error-code">Lỗi: {{ formulaError }}</span>
          </div>
          <div class="tt__error-desc">{{ errorDescription }}</div>
          <div class="tt__error-formula" *ngIf="cellFormula || colFormula">
            Công thức: <code>{{ cellFormula || colFormula }}</code>
          </div>
        </ng-container>

        <ng-container *ngIf="dropdownType && !cellFormula && !formulaError">
          <div class="tt__row">
            <span class="tt__dot tt__dot--purple"></span>
            <span class="tt__chip-label tt__chip-label--purple">Dropdown: {{ dropdownType }}</span>
          </div>
        </ng-container>

        <ng-container *ngIf="cellFormula && !formulaError">
          <div class="tt__row">
            <span class="tt__dot tt__dot--orange"></span>
            <span class="tt__chip-label tt__chip-label--orange">Công thức riêng (Cell):</span>
          </div>
          <code class="tt__code tt__code--block tt__code--orange">{{ cellFormula }}</code>
        </ng-container>

        <ng-container *ngIf="colFormula && !cellFormula && !dropdownType && !formulaError">
          <div class="tt__row">
            <span class="tt__dot tt__dot--blue"></span>
            <span class="tt__chip-label tt__chip-label--blue">Công thức cột:</span>
          </div>
          <code class="tt__code tt__code--block">{{ colFormula }}</code>
        </ng-container>

        <ng-container *ngIf="colFormula && cellFormula && !formulaError">
          <div class="tt__origin">(Gốc: <span class="tt__strike">{{ colFormula }}</span>)</div>
        </ng-container>

        <!-- Giá trị gốc — hiện khi cell có format truncation (decimals / percent),
             giúp user thấy raw đầy đủ vì display có thể đã round/×100. -->
        <ng-container *ngIf="rawValueDisplay && !formulaError">
          <div class="tt__row">
            <span class="tt__dot tt__dot--green"></span>
            <span class="tt__chip-label tt__chip-label--green">Giá trị gốc:</span>
            <code class="tt__code tt__code--green">{{ rawValueDisplay }}</code>
          </div>
        </ng-container>
      </ng-template>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      pointer-events: none;
    }

    /* ============================================================
     * Wrapper chung — TẤT CẢ background/padding/box-shadow chỉnh ở đây.
     * ============================================================ */
    .tt {
      max-width: 22rem;
      border-radius: 8px;
      transition: opacity 0.15s ease-in-out;
    }

    /* === HEADER tooltip variant === */
    .tt--header {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      padding: 10px 14px;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    /* === CELL tooltip variant === */
    .tt--cell {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      padding: 12px 14px;
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    /* ===== Row chung ===== */
    .tt__row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      font-size: 12px;
    }
    .tt__sep { color: #cbd5e1; font-weight: 400; }
    .tt__label {
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-size: 11px;
    }
    .tt__title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.04em;
      padding-bottom: 6px;
      border-bottom: 1px solid #f1f5f9;
      margin-bottom: 4px;
    }

    /* ===== Code chip ===== */
    .tt__code {
      font-family: 'JetBrains Mono', 'Consolas', monospace;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #0f172a;
    }
    .tt__code--blue   { background: #dbeafe; color: #1d4ed8; }
    .tt__code--purple { background: #ede9fe; color: #6d28d9; }
    .tt__code--orange { background: #ffedd5; color: #c2410c; }
    .tt__code--block {
      display: block;
      padding: 6px 8px;
      word-break: break-word;
      white-space: pre-wrap;
    }

    /* ===== Formula block (header) ===== */
    .tt__formula-block {
      border-top: 1px solid #f1f5f9;
      padding-top: 6px;
      margin-top: 2px;
    }
    .tt__formula-title {
      font-size: 11px;
      font-weight: 700;
      color: #2563eb;
      margin-bottom: 4px;
    }

    /* ===== Cell variants ===== */
    .tt__dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    }
    .tt__dot--purple { background: #6d28d9; }
    .tt__dot--orange { background: #f97316; }
    .tt__dot--blue   { background: #3b82f6; }

    .tt__chip-label {
      font-size: 11px;
      font-weight: 700;
    }
    .tt__chip-label--purple { color: #6d28d9; }
    .tt__chip-label--orange { color: #c2410c; }
    .tt__chip-label--blue   { color: #2563eb; }
    .tt__chip-label--green  { color: #15803d; }
    .tt__dot--green         { background: #15803d; }
    .tt__code--green        { background: #dcfce7; color: #15803d; }

    .tt__error-line  { display: flex; align-items: center; gap: 6px; }
    .tt__error-code  { color: #dc2626; font-weight: 700; font-size: 12px; }
    .tt__error-desc  { color: #991b1b; font-size: 12px; }
    .tt__error-formula {
      font-size: 11px; color: #6b7280; margin-top: 4px;
      code { font-family: monospace; font-size: 11px; }
    }
    .tt__origin {
      font-size: 11px; color: #9ca3af; margin-top: 4px;
    }
    .tt__strike { text-decoration: line-through; font-family: monospace; }
  `]
})
export class FormulaTooltipComponent implements ITooltipAngularComp {
  params!: ITooltipParams & { colDef: any };

  /** True khi tooltip render cho HEADER (không phải cell) — đổi template tương ứng. */
  isHeaderTooltip = false;

  /** Header tooltip fields */
  field: string = '';
  excelCol: string = '';

  headerName: string = '';
  colFormula: string = '';
  cellFormula: string | null = null;
  dropdownType: string | null = null;
  formulaError: string | null = null;
  errorDescription: string = '';
  /** Raw value đầy đủ (vi-VN format, max 10 decimals) — chỉ set khi cell có format
   *  truncation (decimals / percent). Empty → không render section "Giá trị gốc". */
  rawValueDisplay: string = '';
  private static readonly ERROR_DESCRIPTIONS: { [key: string]: string } = {
    '#SYNTAX!': 'Cú pháp công thức không hợp lệ.',
    '#REF!': 'Tham chiếu không tìm thấy.',
    '#CIRCULAR!': 'Tham chiếu vòng — công thức tham chiếu lẫn nhau.',
    '#DIV/0!': 'Chia cho 0.',
    '#VALUE!': 'Kết quả không hợp lệ (NaN).',
    '#NOTEMPLATE!': 'Mã báo cáo không tồn tại.',
    '#NODATA!': 'Chưa có dữ liệu cho kỳ này.',
    '#NOROW!': 'Không tìm thấy dòng tương ứng.',
    '#NOCOL!': 'Không tìm thấy cột tương ứng.',
  };

  agInit(params: ITooltipParams & { colDef: any }): void {
    this.params = params;

    // BẮT BUỘC reset toàn bộ state field trước khi populate — AG Grid reuse tooltip
    // component instance giữa các cell, nếu không reset thì tooltipValue cũ (vd
    // validationMessage cell trước) leak sang cell sau (cell hiện tại có thể đã valid
    // nhưng tooltip vẫn hiện message lỗi cũ).
    this.formulaError = null;
    this.errorDescription = '';
    this.cellFormula = null;
    this.dropdownType = null;
    this.colFormula = '';
    this.excelCol = '';
    this.field = '';
    this.rawValueDisplay = '';

    // AG Grid: params.location = 'header' | 'headerGroup' | 'cell' | ...
    this.isHeaderTooltip = (params as any).location === 'header'
      || (params as any).location === 'headerGroup';

    this.headerName = params.colDef?.headerName || 'Thông tin';
    this.field = params.colDef?.field || '';
    // excelCol được lưu trong userData của colDef (từ ColumnConfig).
    this.excelCol = (params.colDef as any)?.userData?.excelCol || '';
    this.colFormula = (params.colDef as any)?.['userData']?.formula || '';

    if (this.isHeaderTooltip) return;  // Header chỉ cần field + excelCol + colFormula.

    const field = params.colDef?.field;
    if (field) {
        this.cellFormula = params.data?._cellConfig?.[field]?.formula || null;
        this.dropdownType = params.data?._cellConfig?.[field]?.dropdown?.catalogType || null;

        // AG Grid: `params.value` cho tooltip = kết quả của `tooltipValueGetter`.
        // - `#XXX!` → formula error → render description block.
        // - 'trigger' (sentinel cho cell có formula/dropdown/datePicker metadata) → tooltip
        //   chỉ render header + metadata sections (không phải error).
        const tooltipValue = params.value;
        if (typeof tooltipValue === 'string' && tooltipValue.startsWith('#')) {
          this.formulaError = tooltipValue;
          this.errorDescription = FormulaTooltipComponent.ERROR_DESCRIPTIONS[tooltipValue] || 'Lỗi không xác định.';
        }

        // Compute "Giá trị gốc" cho cells có format truncation (decimals/percent).
        // Đọc qua AG Grid `getCellValue` để cover formula cells (raw = shadow result).
        const cellFmt = params.data?._cellConfig?.[field]?.format;
        if (cellFmt && (cellFmt.decimals != null || cellFmt.percent)) {
          let raw: any;
          try {
            raw = (params as any).api?.getCellValue({ rowNode: (params as any).node, colKey: field })
              ?? params.data?.[field];
          } catch {
            raw = params.data?.[field];
          }
          const num = Number(raw);
          if (Number.isFinite(num)) {
            this.rawValueDisplay = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 10 }).format(num);
          }
        }
    }
  }
}