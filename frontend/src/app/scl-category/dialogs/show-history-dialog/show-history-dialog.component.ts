import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output
} from '@angular/core';
import { AgGridWrapperComponent } from '../../../shared/components/ag-grid-wrapper/ag-grid-wrapper.component';
import { CustomPaginationComponent } from '../../../shared/components/custom-pagination/custom-pagination.component';
import { AppDialogDirective } from '../../../shared/components/app-dialog.directive';
import { SclCategoryService } from '../../service/scl-category.service';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  ValueGetterParams,
} from 'ag-grid-community';
import { SclHistory } from '../../model/scl-category.model';
import { GridHeaderComponent } from '../../../shared/components/grid-header/grid-header.component';
import { formatDateUtils } from '../../../shared/utils/date-format.util';
import { DATE_FORMAT_ENUM } from '../../../shared/enum/date-time.enum';

@Component({
  selector: 'app-show-history-dialog',
  imports: [
    AgGridWrapperComponent,
    CustomPaginationComponent,
    AppDialogDirective,
    GridHeaderComponent,
  ],
  templateUrl: './show-history-dialog.component.html',
  styleUrl: './show-history-dialog.component.scss',
})
export class ShowHistoryDialogComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() dialogLabel = '';
  @Input() sclCategoryId: number | null = null;

  @Output() isOpenChange = new EventEmitter<boolean>();

  sclHistory: SclHistory[] = [];
  pageNum = 0;
  pageSize = 20;
  totalRows = 0;
  searchText = '';
  private gridApi!: GridApi;
  private sclCategoryService = inject(SclCategoryService);

  defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true,
  };

  columnDefs: ColDef[] = [
    {
      headerName: 'STT',
      colId: 'stt',
      minWidth: 60,
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      valueGetter: (params: ValueGetterParams) => {
        const idx = params.node?.rowIndex;
        if (idx == null) return '';
        const api = params.api;
        if (api.getGridOption('pagination') === true) {
          return (
            api.paginationGetCurrentPage() * api.paginationGetPageSize() +
            idx +
            1
          );
        }
        return idx + 1;
      },
      cellStyle: { textAlign: 'center' },
    },
    {
      headerName: 'Đơn vị',
      field: 'unit',
      flex: 1,
      minWidth: 100,
    },
    {
      headerName: 'Phân loại',
      field: 'assetType',
      flex: 1,
      minWidth: 120,
    },
    {
      headerName: 'Khối lượng thực hiện(%)',
      field: 'actualVolume',
      flex: 1,
      minWidth: 180,
      cellStyle: { textAlign: 'center' },
    },
    {
      headerName: 'Tiến độ',
      field: 'progress',
      flex: 2,
      minWidth: 200,
    },
    {
      headerName: 'Tháng',
      field: 'month',
      minWidth: 200,
    },
    {
      headerName: 'Năm dữ liệu',
      field: 'yearPlan',
      flex: 1,
      minWidth: 120,
      cellStyle: { textAlign: 'center' },
    },
    {
      headerName: 'Thời gian cập nhật',
      field: 'updatedAt',
      flex: 1,
      minWidth: 160,
      cellStyle: { textAlign: 'center' },
      valueFormatter: (params) => formatDateUtils(params.value, DATE_FORMAT_ENUM.DD_MM_YYYY_HH_MM_SS),    
    },
    {
      headerName: 'Ghi chú',
      field: 'note',
      flex: 2,
      minWidth: 150,
    },
  ];

  ngOnChanges() {
    if (this.isOpen) {
      this.loadHistory();
    }
  }

  onGridReady(event: GridReadyEvent) {
    this.gridApi = event.api;
    this.gridApi.sizeColumnsToFit();
  }

  loadHistory() {
    if (!this.sclCategoryId) return;

    this.sclCategoryService
      .searchHistory({
        sclCategoryId: this.sclCategoryId,
        pageNum: 0,
        pageSize: 20,
      })
      .subscribe((data) => {
        this.sclHistory = data.content || [];
        this.totalRows = data.totalElements || 0;
        this.pageNum = data.number || 0;
        this.pageSize = data.size || 20;
      });
  }

  onPageChanged(event: any): void {
    this.pageNum = event.page - 1;
    this.loadHistory();
  }

  onPageSizeChanged(event: any): void {
    this.pageSize = event.pageSize;
    this.pageNum = 0;
    this.loadHistory();
  }

  onClose() {
    this.isOpen = false;
    this.isOpenChange.emit(this.isOpen);
  }
}
