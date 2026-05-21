import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { TuiButtonModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiInputModule, TuiTextAreaModule } from '@taiga-ui/kit';
import { TuiGroupModule } from '@taiga-ui/core';
import { TuiRadioBlockModule } from '@taiga-ui/kit';
import { AppDialogDirective } from '../../../shared/components/app-dialog.directive';
import { ColumnConfig } from '../../excel-builder.component';
import { ciKey, isReservedKeyword } from '../../utils/formula-keywords';

export interface ColumnConfigResult {
  headerName: string;
  field: string;
  excelCol?: string;
  formula?: string;
  dataType?: 'number' | 'text' | 'date';
  width?: number;
}

export interface ColumnConfigEditData {
  index: number;
  config: ColumnConfig;
}

/** Reject field tên trùng với hàm reserved (sum/if/...) — CI. */
export function fieldNotReservedValidator(): ValidatorFn {
  return (ctrl: AbstractControl): ValidationErrors | null => {
    return isReservedKeyword(ctrl.value) ? { reserved: true } : null;
  };
}

/** Reject field trùng với tên đã có ignore-case. Cho phép giữ `currentField` (edit mode). */
export function fieldNotDuplicateCiValidator(
  getExisting: () => string[],
  getCurrentField: () => string | null,
): ValidatorFn {
  return (ctrl: AbstractControl): ValidationErrors | null => {
    const val = ctrl.value?.trim();
    if (!val) return null;
    const currentKey = ciKey(getCurrentField() || '');
    const newKey = ciKey(val);
    if (currentKey === newKey) return null;
    const taken = getExisting().some(f => ciKey(f) === newKey);
    return taken ? { duplicate: true } : null;
  };
}

@Component({
  selector: 'app-column-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButtonModule,
    TuiTextfieldControllerModule,
    TuiGroupModule,
    TuiRadioBlockModule,
    TuiInputModule,
    TuiTextAreaModule,
    AppDialogDirective,
  ],
  templateUrl: './column-config-dialog.component.html',
  styleUrls: ['./column-config-dialog.component.scss'],
})
export class ColumnConfigDialogComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() editData: ColumnConfigEditData | null = null;
  /** Tất cả fields hiện có trong template — dùng check duplicate CI. */
  @Input() existingFields: string[] = [];
  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() submitColumn = new EventEmitter<ColumnConfigResult>();

  editingColumnIndex: number | null = null;

  columnForm = new FormGroup({
    headerName: new FormControl('', Validators.required),
    field: new FormControl('', [
      Validators.required,
      Validators.pattern(/^[a-zA-Z0-9]+$/),
      fieldNotReservedValidator(),
      fieldNotDuplicateCiValidator(
        () => this.existingFields,
        () => this.editingColumnIndex !== null ? (this.editData?.config.field ?? null) : null,
      ),
    ]),
    excelCol: new FormControl('', [Validators.pattern(/^[a-zA-Z]+$/)]),
    dataType: new FormControl<'number' | 'text' | 'date'>('text'),
    formula: new FormControl(''),
    width: new FormControl<number | null>(null, [Validators.min(40), Validators.max(2000)]),
  });

  get dialogLabel(): string {
    return this.editingColumnIndex !== null ? 'Sửa cấu hình cột' : 'Cấu hình Cột';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['isOpen'] || changes['editData']) && this.isOpen) {
      this.initForm();
    }
  }

  private initForm(): void {
    if (this.editData) {
      this.editingColumnIndex = this.editData.index;
      const config = this.editData.config;
      this.columnForm.controls.field.disable();
      this.columnForm.reset({
        dataType: config.dataType || 'text',
        field: config.field,
        headerName: config.headerName,
        excelCol: config.excelCol || '',
        formula: config.formula || '',
        width: config.width ?? 150,
      });
    } else {
      this.editingColumnIndex = null;
      this.columnForm.controls.field.enable();
      this.columnForm.reset({
        dataType: 'text',
        width: 150,
      });
    }
  }

  onSubmit(): void {
    if (this.columnForm.invalid) {
      this.columnForm.markAllAsTouched();
      return;
    }
    const val = this.columnForm.getRawValue();
    this.submitColumn.emit({
      headerName: val.headerName!,
      field: val.field!,
      excelCol: val.excelCol || undefined,
      formula: val.formula || undefined,
      dataType: (val.dataType as 'number' | 'text' | 'date') || 'text',
      width: val.width != null ? Number(val.width) : undefined,
    });
    this.close();
  }

  close(): void {
    this.editingColumnIndex = null;
    this.columnForm.controls.field.enable();
    this.isOpen = false;
    this.isOpenChange.emit(false);
  }
}
