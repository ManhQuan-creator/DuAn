import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ColDef, ColGroupDef, ValueFormatterParams } from 'ag-grid-community';
import { AgGridWrapperComponent } from '../../../shared/components/ag-grid-wrapper/ag-grid-wrapper.component';
import { SclReportRow } from '../../models/scl-report.model';
import { formatCount, formatCurrencyTrd, formatPercent } from '../../utils/scl-formatters';

/**
 * Data grid các đơn vị — docs mục 5.6.
 * Column groups match cấu trúc merged cells của Excel gốc (đơn giản hóa cho MVP).
 * Dòng TỔNG CỘNG được append ở cuối rowData (ag-grid-wrapper chưa expose
 * `pinnedBottomRowData`). Export Excel/PDF sẽ thêm phase sau.
 */
@Component({
  selector: 'app-scl-data-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, AgGridWrapperComponent],
  templateUrl: './scl-data-grid.component.html',
  styleUrls: ['./scl-data-grid.component.scss'],
})
export class SclDataGridComponent implements OnChanges {
  @Input() units: SclReportRow[] = [];
  @Input() total: SclReportRow | null = null;

  colDefs: (ColDef | ColGroupDef)[] = [];
  rowData: SclReportRow[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['units'] || changes['total']) {
      // ag-grid-wrapper hiện chưa hỗ trợ `pinnedBottomRowData` → append TOTAL
      // vào cuối rowData với styling riêng (xem `getRowStyle` nếu cần).
      this.rowData = this.total ? [...this.units, this.total] : [...this.units];
    }
    if (!this.colDefs.length) this.colDefs = this.buildColDefs();
  }

  private buildColDefs(): (ColDef | ColGroupDef)[] {
    const money = (p: ValueFormatterParams) => formatCurrencyTrd(p.value);
    const count = (p: ValueFormatterParams) => formatCount(p.value);
    const pct = (p: ValueFormatterParams) => formatPercent(p.value);

    return [
      {
        field: 'stt', headerName: 'STT', pinned: 'left',
        width: 80, minWidth: 60,
        valueFormatter: p => p.value == null ? 'Σ' : String(p.value),
      },
      {
        field: 'donVi', headerName: 'Tên đơn vị', pinned: 'left',
        minWidth: 240, width: 260,
      },
      {
        headerName: 'Kế hoạch chi phí SCL (trđ)',
        children: [
          { field: 'khChiPhiTong', headerName: 'Tổng',    width: 140, valueFormatter: money, type: 'numericColumn' },
          { field: 'khChiPhi110kv', headerName: '110kV',   width: 140, valueFormatter: money, type: 'numericColumn' },
          { field: 'khChiPhiKhac',  headerName: 'Khác 110kV', width: 140, valueFormatter: money, type: 'numericColumn' },
        ],
      },
      {
        headerName: 'Hạch toán',
        children: [
          { field: 'hachToanChiPhi', headerName: 'Đã hạch toán', width: 140, valueFormatter: money, type: 'numericColumn' },
          { field: 'tyLeHachToan',   headerName: '% tỷ lệ',       width: 100, valueFormatter: pct,   type: 'numericColumn' },
        ],
      },
      {
        headerName: 'Khối lượng thực hiện (trđ)',
        children: [
          { field: 'klT1', headerName: 'T1', width: 100, valueFormatter: count, type: 'numericColumn' },
          { field: 'klT2', headerName: 'T2', width: 100, valueFormatter: count, type: 'numericColumn' },
          { field: 'klT3', headerName: 'T3', width: 100, valueFormatter: count, type: 'numericColumn' },
          { field: 'klT4', headerName: 'T4', width: 100, valueFormatter: count, type: 'numericColumn' },
          { field: 'klT5', headerName: 'T5', width: 100, valueFormatter: count, type: 'numericColumn' },
          { field: 'klT6', headerName: 'T6', width: 100, valueFormatter: count, type: 'numericColumn' },
          { field: 'klLuyKe', headerName: 'Lũy kế', width: 120, valueFormatter: count, type: 'numericColumn' },
        ],
      },
      {
        headerName: 'Hạng mục (số lượng)',
        children: [
          { field: 'hmTrienkhaiTong', headerName: 'Triển khai', width: 110, valueFormatter: count, type: 'numericColumn' },
          { field: 'hmDuyetTong',     headerName: 'Đã duyệt',    width: 110, valueFormatter: count, type: 'numericColumn' },
          { field: 'hmChuaDuyet',     headerName: 'Chưa duyệt',  width: 110, valueFormatter: count, type: 'numericColumn' },
        ],
      },
      {
        headerName: 'Tiến độ đến 30/6',
        children: [
          { field: 'tdDauThau', headerName: 'Đấu thầu',  width: 100, valueFormatter: count, type: 'numericColumn' },
          { field: 'tdDaKyHd',  headerName: 'Ký HĐ',     width: 100, valueFormatter: count, type: 'numericColumn' },
          { field: 'tdThiCongTong', headerName: 'Đang TC', width: 110, valueFormatter: count, type: 'numericColumn' },
          { field: 'tdXongTong', headerName: 'Xong',     width: 100, valueFormatter: count, type: 'numericColumn' },
        ],
      },
      {
        headerName: 'Hoàn thành SAU 30/6',
        children: [
          { field: 'htSauTong',  headerName: 'Tổng',  width: 100, valueFormatter: count, type: 'numericColumn', cellClass: 'cell--warn' },
          { field: 'htSau110kv', headerName: '110kV', width: 100, valueFormatter: count, type: 'numericColumn' },
          { field: 'htSauTht',   headerName: 'THT',   width: 100, valueFormatter: count, type: 'numericColumn' },
          { field: 'htSauKhac',  headerName: 'Khác',  width: 100, valueFormatter: count, type: 'numericColumn' },
        ],
      },
      {
        field: 'duKienHoanThanh', headerName: 'Dự kiến HT',
        width: 130, minWidth: 110,
      },
      {
        field: 'ghiChu', headerName: 'Ghi chú / Lý do chậm',
        minWidth: 300, flex: 1,
        tooltipField: 'ghiChu',
      },
    ];
  }
}
