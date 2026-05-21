import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnDestroy, Output, inject } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { CellValueChangedEvent, ColDef, ColumnResizedEvent, DomLayoutType, GridApi, GridReadyEvent, RowDragEndEvent, RowDoubleClickedEvent, RowStyle } from 'ag-grid-community';
import { RangeSelectionService } from '../../grid-core/range-selection.service';
import { serializeRangeAsTsv, getFormattedCellText } from '../../grid-core/tsv-formatter.util';

@Component({
  selector: 'app-ag-grid-wrapper',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  providers: [RangeSelectionService],
  templateUrl: './ag-grid-wrapper.component.html',
  styleUrls: ['./ag-grid-wrapper.component.scss']
})
export class AgGridWrapperComponent implements OnDestroy {
  @Input() rowData: any[] = [];
  @Input() columnDefs: ColDef[] = [];
  @Input() enableZoom: boolean = true;
  @Input() animateRows: boolean = true;
  @Input() pagination: boolean = false;
  @Input() paginationPageSize: number = 20;
  @Input() suppressCellFocus: boolean = true;
  /**
   * Bật Excel-style cell selection + Ctrl+C copy ra TSV (paste sang Excel/clipboard).
   *
   * KHÔNG bao gồm paste TSV ngược lại grid (read-only feature). Builder + Render dùng
   * RangeSelectionService riêng + PasteHandlerService — không bật flag này (tự wire để
   * tích hợp với undo/permission).
   *
   * Khi `true`:
   * - `suppressCellFocus` bị override `false` (range cần cell focus)
   * - Drag chuột chọn range → `box-shadow: inset 2px blue` highlight
   * - Ctrl+C → serialize range thành TSV → clipboard
   * - ESC → clear range
   */
  @Input() enableRangeSelection: boolean = false;
  @Input() headerHeight: number = 50;
  @Input() height: string = '100%';
  @Input() width: string = '100%';
  @Input() theme: string = 'ag-theme-quartz';
  @Input() defaultColDef: ColDef = {};
  @Input() rowSelection: 'multiple' | 'single' = 'multiple';
  /**
   * Khi `true`, click vào row KHÔNG tự động select row đó. Chỉ checkbox column
   * (hoặc handler cellClicked tự định nghĩa) mới control selection. Dùng khi
   * muốn tránh việc click data cell làm mất multi-selection hiện có.
   */
  @Input() suppressRowClickSelection: boolean = false;
  @Input() enableSorting: boolean = true;
  @Input() enableFilter: boolean = true;
  @Input() rowHeight: number = 40;
  @Input() domLayout: DomLayoutType = 'normal';
  @Input() rowDragManaged: boolean = true;
  @Input() getRowStyle?: (params: any) => RowStyle | undefined;
  /** Delay (ms) trước khi tooltip hiện. 0 = instant (mặc định AG Grid là 2000ms). */
  @Input() tooltipShowDelay: number = 0;
  /**
   * Auto-hide timeout sau khi tooltip đã hiện. AG Grid mặc định 10000ms.
   * Đặt cao (60s) để tooltip luôn còn khi user còn hover; rời chuột là tự ẩn ngay
   * nên giá trị cao không gây phiền.
   */
  @Input() tooltipHideDelay: number = 60000;

  @Output() gridReady = new EventEmitter<GridReadyEvent>();
  @Output() cellValueChanged = new EventEmitter<CellValueChangedEvent>();
  @Output() rowClicked = new EventEmitter<any>();
  @Output() selectionChanged = new EventEmitter<any[]>();
  @Output() rowDragEnd = new EventEmitter<any[]>();
  @Output() rowDoubleClicked = new EventEmitter<RowDoubleClickedEvent>();
  @Output() columnResized = new EventEmitter<ColumnResizedEvent>();

  private gridApi!: GridApi;

  /** Mỗi instance wrapper có styleId riêng để RangeSelectionService inject CSS không
   *  đụng nhau khi nhiều grid mở cùng lúc (vd report multi-template + entry detail). */
  private static instanceCounter = 0;
  private readonly rangeStyleId = `ag-grid-range-${++AgGridWrapperComponent.instanceCounter}`;
  private readonly rangeService = inject(RangeSelectionService);

  /** Effective `suppressCellFocus` truyền xuống ag-grid. Khi `enableRangeSelection`
   *  là true, BẮT BUỘC `suppressCellFocus = false` (range cần cell focus để mouseEvent
   *  fire), bỏ qua Input của caller để tránh cấu hình mâu thuẫn. */
  get effectiveSuppressCellFocus(): boolean {
    return this.enableRangeSelection ? false : this.suppressCellFocus;
  }

  // Zoom
  zoomLevel = 1;
  private readonly ZOOM_STEP = 0.1;
  private readonly ZOOM_MIN = 0.5;
  private readonly ZOOM_MAX = 1.5;

  get zoomPercent(): number {
    return Math.round(this.zoomLevel * 100);
  }

  zoomIn(): void {
    this.zoomLevel = Math.min(this.ZOOM_MAX, +(this.zoomLevel + this.ZOOM_STEP).toFixed(1));
  }

  zoomOut(): void {
    this.zoomLevel = Math.max(this.ZOOM_MIN, +(this.zoomLevel - this.ZOOM_STEP).toFixed(1));
  }

  resetZoom(): void {
    this.zoomLevel = 1;
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    if (this.enableRangeSelection) {
      this.rangeService.attach({
        gridApi: event.api,
        styleId: this.rangeStyleId,
      });
      event.api.addEventListener('cellMouseDown', (e: any) => this.rangeService.onCellMouseDown(e));
      event.api.addEventListener('cellMouseOver', (e: any) => this.rangeService.onCellMouseOver(e));
    }
    this.gridReady.emit(event);
  }

  ngOnDestroy(): void {
    if (this.enableRangeSelection) {
      this.rangeService.detach();
    }
  }

  /**
   * Ctrl+C / Cmd+C khi `enableRangeSelection: true`:
   * - Có range select: serialize thành TSV (multi-line, tab-separated) → clipboard
   * - Không có range nhưng cell focus: copy value của cell đó qua valueFormatter
   * - Native input đang edit: không intercept (browser xử lý copy mặc định)
   *
   * `@HostListener('document:keydown')` để bắt Ctrl+C ở mọi vị trí miễn là wrapper
   * còn mounted. Dùng `clipboard.writeText` async — fallback execCommand không cần
   * vì target trình duyệt hiện đại.
   */
  @HostListener('document:keydown', ['$event'])
  onDocumentKeyDown(ev: KeyboardEvent): void {
    if (!this.enableRangeSelection || !this.gridApi) return;
    if (!(ev.ctrlKey || ev.metaKey) || ev.key.toLowerCase() !== 'c') return;
    // Skip nếu user đang edit native input/textarea — để browser default copy chạy
    const target = ev.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    const bounds = this.rangeService.bounds();
    let text = '';
    if (bounds) {
      text = serializeRangeAsTsv(this.gridApi, bounds);
    } else {
      const focusedCell = this.gridApi.getFocusedCell();
      if (!focusedCell) return;
      const node = this.gridApi.getDisplayedRowAtIndex(focusedCell.rowIndex);
      if (!node) return;
      text = getFormattedCellText(this.gridApi, node, focusedCell.column);
    }
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => { /* silent fail */ });
    ev.preventDefault();
  }

  onRowClicked(event: any): void {
    this.rowClicked.emit(event.data);
  }

  onSelectionChanged(): void {
    const selectedRows = this.gridApi.getSelectedRows();
    this.selectionChanged.emit(selectedRows);
  }

  // Utility methods
  refreshCells(force: boolean = false): void {
    if (this.gridApi) {
      this.gridApi.refreshCells({ force });
    }
  }

  setRowData(data: any[]): void {
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', data);
    }
  }

  // Color utility methods
  setColumnColor(columnId: string, color: 'blue' | 'green' | 'red' | 'yellow'): void {
    if (this.gridApi) {
      const newColumnDefs = this.columnDefs.map(col => {
        if (col.colId === columnId || col.field === columnId) {
          return {
            ...col,
            headerClass: `custom-header-${color}`,
            cellClass: `custom-cell-${color}`
          };
        }
        return col;
      });
      this.gridApi.setGridOption('columnDefs', newColumnDefs);
    }
  }

  setColumnStyle(columnId: string, style: any): void {
    if (this.gridApi) {
      const newColumnDefs = this.columnDefs.map(col => {
        if (col.colId === columnId || col.field === columnId) {
          return {
            ...col,
            cellStyle: style
          };
        }
        return col;
      });
      this.gridApi.setGridOption('columnDefs', newColumnDefs);
    }
  }
  onCellValueChanged(event: CellValueChangedEvent): void {
    this.cellValueChanged.emit(event);
  }
  onRowDragEnd(event: RowDragEndEvent): void {
    this.rowDragEnd.emit(event as any);
  }

  onRowDoubleClicked(event: RowDoubleClickedEvent): void {
    this.rowDoubleClicked.emit(event);
  }

  onColumnResized(event: ColumnResizedEvent): void {
    this.columnResized.emit(event);
  }
}