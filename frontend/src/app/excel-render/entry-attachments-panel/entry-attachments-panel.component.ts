import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  ElementRef,
  inject,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { TuiButtonModule, TuiSvgModule } from '@taiga-ui/core';

import { AppDialogService } from '../../shared/dialog.service';
import { EntryFileItem, EntryFileService } from '../service/entry-file.service';

@Component({
  selector: 'app-entry-attachments-panel',
  standalone: true,
  imports: [CommonModule, TuiButtonModule, TuiSvgModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entry-attachments-panel.component.html',
  styleUrls: ['./entry-attachments-panel.component.scss'],
})
export class EntryAttachmentsPanelComponent implements OnChanges {
  @Input() templateId!: number;
  @Input() entryId!: number;
  /** Disable upload/delete khi entry không ở trạng thái cho phép (vd DISTRIBUTED view-only). */
  @Input() readonly = false;
  /** Two-way bound collapsed state — parent quản lý để chia sẻ với nút toggle ngoài. */
  @Input() collapsed = true;
  @Output() collapsedChange = new EventEmitter<boolean>();
  @Output() filesCountChange = new EventEmitter<number>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  files: EntryFileItem[] = [];
  loading = false;
  uploading = false;

  private readonly entryFileService = inject(EntryFileService);
  private readonly dialog = inject(AppDialogService);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['entryId'] || changes['templateId']) && this.templateId && this.entryId) {
      this.reload();
    }
  }

  reload(): void {
    if (!this.templateId || !this.entryId) return;
    this.loading = true;
    this.entryFileService.list(this.templateId, this.entryId).subscribe({
      next: files => {
        this.files = files;
        this.loading = false;
        this.filesCountChange.emit(files.length);
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.cdr.markForCheck();
        this.dialog.error(this.extractMessage(err) || 'Không tải được danh sách file đính kèm');
      },
    });
  }

  triggerPicker(): void {
    if (this.readonly || this.uploading) return;
    this.fileInput?.nativeElement.click();
  }

  onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fileList = input.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    input.value = ''; // cho phép chọn lại cùng file

    this.uploading = true;
    this.entryFileService.upload(this.templateId, this.entryId, files).subscribe({
      next: uploaded => {
        this.files = [...uploaded, ...this.files];
        this.uploading = false;
        this.filesCountChange.emit(this.files.length);
        this.cdr.markForCheck();
        this.dialog.success(`Đã upload ${uploaded.length} file`);
      },
      error: (err: HttpErrorResponse) => {
        this.uploading = false;
        this.cdr.markForCheck();
        this.dialog.error(this.extractMessage(err) || 'Upload file thất bại');
      },
    });
  }

  onDelete(file: EntryFileItem): void {
    if (this.readonly) return;
    this.dialog
      .confirm({
        title: 'Xóa file đính kèm',
        message: `Xóa file "${file.originalFileName}"? File sẽ bị xóa khỏi hệ thống.`,
        confirmText: 'Xóa',
        cancelText: 'Hủy',
        status: 'error',
      })
      .subscribe(ok => {
        if (!ok) return;
        this.entryFileService.delete(this.templateId, this.entryId, file.id).subscribe({
          next: () => {
            this.files = this.files.filter(f => f.id !== file.id);
            this.filesCountChange.emit(this.files.length);
            this.cdr.markForCheck();
            this.dialog.success('Đã xóa file');
          },
          error: (err: HttpErrorResponse) =>
            this.dialog.error(this.extractMessage(err) || 'Xóa file thất bại'),
        });
      });
  }

  onDownload(file: EntryFileItem): void {
    this.entryFileService.download(this.templateId, this.entryId, file.id, file.originalFileName);
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    this.collapsedChange.emit(this.collapsed);
    this.cdr.markForCheck();
  }

  formatSize(bytes: number): string {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  trackById(_: number, item: EntryFileItem): number {
    return item.id;
  }

  private extractMessage(err: HttpErrorResponse): string | null {
    return err?.error?.message ?? err?.message ?? null;
  }
}
