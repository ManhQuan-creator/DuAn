import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Inject, Input, Optional, Output } from '@angular/core';
import { POLYMORPHEUS_CONTEXT } from '@tinkoff/ng-polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';
import { TuiButtonModule } from '@taiga-ui/core';
import { AppDialogDirective } from '../app-dialog.directive';

export interface AcceptDialogData {
  title?: string;
  message: string;
  status?: 'info' | 'success' | 'error' | 'warning';
  confirmText?: string;
  cancelText?: string;
  action?: string;
}

@Component({
  selector: 'app-accept-dialog',
  standalone: true,
  imports: [CommonModule, 
    TuiButtonModule,
    AppDialogDirective,
  ],
  templateUrl: './accept-dialog.component.html',
  styleUrl: './accept-dialog.component.scss'
})
export class AcceptDialogComponent {
  @Input() dataInput?: AcceptDialogData;
  @Input() isOpen = false;
  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  constructor(
    @Optional()
    @Inject(POLYMORPHEUS_CONTEXT)
    private readonly context?: TuiDialogContext<boolean, AcceptDialogData>
  ) {}

  get data(): AcceptDialogData {
    const d = this.dataInput ?? this.context?.data;
  
    return {
      title: d?.title || 'Xác nhận',
      message: d?.message || '',
      status: d?.status || 'info',
      confirmText: d?.confirmText || 'Xác nhận',
      cancelText: d?.cancelText || 'Hủy',
    };
  }

  cancel(): void {
    if (this.context) {
      this.context.completeWith(false);
    } else {
      this.isOpenChange.emit(false);
    }
    this.cancelled.emit();
  }
  
  confirm(): void {
    if (this.context) {
      this.context.completeWith(true);
    } else {
      this.isOpenChange.emit(false);
    }
    this.confirmed.emit();
  }

  get status() {
    return this.data.status;
  }

  get icon(): string {
    switch (this.status) {
      case 'success': return '✓';
      case 'error': return '✖';
      case 'warning': return '⚠';
      default: return '!';
    }
  }
}
