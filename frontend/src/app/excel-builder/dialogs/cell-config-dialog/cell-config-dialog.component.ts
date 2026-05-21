import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TuiButtonModule, TuiDataListModule, TuiSvgModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiSelectModule, TuiTextAreaModule } from '@taiga-ui/kit';
import { AppDialogDirective } from '../../../shared/components/app-dialog.directive';
import { CatalogItem } from '../../models/catalog.data';
import { CellValidation } from '../../excel-builder.component';
import { CatalogTypeItem } from '../../../catalog-manager/models/catalog.model';

export interface CellConfigInput {
  field: string;
  cellConfig: any;
  isFormulaCol: boolean;
  isDateColumn: boolean;
}

export interface CellConfigResult {
  tab: 'formula' | 'dropdown' | 'datepicker' | 'validation';
  formula?: string;
  dropdown?: { catalogType: string };
  datePicker?: boolean;
  validation?: CellValidation;
}

@Component({
  selector: 'app-cell-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TuiButtonModule,
    TuiTextfieldControllerModule,
    TuiDataListModule,
    TuiSvgModule,
    TuiSelectModule,
    TuiTextAreaModule,
    AppDialogDirective,
  ],
  templateUrl: './cell-config-dialog.component.html',
  styleUrls: ['./cell-config-dialog.component.scss'],
})
export class CellConfigDialogComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() config: CellConfigInput | null = null;
  @Input() catalogTypes: CatalogTypeItem[] = [];
  @Input() cellDropdownItems: CatalogItem[] = [];
  @Input() cellDropdownLoading = false;
  @Input() formulaValidation: { valid: boolean; error?: string; references?: string[] } | null = null;
  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() saveCellConfig = new EventEmitter<CellConfigResult>();
  @Output() clearCellConfig = new EventEmitter<void>();
  @Output() dropdownCatalogTypeChange = new EventEmitter<CatalogTypeItem | null>();

  cellConfigTab: 'formula' | 'dropdown' | 'datepicker' | 'validation' = 'formula';
  cellFormulaCtrl = new FormControl('');
  cellDatePickerEnabled = false;
  cellValidationRequired = false;
  cellValidationMin: number | null = null;
  cellValidationMax: number | null = null;
  cellValidationPattern = '';
  cellValidationErrorMsg = '';
  cellValidationMinDate: string | null = null;
  cellValidationMaxDate: string | null = null;
  cellDropdownCatalogType = new FormControl<CatalogTypeItem | null>(null);

  editingCellIsFormulaCol = false;
  isEditingDateColumn = false;

  readonly stringifyCatalogType = (item: CatalogTypeItem): string => item.name;

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['isOpen'] || changes['config']) && this.isOpen && this.config) {
      this.initFromConfig(this.config);
    }
  }

  private initFromConfig(cfg: CellConfigInput): void {
    this.editingCellIsFormulaCol = cfg.isFormulaCol;
    this.isEditingDateColumn = cfg.isDateColumn;
    const cellCfg = cfg.cellConfig;

    if (cellCfg?.datePicker) {
      this.cellConfigTab = 'datepicker';
      this.cellDatePickerEnabled = true;
      this.cellFormulaCtrl.setValue('');
      this.cellDropdownCatalogType.setValue(null, { emitEvent: false });
    } else if (cellCfg?.dropdown) {
      this.cellConfigTab = 'dropdown';
      this.cellDatePickerEnabled = false;
      this.cellFormulaCtrl.setValue('');
      const matchType = this.catalogTypes.find(t => t.type === cellCfg.dropdown.catalogType) || null;
      this.cellDropdownCatalogType.setValue(matchType, { emitEvent: false });
      if (matchType) this.dropdownCatalogTypeChange.emit(matchType);
    } else {
      this.cellConfigTab = 'formula';
      this.cellDatePickerEnabled = false;
      this.cellFormulaCtrl.setValue(cellCfg?.formula || '');
      this.cellDropdownCatalogType.setValue(null, { emitEvent: false });
    }

    const v = cellCfg?.validation;
    this.cellValidationRequired = v?.required || false;
    this.cellValidationMin = v?.min ?? null;
    this.cellValidationMax = v?.max ?? null;
    this.cellValidationMinDate = v?.minDate || null;
    this.cellValidationMaxDate = v?.maxDate || null;
    this.cellValidationPattern = v?.pattern || '';
    this.cellValidationErrorMsg = v?.errorMessage || '';
  }

  onDropdownCatalogTypeChange(): void {
    this.dropdownCatalogTypeChange.emit(this.cellDropdownCatalogType.value);
  }

  onSave(): void {
    const result: CellConfigResult = { tab: this.cellConfigTab };

    if (this.cellConfigTab === 'formula') {
      result.formula = this.cellFormulaCtrl.value?.trim() || undefined;
    } else if (this.cellConfigTab === 'dropdown') {
      const catalogType = this.cellDropdownCatalogType.value;
      if (catalogType) {
        result.dropdown = { catalogType: catalogType.type };
      }
    } else if (this.cellConfigTab === 'datepicker') {
      result.datePicker = this.cellDatePickerEnabled;
    } else if (this.cellConfigTab === 'validation') {
      const validation: CellValidation = {};
      if (this.cellValidationRequired) validation.required = true;
      if (this.cellValidationMin != null) validation.min = this.cellValidationMin;
      if (this.cellValidationMax != null) validation.max = this.cellValidationMax;
      if (this.cellValidationMinDate) validation.minDate = this.cellValidationMinDate;
      if (this.cellValidationMaxDate) validation.maxDate = this.cellValidationMaxDate;
      if (this.cellValidationPattern) validation.pattern = this.cellValidationPattern;
      if (this.cellValidationErrorMsg) validation.errorMessage = this.cellValidationErrorMsg;
      if (Object.keys(validation).length > 0) result.validation = validation;
    }

    this.saveCellConfig.emit(result);
    this.close();
  }

  onClear(): void {
    this.clearCellConfig.emit();
    this.close();
  }

  close(): void {
    this.isOpen = false;
    this.isOpenChange.emit(false);
  }
}
