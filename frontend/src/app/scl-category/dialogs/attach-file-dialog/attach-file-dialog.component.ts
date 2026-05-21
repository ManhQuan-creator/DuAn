import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TuiButtonModule, TuiSvgModule } from '@taiga-ui/core';
import { AppDialogDirective } from '../../../shared/components/app-dialog.directive';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { EntryFileItem } from '../../../excel-render/service/entry-file.service';
import { GridHeaderComponent } from "../../../shared/components/grid-header/grid-header.component";

@Component({
  selector: 'app-attach-file-dialog',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TuiSvgModule,
    AppDialogDirective,
    TuiButtonModule,
    GridHeaderComponent
],
  templateUrl: './attach-file-dialog.component.html',
  styleUrl: './attach-file-dialog.component.scss',
  
})
export class AttachFileDialogComponent {
  @Input() isOpen = false;
  @Input() attachedFiles: EntryFileItem[] = [];
  // attachedFiles: EntryFileItem[] = [
  //   {
  //     id: 141,
  //     entryId: 1,
  //     fileName: 'a1b2c3d4-1111-2222-3333-abcdef123456.pdf',
  //     originalFileName: 'Suggested Document 1.pdf',
  //     fileSize: 523456,
  //     fileType: 'application/pdf',
  //     createdBy: 'admin',
  //     createdAt: '2026-05-05T15:49:20',
  //   },
  //   {
  //     id: 142,
  //     entryId: 1,
  //     fileName: 'b2c3d4e5-2222-3333-4444-bcdefa234567.pdf',
  //     originalFileName: 'Suggested Document 2.pdf',
  //     fileSize: 845123,
  //     fileType: 'application/pdf',
  //     createdBy: 'admin',
  //     createdAt: '2026-05-05T15:50:10',
  //   },
  //   {
  //     id: 143,
  //     entryId: 1,
  //     fileName: 'c3d4e5f6-3333-4444-5555-cdefab345678.pdf',
  //     originalFileName: 'Suggested Document 3.pdf',
  //     fileSize: 932111,
  //     fileType: 'application/pdf',
  //     createdBy: 'admin',
  //     createdAt: '2026-05-05T15:51:45',
  //   },

  //   // 👉 thêm vài loại khác để test icon
  //   {
  //     id: 144,
  //     entryId: 1,
  //     fileName: 'image-123.png',
  //     originalFileName: 'Screenshot UI.png',
  //     fileSize: 245678,
  //     fileType: 'image/png',
  //     createdBy: 'user1',
  //     createdAt: '2026-05-06T10:20:00',
  //   },
  //   {
  //     id: 145,
  //     entryId: 1,
  //     fileName: 'document.zip',
  //     originalFileName: 'Source Code.zip',
  //     fileSize: 1545678,
  //     fileType: 'application/zip',
  //     createdBy: 'user2',
  //     createdAt: '2026-05-06T11:00:00',
  //   },
  // ];

  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() cancelled = new EventEmitter<void>();

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  getFileIcon(file: EntryFileItem): string {
    const ext = file.fileName.split('.').pop()?.toLowerCase() ?? '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
      return 'tuiIconImage';
    if (ext === 'pdf') return 'tuiIconFile';
    if (['zip', 'rar', '7z'].includes(ext)) return 'tuiIconArchive';
    return 'tuiIconFile';
  }

  downloadFile(index: number): void {
    console.log(index);
    
  }

  onDialogChange(open: boolean): void {
    this.isOpenChange.emit(open);
    if (!open) this.reset();
  }

  private reset(): void {
    this.attachedFiles = [];
  }

  getFileExt(file: EntryFileItem): string {
    return file.fileName.split('.').pop()?.toLowerCase() ?? 'file';
  }

  getThumbClass(file: EntryFileItem): string {
    const ext = file.fileName.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return 'attach-file-item__thumb--pdf';
    if (['xlsx', 'xls', 'csv'].includes(ext))
      return 'attach-file-item__thumb--xlsx';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
      return 'attach-file-item__thumb--image';
    if (['zip', 'rar', '7z'].includes(ext))
      return 'attach-file-item__thumb--zip';
    return 'attach-file-item__thumb--default';
  }

  downloadAll(): void {
    // TODO: implement download all as ZIP
  }
}
