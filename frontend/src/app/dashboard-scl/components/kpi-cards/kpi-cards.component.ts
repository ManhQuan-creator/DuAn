import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SclKpi } from '../../models/scl-report.model';
import { formatCount, formatCurrencyTrd, formatPercent } from '../../utils/scl-formatters';

/**
 * 6 KPI cards hàng trên cùng dashboard — theo docs mục 5.3.
 * 2 card cuối (Bị chậm, Chưa phê duyệt) tô màu cảnh báo.
 */
@Component({
  selector: 'app-scl-kpi-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './kpi-cards.component.html',
  styleUrls: ['./kpi-cards.component.scss'],
})
export class SclKpiCardsComponent {
  @Input({ required: true }) kpi!: SclKpi;

  // Expose format helpers cho template
  readonly fmtCurrency = formatCurrencyTrd;
  readonly fmtPercent = formatPercent;
  readonly fmtCount = formatCount;
}
