import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TuiDialogContext } from '@taiga-ui/core';
import { TuiButtonModule, TuiLinkModule, TuiSvgModule } from '@taiga-ui/core';
import { TuiInputFilesModule, TuiFilesModule } from '@taiga-ui/kit';
import { POLYMORPHEUS_CONTEXT } from '@tinkoff/ng-polymorpheus';
import { Subject, takeUntil } from 'rxjs';
import { AppDialogDirective } from '../app-dialog.directive';
import { ChangeDetectionStrategy } from '@angular/core';
import { TuiMarkerIconModule } from '@taiga-ui/kit';


@Component({
  selector: 'app-import-file-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiInputFilesModule,
    TuiFilesModule,
    TuiButtonModule,
    TuiLinkModule,
    TuiSvgModule,
    AppDialogDirective,
    TuiMarkerIconModule,
  ],
  templateUrl: './import-file-dialog.component.html',
  styleUrls: ['./import-file-dialog.component.scss'],
})
export class ImportFileDialogComponent implements OnChanges, OnDestroy {
  // ===== INPUT =====
  @Input() open = false;
  @Input() isDownloadingTemplate = false;
  @Input() fileType: 'excel' | 'csv' | 'xml' = 'excel';
  @Input() title = 'Nhập file';

  // ===== OUTPUT =====
  @Output() handleCancelEvent = new EventEmitter<void>();
  @Output() handlerFileSubmit = new EventEmitter<File | null>();
  @Output() handlerDowloadTemplate = new EventEmitter<void>();
  @Output() openChange = new EventEmitter<boolean>();

  // ===== DIALOG =====
  protected readonly context = inject<TuiDialogContext<File | null>>(
    POLYMORPHEUS_CONTEXT,
    { optional: true },
  );

  // ===== FORM =====
  readonly control = new FormControl<File | File[] | null>(null);

  readonly MAX_SIZE = 20 * 1024 * 1024; // 20MB

  errorMessage = '';

  private destroy$ = new Subject<void>();

  // 👉 lấy file đầu tiên
  get selectedFile(): File | null {
    const value = this.control.value;

    if (!value) return null;
    return Array.isArray(value) ? value[0] : value;
  }

  // ===== LIFECYCLE =====
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && !this.open) {
      this.resetForm();
    }
  }

  ngOnInit(): void {
    this.control.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        this.errorMessage = '';

        if (!value) return;

        const file = Array.isArray(value) ? value[0] : value;

        if (!file) return;

        // validate type
        if (!this.isValidFileType(file)) {
          this.errorMessage = 'Sai định dạng file!';
          this.safeReset();
          return;
        }

        // validate size
        if (!this.isValidFileSize(file)) {
          this.errorMessage = 'File vượt quá 20MB!';
          this.safeReset();
          return;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===== ACTION =====

  onClose(): void {
    this.resetForm();
    this.context?.completeWith(null);
    this.handleCancelEvent.emit();
  }

  onImport(): void {
    if (!this.selectedFile) return;

    this.context?.completeWith(this.selectedFile);
    this.handlerFileSubmit.emit(this.selectedFile);
  }

  onDownloadTemplate(): void {
    if (this.isDownloadingTemplate) return;
    this.handlerDowloadTemplate.emit();
  }

  // ===== VALIDATION =====

  private resetForm(): void {
    this.control.reset();
    this.errorMessage = '';
  }

  private safeReset(): void {
    setTimeout(() => this.control.reset(), 0);
  }

  private isValidFileType(file: File): boolean {
    const name = file.name.toLowerCase();

    switch (this.fileType) {
      case 'excel':
        return name.endsWith('.xls') || name.endsWith('.xlsx');
      case 'csv':
        return name.endsWith('.csv');
      case 'xml':
        return name.endsWith('.xml');
      default:
        return false;
    }
  }

  private isValidFileSize(file: File): boolean {
    return file.size <= this.MAX_SIZE;
  }

  formatFileSize(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  }

  onRemoveFile(): void {
    this.control.setValue(null);
    this.errorMessage = '';
  }

  onDownloadFile(): void {
    const file = this.selectedFile;
    if (!file) return;

    const url = window.URL.createObjectURL(file);

    const a = document.createElement('a');
    a.href = url;
    a.download = file.name; // tên file gốc
    a.click();

    // cleanup
    window.URL.revokeObjectURL(url);
  }
}
