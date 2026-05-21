import { Injectable, inject } from '@angular/core';
import { TuiAlertService, TuiDialogService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@tinkoff/ng-polymorpheus';
import { Observable } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';
import { PromptDialogComponent, PromptDialogData, PromptField } from './prompt-dialog.component';

@Injectable({ providedIn: 'root' })
export class AppDialogService {
  private readonly alerts = inject(TuiAlertService);
  private readonly dialogs = inject(TuiDialogService);

  success(message: string, label?: string): void {
    this.alerts.open(message, {
      label: label || 'Thành công',
      status: 'success',
      autoClose: 3000,
    }).subscribe();
  }

  error(message: string, label?: string): void {
    this.alerts.open(message, {
      label: label || 'Lỗi',
      status: 'error',
      autoClose: 5000,
    }).subscribe();
  }

  info(message: string, label?: string): void {
    this.alerts.open(message, {
      label: label || 'Thông báo',
      status: 'info',
      autoClose: 3000,
    }).subscribe();
  }

  warning(message: string, label?: string): void {
    this.alerts.open(message, {
      label: label || 'Cảnh báo',
      status: 'warning',
      autoClose: 4000,
    }).subscribe();
  }

  confirm(options: ConfirmDialogData): Observable<boolean> {
    return this.dialogs.open<boolean>(
      new PolymorpheusComponent(ConfirmDialogComponent),
      { data: options, dismissible: true, size: 's', label: '' }
    );
  }

  prompt(options: PromptDialogData): Observable<Record<string, string> | null> {
    return this.dialogs.open<Record<string, string> | null>(
      new PolymorpheusComponent(PromptDialogComponent),
      { data: options, dismissible: true, size: 'm', label: '' }
    );
  }
}
