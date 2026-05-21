import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, OnDestroy } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButtonModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiInputModule } from '@taiga-ui/kit';
import { Subject, takeUntil } from 'rxjs';
import { AppDialogDirective } from '../../../shared/components/app-dialog.directive';
import { CatalogTypeItem } from '../../../catalog-manager/models/catalog.model';
import { CatalogService } from '../../../catalog-manager/service/catalog.service';
import { CatalogItem } from '../../models/catalog.data';
import {
  SingleSelectComponent,
  MultiSelectComponent,
  SelectOption,
} from '../../../shared/components/multi-select';

export interface AddRowAutoResult {
  mode: 'auto';
  /** Số dòng cần thêm; mã + tên do parent tự sinh (R{n}). */
  quantity: number;
}

export interface AddRowBulkResult {
  mode: 'bulk';
  /** Cột đích nhận `MASTER_CATALOG.NAME` */
  targetField: string;
  /** Mỗi item → 1 dòng. row_code = item.id (suffix nếu trùng), name = item.id, [targetField] = item.name. */
  items: { id: string; name: string }[];
}

export type AddRowResult = AddRowAutoResult | AddRowBulkResult;

const QUANTITY_MIN = 1;
const QUANTITY_MAX = 100;

/** Tuỳ chọn "cột đích" — chỉ cột text/number không formula. */
export interface TargetFieldOption {
  field: string;
  headerName: string;
}

@Component({
  selector: 'app-add-row-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TuiButtonModule,
    TuiTextfieldControllerModule,
    TuiInputModule,
    AppDialogDirective,
    SingleSelectComponent,
    MultiSelectComponent,
  ],
  templateUrl: './add-row-dialog.component.html',
  styleUrls: ['./add-row-dialog.component.scss'],
})
export class AddRowDialogComponent implements OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() addRow = new EventEmitter<AddRowResult>();

  /** Cột text/number sẵn có — feed cho dropdown "cột nhận tên" ở chế độ Nâng cao. */
  @Input() targetFields: TargetFieldOption[] = [];
  /** Tất cả catalog types — feed cho dropdown loại danh mục. */
  @Input() catalogTypes: CatalogTypeItem[] = [];

  readonly quantityMin = QUANTITY_MIN;
  readonly quantityMax = QUANTITY_MAX;

  private destroy$ = new Subject<void>();

  isAdvanced = false;

  /** ===== Cơ bản (auto): chỉ chọn số lượng, mã tự sinh R{n} ===== */
  quantity = new FormControl<number | null>(1, [
    Validators.required,
    Validators.min(QUANTITY_MIN),
    Validators.max(QUANTITY_MAX),
  ]);

  /** ===== Nâng cao (bulk) ===== */
  selectedTargetField = new FormControl<string | null>(null);
  selectedCatalogType = new FormControl<string | null>(null);
  selectedItemIds = new FormControl<string[]>([]);

  catalogItems: CatalogItem[] = [];
  catalogLoading = false;

  /**
   * Options materialize thành instance field (KHÔNG getter) — getter trả mảng mới
   * mỗi CD cycle khiến `app-single-select`/`app-multi-select` setter thấy `next !== _options`
   * → trigger CD → loop vô tận → freeze browser.
   */
  targetFieldOptions: SelectOption<string>[] = [];
  catalogTypeOptions: SelectOption<string>[] = [];
  catalogItemOptions: SelectOption<string>[] = [];

  constructor(private catalogService: CatalogService) {
    this.selectedCatalogType.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.onCatalogTypeChange());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['targetFields']) {
      this.targetFieldOptions = (this.targetFields || []).map(f => ({ value: f.field, label: f.headerName }));
    }
    if (changes['catalogTypes']) {
      this.catalogTypeOptions = (this.catalogTypes || []).map(t => ({ value: t.type, label: t.name }));
    }
    const openChange = changes['isOpen'];
    if (openChange && !openChange.previousValue && this.isOpen) {
      this.resetForm();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleAdvanced(): void {
    this.isAdvanced = !this.isAdvanced;
  }

  /** Submit button: trả primitive — không tạo ref mới. */
  get submitDisabled(): boolean {
    if (this.isAdvanced) {
      if (!this.selectedTargetField.value) return true;
      if (this.catalogItemOptions.length === 0) return true;
      return false;
    }
    return this.quantity.invalid;
  }

  get submitButtonLabel(): string {
    if (this.isAdvanced) {
      const picked = this.selectedItemIds.value?.length ?? 0;
      const count = picked === 0 ? this.catalogItemOptions.length : picked;
      return `Thêm ${count} dòng`;
    }
    return `Thêm ${this.quantityValue} dòng`;
  }

  /**
   * Coerce + clamp quantity về integer hợp lệ. `<input tuiTextfield type="number">`
   * không có ValueAccessor coerce → FormControl giữ string khi user gõ tay.
   */
  private get quantityValue(): number {
    const n = Math.trunc(Number(this.quantity.value));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  onCatalogTypeChange(): void {
    const type = this.selectedCatalogType.value;
    this.catalogItems = [];
    this.catalogItemOptions = [];
    this.selectedItemIds.setValue([]);
    if (!type) return;

    this.catalogLoading = true;
    this.catalogService
      .getCatalogs(type)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.catalogItems = this.flattenTree(items);
          this.catalogItemOptions = this.catalogItems.map(i => ({ value: String(i.id), label: i.name }));
          this.catalogLoading = false;
        },
        error: () => (this.catalogLoading = false),
      });
  }

  /** Catalog API trả tree (item.children); flatten 1 cấp đủ cho dropdown. */
  private flattenTree(items: CatalogItem[]): CatalogItem[] {
    const out: CatalogItem[] = [];
    const walk = (list: CatalogItem[]) => {
      for (const it of list) {
        out.push(it);
        if ((it as any).children?.length) walk((it as any).children);
      }
    };
    walk(items);
    return out;
  }

  private resetForm(): void {
    this.isAdvanced = false;
    this.quantity.reset(1);
    this.quantity.markAsPristine();
    this.quantity.markAsUntouched();
    this.selectedTargetField.reset(null);
    this.selectedCatalogType.reset(null);
    this.selectedItemIds.reset([]);
    this.catalogItems = [];
    this.catalogItemOptions = [];
  }

  onSubmit(): void {
    if (this.isAdvanced) {
      this.submitBulk();
    } else {
      this.submitAuto();
    }
  }

  private submitAuto(): void {
    if (this.quantity.invalid) {
      this.quantity.markAsTouched();
      return;
    }
    this.addRow.emit({ mode: 'auto', quantity: this.quantityValue });
    this.close();
  }

  private submitBulk(): void {
    const target = this.selectedTargetField.value;
    if (!target) return;

    const ids = this.selectedItemIds.value || [];
    // UX: nếu user không chọn item nào → mặc định lấy TẤT CẢ items đã load.
    const sourceItems = ids.length === 0
      ? this.catalogItems
      : this.catalogItems.filter(i => new Set(ids).has(i.id));

    const items = sourceItems.map(i => ({ id: String(i.id), name: i.name }));
    if (items.length === 0) return;

    this.addRow.emit({ mode: 'bulk', targetField: target, items });
    this.close();
  }

  close(): void {
    this.isOpen = false;
    this.isOpenChange.emit(false);
  }
}
