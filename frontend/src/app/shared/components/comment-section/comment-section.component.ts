import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TuiButtonModule, TuiSvgModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiTextareaModule } from '@taiga-ui/kit';
import {
  CommentContent,
  CommentsEditDTO,
  CommentsSendDTO,
  CommentsService,
  UserComment,
} from '../../service/comments.service';
import { EntryFileItem } from '../../../excel-render/service/entry-file.service';
import { CdkScrollable } from '@angular/cdk/scrolling';

export interface CommentsSendWithFilesDTO extends CommentsSendDTO {
  files?: File[];
}

@Component({
  selector: 'app-comment-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButtonModule,
    TuiSvgModule,
    TuiTextareaModule,
    TuiTextfieldControllerModule,
  ],
  templateUrl: './comment-section.component.html',
  styleUrls: ['./comment-section.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentSectionComponent {
  @Input() showInputNewComment = false;

  @Input() currentUser: UserComment | null = null;
  @Input() users: UserComment[] | null = null;
  @Input() comments: CommentContent[] | null = null;

  /**
   * Danh sách file đính kèm từ Comments.attachComments.
   * entryId trên mỗi item = commentContent.id mà file thuộc về.
   */
  @Input() attachments: EntryFileItem[] | null = null;

  @Output() submitComment = new EventEmitter<CommentsSendWithFilesDTO>();
  @Output() saveEdit = new EventEmitter<CommentsEditDTO>();
  @Output() deleteComment = new EventEmitter<number>();

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly commentsService = inject(CommentsService);

  newCommentControl = new FormControl('');
  pendingFiles: File[] = [];
  isDraggingOver = false;

  editControls = new Map<number, FormControl>();

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private readonly el = inject(ElementRef);

  get totalCount(): number {
    return this.comments?.length || 0;
  }

  isMe(userId: number): boolean {
    return this.currentUser?.id === userId;
  }

  edited(id: number): boolean {
    const comment = this.comments?.find((c) => c.id === id);
    if (!comment) return false;
    const created = new Date(comment.createdAt);
    const updated = new Date(comment.updatedAt);
    created.setMilliseconds(0);
    updated.setMilliseconds(0);
    return created.getTime() !== updated.getTime();
  }

  getUserById(userId: number): UserComment | undefined {
    return this.users?.find((u) => u.id === userId);
  }

  getInitials(fullName: string): string {
    return (
      fullName
        ?.trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('') || ''
    );
  }

  formatFullDateTime(dateStr: string): string {
    const date = new Date(dateStr);

    const weekdays = [
      'Chủ nhật',
      'Thứ hai',
      'Thứ ba',
      'Thứ tư',
      'Thứ năm',
      'Thứ sáu',
      'Thứ bảy',
    ];

    const dayName = weekdays[date.getDay()];

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${dayName}, ngày ${day}/${month}/${year} lúc ${hours}:${minutes}`;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  getExt(filename: string): string {
    return filename.split('.').pop()?.toUpperCase() ?? 'FILE';
  }

  parseMentions(text: string): string {
    if (!text) return '';
    return text.replace(
      /@([\w\s\u00C0-\u024F\u1E00-\u1EFF]+?)(?=\s|$|[.,!?])/g,
      '<span class="mention">@$1</span>',
    );
  }

  /**
   * Lấy danh sách file đính kèm của một comment.
   * entryId trên EntryFileItem = commentContent.id
   */
  getAttachmentsForComment(commentId: number): EntryFileItem[] {
    return this.attachments?.filter((a) => a.entryId === commentId) ?? [];
  }

  /**
   * Delegate download xuống CommentsService.
   * entryId trên item = commentId (ID của comment chứa file).
   */
  downloadFile(att: EntryFileItem): void {
    this.commentsService.downloadAttachComment(
      att.entryId,
      att.id,
      att.originalFileName ?? att.fileName ?? `file-${att.id}`,
    );
  }

  // ─── Compose ───────────────────────────────────────────────────────────────

  /**
   * Chỉ mở actions khi focus. Bỏ qua blur để tránh đóng actions
   * khi người dùng click vào button attach / huỷ / góp ý.
   */

  cancelNewComment(): void {
    this.newCommentControl.reset();
    this.pendingFiles = [];
  }

  openFileExplorer(): void {
    this.fileInputRef?.nativeElement?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.handleFiles(input.files);
    input.value = '';
  }

  removePendingFile(index: number): void {
    this.pendingFiles = this.pendingFiles.filter((_, i) => i !== index);
    this.cdr.markForCheck();
  }

  onSubmitComment(): void {
    const content = this.newCommentControl.value?.trim() ?? '';
    if (!content && this.pendingFiles.length === 0) return;
    this.submitComment.emit({
      content,
      groupId: 0,
      files: this.pendingFiles.length > 0 ? [...this.pendingFiles] : undefined,
    });
    this.cancelNewComment();
  }

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isDraggingOver) {
      this.isDraggingOver = true;
      this.cdr.markForCheck();
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const { clientX: x, clientY: y } = event;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      this.isDraggingOver = false;
      this.cdr.markForCheck();
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver = false;
    this.handleFiles(event.dataTransfer?.files ?? null);
  }

  private handleFiles(files: FileList | null): void {
    if (!files || files.length === 0) return;
    const existingNames = new Set(this.pendingFiles.map((f) => f.name));
    const newFiles = Array.from(files).filter(
      (f) => !existingNames.has(f.name),
    );
    this.pendingFiles = [...this.pendingFiles, ...newFiles];
    this.cdr.markForCheck();
  }

  // ─── Edit ─────────────────────────────────────────────────────────────────

  startEdit(comment: CommentContent): void {
    comment.editing = true;
    this.editControls.set(comment.id, new FormControl(comment.content));
    this.cdr.markForCheck();
  }

  cancelEdit(comment: CommentContent): void {
    comment.editing = false;
    this.editControls.delete(comment.id);
    this.cdr.markForCheck();
  }

  onSaveEdit(comment: CommentContent): void {
    this.saveEdit.emit({
      content: this.editControls.get(comment.id)?.value ?? '',
      id: comment.id,
    });
    this.cdr.markForCheck();
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  onDeleteComment(commentId: number): void {
    this.deleteComment.emit(commentId);
    this.cdr.markForCheck();
  }
}
