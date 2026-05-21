import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DelayAlert } from '../../models/scl-report.model';

/**
 * Section cảnh báo đơn vị chậm — docs mục 5.5.
 * Card list + ghi chú collapsible nếu dài.
 */
@Component({
  selector: 'app-scl-delay-alerts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './delay-alerts.component.html',
  styleUrls: ['./delay-alerts.component.scss'],
})
export class SclDelayAlertsComponent {
  @Input({ required: true }) alerts!: DelayAlert[];

  expanded = new Set<string>();

  toggle(donVi: string): void {
    if (this.expanded.has(donVi)) this.expanded.delete(donVi);
    else this.expanded.add(donVi);
  }

  isExpanded(donVi: string): boolean {
    return this.expanded.has(donVi);
  }

  /** Ghi chú cần "Xem thêm" nếu dài trên 120 ký tự hoặc có nhiều dòng. */
  isLongNote(note: string | undefined): boolean {
    if (!note) return false;
    return note.length > 120 || note.includes('\n');
  }
}
