import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TuiDataListModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiComboBoxModule } from '@taiga-ui/kit';
import { SelectOption } from './select-option.model';

/**
 * Single-select có search dùng chung — wrap `tui-combo-box` của Taiga.
 *
 * - Input: `options: SelectOption<V>[]`
 * - CVA value: `V | null`. Tích hợp `[(ngModel)]` + `[formControl]`.
 * - Gõ trong ô input để filter options theo `label` + `searchText`.
 * - `strict=true` (default) → value phải thuộc options, không cho nhập tự do.
 * - `clearable = true` (default) → có option đầu list để xóa lựa chọn.
 *
 * Dùng khi field chỉ chọn 1 giá trị. Cần chọn nhiều → `<app-multi-select>` / `<app-grouped-multi-select>`.
 */
@Component({
  selector: 'app-single-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TuiComboBoxModule,
    TuiDataListModule,
    TuiTextfieldControllerModule,
  ],
  template: `
    <tui-combo-box
      [ngModel]="selectedOption"
      (ngModelChange)="onSelectionChange($event)"
      [(search)]="searchText"
      [stringify]="stringifyOption"
      [strict]="strict"
      [disabled]="disabled"
      [tuiTextfieldLabelOutside]="true"
      [tuiTextfieldSize]="size"
    >
      {{ placeholder }}
      <tui-data-list *tuiDataList>
        <button *ngIf="clearable" tuiOption [value]="null">
          {{ clearLabel }}
        </button>
        <button
          *ngFor="let opt of filteredOptions; trackBy: trackByValue"
          tuiOption
          [value]="opt"
          [disabled]="!!opt.disabled"
        >
          {{ opt.label }}
        </button>
        <div *ngIf="!filteredOptions.length" class="app-ss__empty">
          Không tìm thấy kết quả phù hợp
        </div>
      </tui-data-list>
    </tui-combo-box>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .app-ss__empty {
      padding: 12px 16px;
      font-size: 0.8rem;
      color: #64748b;
      text-align: center;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SingleSelectComponent),
      multi: true,
    },
  ],
})
export class SingleSelectComponent<V = string> implements ControlValueAccessor {
  @Input() set options(value: SelectOption<V>[]) {
    const next = value ?? [];
    if (next === this._options) return;
    this._options = next;
    this.syncSelectedFromValue();
  }
  get options(): SelectOption<V>[] { return this._options; }

  @Input() placeholder = 'Chọn...';
  @Input() clearable = true;
  @Input() clearLabel = '-- Chưa chọn --';
  @Input() strict = true;
  @Input() size: 's' | 'm' | 'l' = 'm';

  disabled = false;
  searchText: string | null = '';

  private _options: SelectOption<V>[] = [];
  private _value: V | null = null;

  selectedOption: SelectOption<V> | null = null;

  private onChange: (value: V | null) => void = () => {};
  private onTouched: () => void = () => {};

  readonly stringifyOption = (opt: SelectOption<V> | null): string => opt?.label ?? '';
  readonly trackByValue = (_: number, opt: SelectOption<V>): any => opt.value;

  /** Options đã filter theo `searchText` — match `label` hoặc `searchText` của option. */
  get filteredOptions(): SelectOption<V>[] {
    const q = (this.searchText ?? '').trim().toLowerCase();
    if (!q) return this._options;
    return this._options.filter(o => {
      const hay = `${o.label} ${o.searchText ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }

  onSelectionChange(selected: SelectOption<V> | null): void {
    this.selectedOption = selected ?? null;
    this._value = selected ? selected.value : null;
    this.onChange(this._value);
    this.onTouched();
  }

  /**
   * Khi user click vào combo-box → Taiga focus inner `<input>` → focusin event bubble
   * lên host. Bắt event này + select toàn bộ text để keystroke đầu tiên replace luôn
   * giá trị cũ (UX giống Excel cell hay native browser url-bar).
   *
   * Chỉ chạy khi target là `<input>` (bỏ qua focus vào button/dropdown content).
   * Không cần defer (focusin fire SAU khi focus đã set, input value đã sẵn sàng).
   */
  @HostListener('focusin', ['$event'])
  onHostFocusIn(event: FocusEvent): void {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.value) {
      target.select();
    }
  }

  // ─── ControlValueAccessor ──────────────────────────────
  writeValue(value: V | null | undefined): void {
    this._value = value ?? null;
    this.syncSelectedFromValue();
  }
  registerOnChange(fn: (value: V | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  private syncSelectedFromValue(): void {
    if (this._value == null || !this._options.length) {
      this.selectedOption = null;
      return;
    }
    this.selectedOption = this._options.find(o => o.value === this._value) ?? null;
  }
}
