import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { POLYMORPHEUS_CONTEXT } from '@tinkoff/ng-polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';

export type ServiceTaskType = 'UPDATE_STATUS' | 'NOTIFY';

export interface ServiceTaskDialogData {
  readonly: boolean;
  initialType?: ServiceTaskType;
  delegateExpression?: string;
  targetStatus?: string;
  targetGroup?: string;
  message?: string;
}

export interface ServiceTaskDialogResult {
  type: ServiceTaskType;
  delegateExpression: string;
  fields: Record<string, string>;
}

@Component({
  selector: 'app-service-task-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './service-task-dialog.component.html',
  styleUrls: ['./service-task-dialog.component.scss'],
})
export class ServiceTaskDialogComponent {
  readonly data: ServiceTaskDialogData;

  form = {
    type: 'UPDATE_STATUS' as ServiceTaskType,
    targetStatus: '',
    targetGroup: '',
    message: '',
  };

  readonly typeOptions: { value: ServiceTaskType; label: string }[] = [
    { value: 'UPDATE_STATUS', label: 'Cập nhật trạng thái (updateEntryStatusDelegate)' },
    { value: 'NOTIFY', label: 'Gửi thông báo (taskNotificationDelegate)' },
  ];

  constructor(
    @Inject(POLYMORPHEUS_CONTEXT)
    private readonly context: TuiDialogContext<ServiceTaskDialogResult | null, ServiceTaskDialogData>,
  ) {
    this.data = context.data;

    if (this.data.initialType) this.form.type = this.data.initialType;
    if (this.data.targetStatus) this.form.targetStatus = this.data.targetStatus;
    if (this.data.targetGroup) this.form.targetGroup = this.data.targetGroup;
    if (this.data.message) this.form.message = this.data.message;

    // If delegateExpression indicates notify, switch type for convenience
    const expr = (this.data.delegateExpression || '').trim();
    if (expr.includes('taskNotificationDelegate')) {
      this.form.type = 'NOTIFY';
    } else if (expr.includes('updateEntryStatusDelegate')) {
      this.form.type = 'UPDATE_STATUS';
    }
  }

  get isReadonly(): boolean {
    return !!this.data.readonly;
  }

  get title(): string {
    return this.isReadonly ? 'Xem Service Task' : 'Cấu hình Service Task';
  }

  onTypeChange(): void {
    // Reset fields when type changes (avoid mixing)
    if (this.form.type === 'UPDATE_STATUS') {
      this.form.targetGroup = '';
      this.form.message = '';
    } else {
      this.form.targetStatus = '';
    }
  }

  get canSubmit(): boolean {
    if (this.isReadonly) return false;
    if (this.form.type === 'UPDATE_STATUS') return !!this.form.targetStatus.trim();
    return !!this.form.targetGroup.trim() && !!this.form.message.trim();
  }

  submit(): void {
    if (!this.canSubmit) return;

    if (this.form.type === 'UPDATE_STATUS') {
      this.context.completeWith({
        type: 'UPDATE_STATUS',
        delegateExpression: '${updateEntryStatusDelegate}',
        fields: {
          targetStatus: this.form.targetStatus.trim(),
        },
      });
      return;
    }

    this.context.completeWith({
      type: 'NOTIFY',
      delegateExpression: '${taskNotificationDelegate}',
      fields: {
        targetGroup: this.form.targetGroup.trim(),
        message: this.form.message.trim(),
      },
    });
  }

  cancel(): void {
    this.context.completeWith(null);
  }

  get selectedTypeLabel(): string {
    const found = this.typeOptions.find((o) => o.value === this.form.type);
    return found ? found.label : this.form.type;
  }
}
