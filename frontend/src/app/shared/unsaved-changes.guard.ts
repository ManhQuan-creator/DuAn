import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { AppDialogService } from './dialog.service';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (component.hasUnsavedChanges()) {
    const dialog = inject(AppDialogService);
    return dialog.confirm({
      title: 'Thay đổi chưa lưu',
      message: 'Bạn có thay đổi chưa được lưu. Bạn có chắc chắn muốn rời khỏi trang này?',
      status: 'warning',
      confirmText: 'Rời khỏi',
      cancelText: 'Ở lại',
    });
  }
  return true;
};
