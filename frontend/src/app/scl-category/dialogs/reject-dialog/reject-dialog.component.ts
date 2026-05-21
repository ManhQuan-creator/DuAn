import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TuiTextareaModule } from '@taiga-ui/kit';
import { AppDialogDirective } from '../../../shared/components/app-dialog.directive';
import { TuiButtonModule, TuiSvgModule } from '@taiga-ui/core';
import { CommonModule } from '@angular/common';
import { SingleSelectComponent } from '../../../shared/components/multi-select';
import { Option } from '../../../shared/models/common.model';
import { RejectionAssessment } from '../../model/scl-assessment.model';

@Component({
  selector: 'app-reject-dialog',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TuiButtonModule,
    TuiSvgModule,
    TuiTextareaModule,
    AppDialogDirective,
    TuiTextareaModule,
    SingleSelectComponent,
  ],
  templateUrl: './reject-dialog.component.html',
  styleUrls: ['./reject-dialog.component.scss'],
})
export class RejectDialogComponent {
  @Input() isOpen = false;
  @Input() title = 'Từ chối hạng mục thẩm định';
  @Input() showInputReason = true;
  @Input() showInputFile = true;
  @Input() showSelectYear = false;
  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<RejectionAssessment>();
  @Output() cancelled = new EventEmitter<void>();

  reason = '';
  attachedFiles: File[] = [];
  isDragOver = false;
  selectedYear: string | null = null;

  readonly yearOptions: Option[] = Array.from(
    { length: new Date().getFullYear() - 1980 + 1 },
    (_, i) => String(1980 + i + 1),
  )
    .reverse()
    .map((year) => ({ value: year, label: year }));

  // ── Drag & Drop ──────────────────────────────

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    // Chỉ tắt khi rời khỏi toàn bộ drop-zone (không phải con)
    const target = event.currentTarget as HTMLElement;
    const related = event.relatedTarget as Node | null;
    if (!related || !target.contains(related)) {
      this.isDragOver = false;
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    const files = event.dataTransfer?.files;
    if (files) {
      this.addFiles(Array.from(files));
    }
  }

  // ── File picker ──────────────────────────────

  openFilePicker(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '*/*';
    input.onchange = (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) this.addFiles(Array.from(files));
    };
    input.click();
  }

  // ── Helpers ──────────────────────────────────

  private addFiles(newFiles: File[]): void {
    const existing = new Set(
      this.attachedFiles.map((f) => `${f.name}-${f.size}`),
    );
    newFiles.forEach((file) => {
      if (!existing.has(`${file.name}-${file.size}`)) {
        this.attachedFiles.push(file);
        existing.add(`${file.name}-${file.size}`);
      }
    });
  }

  removeFile(index: number): void {
    this.attachedFiles.splice(index, 1);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  getFileIcon(file: File): string {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
      return 'tuiIconImage';
    if (ext === 'pdf') return 'tuiIconFile';
    if (['zip', 'rar', '7z'].includes(ext)) return 'tuiIconArchive';
    return 'tuiIconFile';
  }

  // ── Actions ───────────────────────────────────

  onCancel(): void {
    this.reset();
    this.cancelled.emit();
    this.isOpenChange.emit(false);
  }

  onConfirm(): void {
    // if (!this.reason.trim()) return;
    this.confirmed.emit({
      reason: this.reason.trim(),
      attachments: [...this.attachedFiles],
      year: this.selectedYear,
    });
    this.reset();
    this.isOpenChange.emit(false);
  }

  onDialogChange(open: boolean): void {
    this.isOpenChange.emit(open);
    if (!open) this.reset();
  }

  private reset(): void {
    this.reason = '';
    this.attachedFiles = [];
    this.isDragOver = false;
    this.selectedYear = null;
  }
}
