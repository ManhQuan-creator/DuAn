import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnInit,
  Output,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms'; // cần cho [(ngModel)]
import {
  TuiButtonModule,
  TuiDataListModule,
  TuiTextfieldControllerModule,
} from '@taiga-ui/core';
import { TuiInputModule, TuiSelectModule } from '@taiga-ui/kit';
import { Subject } from 'rxjs';
import { CatalogItem } from '../../../excel-builder/models/catalog.data';
import { AppDialogDirective } from '../../../shared/components/app-dialog.directive';
import { Option } from '../../../shared/models/common.model';
import { SclCategory } from '../../model/scl-category.model';
import { PcOrganizationUnitService } from '../../service/pc-organization-unit.service';

@Component({
  selector: 'app-add-scl-category',
  imports: [
    CommonModule,
    FormsModule,
    AppDialogDirective,
    TuiInputModule,
    FormsModule,
    TuiSelectModule,
    TuiDataListModule,
    TuiTextfieldControllerModule,
    TuiButtonModule,
    ReactiveFormsModule,
  ],
  templateUrl: './add-scl-category.component.html',
  styleUrl: './add-scl-category.component.scss',
})
export class AddSclCategoryComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() unitOptions: Option[] = [];
  @Input() pcOptions: string[] = [];
  @Input() progressOptions: string[] = [];
  @Input() statusOptions: CatalogItem[] = [];
  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() submitAddEvent: EventEmitter<any> = new EventEmitter();

  values: Record<string, string> = {};

  readonly yearOptions: string[] = Array.from(
    { length: new Date().getFullYear() - 1980 + 1 },
    (_, i) => String(1980 + i),
  ).reverse();

  unitFilter: string | null = null;
  pcFilter: string | null = null;
  yearFilter: string | null = null;

  readonly searchSubject = new Subject<string>();
  private readonly pcOrganizationService = inject(PcOrganizationUnitService);

  readonly stringifyUnit = (unit: Option | null): string => unit?.label ?? '';
  readonly stringifyPc = (pc: string): string => pc;
  readonly stringifyYear = (yearPlan: string): string => yearPlan;
  readonly stringifyProgress = (progress: string): string => progress;
  readonly stringifyStatus = (status: CatalogItem | null): string => status?.name ?? '';
  readonly stringifyLastSclYear = (lastSclYear: string): string => lastSclYear;

  formSCLadd = new FormGroup({
    unit: new FormControl<Option | null>(null, Validators.required),
    categoryCode: new FormControl(null, [
      Validators.required,
      Validators.maxLength(50),
    ]),
    categoryName: new FormControl('', [
      Validators.required,
      Validators.maxLength(100),
    ]),
    yearPlan: new FormControl<string | null>(null),
    pc: new FormControl(null, [Validators.required, Validators.maxLength(50)]),
    assetCode: new FormControl(null, [
      Validators.required,
      Validators.maxLength(50),
    ]),
    progress: new FormControl<string | null>(null, Validators.required),
    status: new FormControl<CatalogItem | null>(null, Validators.required),
    actualVolume: new FormControl<string | null>(null),
    lastSclYear: new FormControl<string | null>(null),
  });

  get unit() {
    return this.formSCLadd.controls.unit;
  }
  get categoryCode() {
    return this.formSCLadd.controls.categoryCode;
  }
  get categoryName() {
    return this.formSCLadd.controls.categoryName;
  }
  get pc() {
    return this.formSCLadd.controls.pc;
  }
  get assetCode() {
    return this.formSCLadd.controls.assetCode;
  }
  get actualVolume() {
    return this.formSCLadd.controls.actualVolume;
  }
  get lastSclYear() {
    return this.formSCLadd.controls.lastSclYear;
  }
  get progress() {
    return this.formSCLadd.controls.progress;
  }
  get status() {
    return this.formSCLadd.controls.status;
  }

  ngOnInit() {
    // Ban đầu disable
    this.formSCLadd.controls.unit.disable();

    this.formSCLadd.controls.pc.valueChanges.subscribe((pcValue) => {
      if (pcValue) {
        this.formSCLadd.controls.unit.disable(); // Tạm disable trong lúc tải
        this.pcOrganizationService.getPcOrganizationUnits(pcValue).subscribe({
          next: (res) => {
            this.formSCLadd.controls.unit.enable();
            
            // API trả về list entity và map field unit
            this.unitOptions = res
              .map((org) => ({
                value: org.unit,
                label: org.unit,
              }))
              .filter((option): option is Option => !!option.value && !!option.label);
            
            // Nếu giá trị hiện tại của unit không nằm trong danh sách mới, reset về null
            const currentUnit = this.formSCLadd.controls.unit.value;
            if (
              currentUnit &&
              !this.unitOptions.some((option) => option.value === currentUnit.value)
            ) {
              this.formSCLadd.controls.unit.setValue(null);
            }
          },
          error: () => {
            this.formSCLadd.controls.unit.enable();
            this.unitOptions = [];
            this.formSCLadd.controls.unit.setValue(null);
          }
        });
      } else {
        this.formSCLadd.controls.unit.disable();
        this.unitOptions = [];
        this.formSCLadd.controls.unit.setValue(null);
      }
    });
  }
  ngOnChanges() {
    if (!this.isOpen) this.formSCLadd.reset();
  }

  isInvalid(control: FormControl): boolean {
    return control.touched && control.invalid;
  }

  onUnitChange(): void {
    this.onSearchInput();
  }
  onYearChange(): void {
    this.onSearchInput();
  }

  cancel(): void {
    this.formSCLadd.reset();
    this.isOpenChange.emit(false);
  }

  onSearchInput(): void {
    const signature = [this.unitFilter ?? '', this.yearFilter ?? ''].join('|');
    this.searchSubject.next(signature);
  }

  handleSubmit(): void {
    this.formSCLadd.markAllAsTouched();

    if (this.formSCLadd.invalid) return;

    const payload: SclCategory = {
      unit: this.formSCLadd.value.unit?.value ?? '',
      categoryCode: this.formSCLadd.value.categoryCode ?? '',
      categoryName: this.formSCLadd.value.categoryName ?? '',
      yearPlan: this.formSCLadd.value.yearPlan ?? '',
      pc: this.formSCLadd.value.pc ?? '',
      assetCode: this.formSCLadd.value.assetCode ?? '',
      progress: this.formSCLadd.value.progress ?? '',
      status: this.formSCLadd.value.status?.id ?? '',
      actualVolume: this.formSCLadd.value.actualVolume ?? '',
      lastSclYear: this.formSCLadd.value.lastSclYear ?? '',
    };

    this.submitAddEvent.emit(payload); // gửi lên cha
  }
}
