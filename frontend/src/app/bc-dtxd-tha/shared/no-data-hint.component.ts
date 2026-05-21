import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Banner cam hiển thị phía trên dashboard khi entry kỳ hiện tại chưa có data.
 * Kèm nút "Mở /excel-render" để NSD bắt đầu nhập số liệu.
 */
@Component({
  selector: 'app-no-data-hint',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './no-data-hint.component.html',
  styleUrls: ['./no-data-hint.component.scss'],
})
export class NoDataHintComponent {
  private readonly router = inject(Router);

  @Input() templateId: number | null = null;
  @Input() message =
    'Kỳ này chưa có dữ liệu. Vui lòng nhập số liệu báo cáo qua màn hình nhập liệu để hiển thị KPI và biểu đồ.';

  openExcelRender(): void {
    if (this.templateId == null) return;
    this.router.navigate(['/excel-render'], {
      queryParams: { templateId: this.templateId },
    });
  }
}
