import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButtonModule, TuiDataListModule, TuiSvgModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiSelectModule } from '@taiga-ui/kit';
import { AppDialogDirective } from '../../../shared/components/app-dialog.directive';
import { CatalogItem } from '../../../excel-builder/models/catalog.data';

@Component({
  selector: 'app-change-status',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiButtonModule,
    TuiTextfieldControllerModule,
    TuiDataListModule,
    TuiSvgModule,
    TuiSelectModule,
    AppDialogDirective,
  ],
  templateUrl: './change-status.component.html',
  styleUrls: ['./change-status.component.scss'],
})
export class ChangeStatusComponent {
  @Input() isOpen = false;
  @Input() statusOptions: CatalogItem[] = [];
  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<CatalogItem>();
  @Output() cancelled = new EventEmitter<void>();

  selectedStatus: CatalogItem | null = null;

  readonly stringifyStatus = (item: CatalogItem): string => item?.name || '';

  onCancel(): void {
    this.reset();
    this.cancelled.emit();
    this.isOpenChange.emit(false);
  }

  onConfirm(): void {
    if (!this.selectedStatus?.id) return;

    this.confirmed.emit(this.selectedStatus);
    this.reset();
    this.isOpenChange.emit(false);
  }

  onDialogChange(open: boolean): void {
    this.isOpenChange.emit(open);
    if (!open) this.reset();
  }

  private reset(): void {
    this.selectedStatus = null;
  }
}
