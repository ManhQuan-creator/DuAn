import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TuiDataListModule, TuiTextfieldControllerModule, TuiSvgModule } from '@taiga-ui/core';
import { TuiMultiSelectModule } from '@taiga-ui/kit';
import { SelectOption } from './select-option.model';

/**
 * Multi-select dùng chung — wrap `tui-multi-select` của Taiga.
 *
 * - Input: `options: SelectOption<V>[]`
 * - CVA value: `V[]` (array of `option.value`). Tích hợp `[(ngModel)]` + `[formControl]`.
 * - Hiển thị tất cả options trong dropdown, với dấu tích cho options đã chọn.
 *
 * Dùng khi list phẳng, không cần grouping. Cần grouping → dùng `<app-grouped-multi-select>`.
 */
@Component({
  selector: 'app-multi-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TuiMultiSelectModule,
    TuiDataListModule,
    TuiTextfieldControllerModule,
    TuiSvgModule,
  ],
  template: `
    <tui-multi-select
      [ngModel]="selectedOptions"
      (ngModelChange)="onSelectionChange($event)"
      [(search)]="searchText"
      [stringify]="stringifyOption"
      [editable]="true"
      [disabled]="disabled"
      [tuiTextfieldLabelOutside]="true"
      [tuiTextfieldCleaner]="true"
      [expandable]="true"
      [rows]="1"
      [tuiTextfieldSize]="size"
      tuiDropdownLimitWidth="fixed"
    >
      {{ placeholder }}
      <tui-data-list *tuiDataList>
        <button
          *ngFor="let opt of filteredOptions; trackBy: trackByValue"
          tuiOption
          [value]="opt"
          [disabled]="!!opt.disabled"
        >
          {{ opt.label }}
          <tui-svg *ngIf="selectedValuesSet.has(opt.value)" src="tuiIconCheck" class="check-icon"></tui-svg>
        </button>
        <div *ngIf="!filteredOptions.length" class="app-multi-select__empty">
          Không tìm thấy kết quả phù hợp
        </div>
      </tui-data-list>
    </tui-multi-select>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .app-multi-select__empty {
      padding: 12px 16px;
      font-size: 0.8rem;
      color: #64748b;
      text-align: center;
    }
    .check-icon {
      margin-left: 8px;
      color: #000000;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MultiSelectComponent),
      multi: true,
    },
  ],
})
export class MultiSelectComponent<V = string> implements ControlValueAccessor {
  @Input() set options(value: SelectOption<V>[]) {
    const next = value ?? [];
    // Defensive: reference-equal → skip toàn bộ để tránh Angular CD loop
    // khi parent vô ý tạo mảng mới mỗi CD cycle (vd. dùng getter).
    if (next === this._options) return;
    this._options = next;
    this.syncSelectedFromValues();
  }
  get options(): SelectOption<V>[] { return this._options; }

  @Input() placeholder = 'Chọn...';
  @Input() size: 's' | 'm' | 'l' = 'm';

  disabled = false;

  private _options: SelectOption<V>[] = [];
  private _values: V[] = [];

  selectedOptions: SelectOption<V>[] = [];
  selectedValuesSet: Set<V> = new Set();
  /** `null` được Taiga set khi reset hoặc clear → cần handle null. */
  searchText: string | null = '';

  private onChange: (value: V[]) => void = () => {};
  private onTouched: () => void = () => {};

  readonly stringifyOption = (opt: SelectOption<V>): string => opt?.label ?? '';
  readonly trackByValue = (_: number, opt: SelectOption<V>): any => opt.value;

  /** Options đã filter theo `searchText` (match `label` + `searchText` của option). */
  get filteredOptions(): SelectOption<V>[] {
    const q = (this.searchText ?? '').trim().toLowerCase();
    return this._options.filter(o => {
      if (!q) return true;
      const hay = `${o.label} ${o.searchText ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }

  onSelectionChange(selected: SelectOption<V>[]): void {
    this.selectedOptions = selected ?? [];
    this._values = this.selectedOptions.map(o => o.value);
    this.selectedValuesSet = new Set(this._values);
    this.onChange(this._values);
    this.onTouched();
  }

  // ─── ControlValueAccessor ──────────────────────────────
  writeValue(value: V[] | null | undefined): void {
    this._values = Array.isArray(value) ? [...value] : [];
    this.syncSelectedFromValues();
  }
  registerOnChange(fn: (value: V[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  private syncSelectedFromValues(): void {
    if (!this._options.length) {
      this.selectedOptions = [];
      this.selectedValuesSet = new Set();
      return;
    }
    const byValue = new Map(this._options.map(o => [o.value, o]));
    this.selectedOptions = this._values
      .map(v => byValue.get(v))
      .filter((o): o is SelectOption<V> => !!o);
    this.selectedValuesSet = new Set(this._values);
  }
}
