import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TuiDataListModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiMultiSelectModule } from '@taiga-ui/kit';
import { SelectOption } from './select-option.model';

interface OptionGroup<V> {
  key: string;
  label: string | null;
  items: SelectOption<V>[];
}

/**
 * Multi-select có grouping — options được nhóm theo `option.group`.
 *
 * - Input: `options: SelectOption<V>[]` (mỗi option có thể có `group`, `groupLabel`).
 * - CVA value: `V[]`. Tích hợp `[(ngModel)]` + `[formControl]`.
 * - Tự động ẩn option đã chọn, filter theo search (match `label` + `searchText`).
 * - Option không có `group` → gộp vào nhóm `__OTHER__` không có header.
 */
@Component({
  selector: 'app-grouped-multi-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TuiMultiSelectModule,
    TuiDataListModule,
    TuiTextfieldControllerModule,
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
      [tuiTextfieldSize]="size"
      tuiDropdownLimitWidth="fixed"
    >
      {{ placeholder }}
      <tui-data-list *tuiDataList>
        <ng-container *ngIf="filteredGroups.length; else emptyState">
          <ng-container *ngFor="let g of filteredGroups; trackBy: trackByGroup">
            <div *ngIf="g.label" class="app-gms__group-header">{{ g.label }}</div>
            <button
              *ngFor="let opt of g.items; trackBy: trackByValue"
              tuiOption
              [value]="opt"
              [disabled]="!!opt.disabled"
              class="app-gms__option"
              [class.app-gms__option--indented]="g.label"
            >
              {{ opt.label }}
            </button>
          </ng-container>
        </ng-container>
        <ng-template #emptyState>
          <div class="app-gms__empty">Không tìm thấy kết quả phù hợp</div>
        </ng-template>
      </tui-data-list>
    </tui-multi-select>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .app-gms__group-header {
      padding: 8px 14px 4px;
      font-size: 0.7rem;
      font-weight: 700;
      color: #2563eb;
      background: #f1f5ff;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      border-top: 1px solid #e5edff;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .app-gms__group-header:first-child { border-top: none; }
    .app-gms__option--indented { padding-left: 28px !important; }
    .app-gms__empty {
      padding: 14px 16px;
      text-align: center;
      font-size: 0.8rem;
      color: #64748b;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => GroupedMultiSelectComponent),
      multi: true,
    },
  ],
})
export class GroupedMultiSelectComponent<V = string> implements ControlValueAccessor {
  @Input() set options(value: SelectOption<V>[]) {
    const next = value ?? [];
    if (next === this._options) return;
    this._options = next;
    this.syncSelectedFromValues();
  }
  get options(): SelectOption<V>[] { return this._options; }

  @Input() placeholder = 'Chọn...';
  @Input() size: 's' | 'm' | 'l' = 'm';

  disabled = false;
  searchText: string | null = '';

  private _options: SelectOption<V>[] = [];
  private _values: V[] = [];

  selectedOptions: SelectOption<V>[] = [];

  private onChange: (value: V[]) => void = () => {};
  private onTouched: () => void = () => {};

  readonly stringifyOption = (opt: SelectOption<V>): string => {
    if (!opt) return '';
    return opt.groupLabel ? `${opt.groupLabel} / ${opt.label}` : opt.label;
  };

  readonly trackByValue = (_: number, opt: SelectOption<V>): any => opt.value;
  readonly trackByGroup = (_: number, g: OptionGroup<V>): string => g.key;

  /** Nhóm các option chưa selected, đã filter theo search. */
  get filteredGroups(): OptionGroup<V>[] {
    const q = (this.searchText ?? '').trim().toLowerCase();
    const selectedSet = new Set(this._values);

    const matches = (opt: SelectOption<V>): boolean => {
      if (selectedSet.has(opt.value)) return false;
      if (!q) return true;
      const hay = `${opt.label} ${opt.groupLabel ?? ''} ${opt.searchText ?? ''}`.toLowerCase();
      return hay.includes(q);
    };

    const groups = new Map<string, OptionGroup<V>>();
    for (const opt of this._options) {
      if (!matches(opt)) continue;
      const key = opt.group ?? '__OTHER__';
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          label: opt.group ? (opt.groupLabel ?? opt.group) : null,
          items: [],
        };
        groups.set(key, group);
      }
      group.items.push(opt);
    }
    return Array.from(groups.values());
  }

  onSelectionChange(selected: SelectOption<V>[]): void {
    this.selectedOptions = selected ?? [];
    this._values = this.selectedOptions.map(o => o.value);
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
      return;
    }
    const byValue = new Map(this._options.map(o => [o.value, o]));
    this.selectedOptions = this._values
      .map(v => byValue.get(v))
      .filter((o): o is SelectOption<V> => !!o);
  }
}
