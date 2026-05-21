import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TuiDataListModule,
  TuiSvgModule,
  TuiTextfieldControllerModule,
} from '@taiga-ui/core';
import {
  TuiDataListWrapperModule,
  TuiInputModule,
  TuiMultiSelectModule,
  TuiSelectModule,
} from '@taiga-ui/kit';
import { AppDialogDirective } from '../../../shared/components/app-dialog.directive';
import { Option } from '../../../shared/models/common.model';

@Component({
  selector: 'app-send-assesment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiTextfieldControllerModule,
    TuiDataListModule,
    TuiInputModule,
    TuiSelectModule,
    TuiMultiSelectModule,
    AppDialogDirective,
    TuiSvgModule,
    TuiDataListWrapperModule,
  ],
  templateUrl: './send-assesment-dialog.component.html',
  styleUrl: './send-assesment-dialog.component.scss',
})
export class SendAssesmentDialogComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() dialogLabel = '';
  @Input() unitOptions: Option[] = [];
  @Input() selectedUnits: Option[] = [];
  @Input() disableAssessment = false;

  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() selectedUnitsChange = new EventEmitter<Option[]>();
  @Output() confirmed = new EventEmitter<Option[]>();
  @Output() cancelled = new EventEmitter<void>();

  unitFilter: Option[] = [];
  search = '';
  filteredUnits: Option[] = [];

  readonly stringifyUnit = (unit: Option): string => unit.label;


  ngOnInit(): void {
    this.filteredUnits = [...this.unitOptions];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.resetForm();
    }

    if (changes['selectedUnits']) {
      this.unitFilter = [...this.selectedUnits];
    }

    if (changes['unitOptions']) {
      this.filteredUnits = [...this.unitOptions];
    }
  }

  private resetForm(): void {
    this.unitFilter = [...this.selectedUnits];
    this.search = '';
    this.filteredUnits = [...this.unitOptions];
  }

  onUnitChange(): void {
    this.selectedUnitsChange.emit([...this.unitFilter]);
  }

  onSearchChange(): void {
    const keyword = this.search.trim().toLowerCase();

    if (!keyword) {
      this.filteredUnits = [...this.unitOptions];
      return;
    }

    this.filteredUnits = this.unitOptions.filter(unit =>
      unit.label.toLowerCase().includes(keyword),
    );
  }

  onCancel(): void {
    this.resetForm();
    this.cancelled.emit();          // báo cha click Hủy
    this.isOpenChange.emit(false);
  }

  onConfirm(): void {
    this.confirmed.emit([...this.unitFilter]);  // báo cha click Xác nhận
    this.isOpenChange.emit(false);
  }
}