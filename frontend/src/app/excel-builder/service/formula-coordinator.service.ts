import { Injectable, inject } from '@angular/core';
import { ColDef, ColGroupDef, GridApi } from 'ag-grid-community';
import { Observable, catchError, map, of, takeUntil } from 'rxjs';

import { FormulaService } from './formula.service';
import { FormulaGraphService } from './formula-graph.service';
import { DataLookupService, LookupParams } from './data-lookup.service';
import type { ColumnConfig } from '../excel-builder.component';

export interface FormulaCoordinatorRebuildInput {
  gridApi: GridApi | undefined;
  gridColDefs: (ColDef | ColGroupDef)[];
  colMap: { [key: string]: string };
  columnConfigs: ColumnConfig[];
  rowData: any[];
}

export interface FormulaCoordinatorPreloadInput {
  columnConfigs: ColumnConfig[];
  rowData: any[];
  year: number;
  month: number | null;
  /** Entry orgCode cho LOOKUPENTRY. `null`/undefined → builder/report mode → LOOKUPENTRY trả `#NOORG!`. */
  orgCode?: string | null;
  destroy$: Observable<unknown>;
}

/**
 * Coordinator cho formula lifecycle (Builder + Render — share vì pattern giống nhau,
 * khác duy nhất là input year/month source: Builder = previewYear, Render = entryYear).
 *
 * KHÔNG holds component state — mọi input truyền qua tham số. Điều này cho phép service
 * scope `providedIn: 'root'` an toàn (không leak state giữa Builder/Render mở cùng lúc).
 *
 * Pending flag (`pendingFormulaRebuild`) GIỮ Ở COMPONENT — service chỉ trả `false` khi
 * grid chưa ready để caller tự mark pending và flush ở `onGridReady`.
 */
@Injectable({ providedIn: 'root' })
export class FormulaCoordinatorService {
  private readonly formulaService = inject(FormulaService);
  private readonly formulaGraph = inject(FormulaGraphService);
  private readonly dataLookupService = inject(DataLookupService);

  /**
   * Set entry context cho cả FormulaService + FormulaGraph dựa trên previewYear/Month
   * + entry orgCode (cho LOOKUPENTRY).
   *
   * BẮT BUỘC set lại mỗi lần load (ngay cả khi year không đổi) để tránh stale leak từ
   * ExcelRender (FormulaService là singleton, context render trước có thể vẫn còn).
   *
   * `orgCode` truyền `null`/`undefined` cho:
   *  - Builder mode (chưa bind entry).
   *  - Report mode multi-template (không có "entry hiện tại" duy nhất).
   *  - Entry HQ scope (legacy data).
   * → LOOKUPENTRY trả `#NOORG!` cho mọi cell.
   */
  setupContext(year: number, month: number | null, orgCode?: string | null): void {
    const ctx = {
      year,
      month,
      orgCode: orgCode ?? null,
      getLookupData: (templateCode: string, y: number, m?: number | null, oc?: string | null) =>
        this.dataLookupService.getCachedLookup(templateCode, y, m, oc),
    };
    this.formulaService.setEntryContext(ctx);
    this.formulaGraph.setEntryContext(ctx);
  }

  /**
   * Rebuild dependency graph + recompute all.
   *
   * Returns `false` nếu gridApi chưa ready / đã destroyed → caller mark pending và flush
   * ở `onGridReady`. Returns `true` khi đã rebuild thành công.
   */
  rebuild(input: FormulaCoordinatorRebuildInput): boolean {
    const { gridApi, gridColDefs, colMap, columnConfigs, rowData } = input;
    if (!gridApi || gridApi.isDestroyed()) return false;

    if (gridColDefs && gridColDefs.length > 0) {
      gridApi.setGridOption('columnDefs', gridColDefs);
    }
    this.formulaGraph.setGridApi(gridApi);
    this.formulaGraph.setColMap(colMap);
    this.formulaGraph.setColumnDefs(columnConfigs);
    this.formulaGraph.setRowOrder(rowData.map(r => r?.row_code).filter((c): c is string => !!c));
    this.formulaGraph.setRawData(rowData);
    this.formulaGraph.buildGraph();
    this.formulaGraph.recomputeAll();
    // BẮT BUỘC refresh sau khi shadow populated — cells đã render trước đó (qua
    // setGridOption rowData) đọc shadow rỗng → blank. recomputeAll chỉ populate
    // shadow store, KHÔNG tự trigger AG Grid re-read. Phải explicit refreshCells
    // để AG Grid gọi valueGetter lại + invoke renderer.refresh() (OnPush component
    // sẽ markForCheck → template update).
    gridApi.refreshCells({ force: true });
    return true;
  }

  /**
   * Quét formula trong columnConfigs + cellConfig → batchLookup external refs cần preload
   * (GETDATA/LOOKUP/MYORG/LOOKUPENTRY — `extractGetdataParams` cover cả 4), sau đó gọi
   * `then` (typically rebuild). Đảm bảo cache hot trước khi eval lần đầu.
   *
   * KHÔNG bỏ qua khi list rỗng — vẫn gọi `then` để load tiếp tục.
   */
  preloadGetdataAndThen(input: FormulaCoordinatorPreloadInput, then: () => void): void {
    this.setupContext(input.year, input.month, input.orgCode);

    const allFormulas: string[] = [];
    for (const config of input.columnConfigs) {
      if (config.formula) allFormulas.push(config.formula);
    }
    for (const row of input.rowData) {
      if (row?._cellConfig) {
        for (const field of Object.keys(row._cellConfig)) {
          const cellFormula = row._cellConfig[field]?.formula;
          if (cellFormula) allFormulas.push(cellFormula);
        }
      }
    }

    const lookupParams = this.formulaService.extractGetdataParams(
      allFormulas, input.year, input.month,
    );
    if (lookupParams.length === 0) { then(); return; }

    const requests: LookupParams[] = lookupParams.map(p => ({
      templateCode: p.templateCode,
      year: p.year,
      month: p.month,
      columns: p.columns,
    }));

    this.dataLookupService.batchLookup(requests)
      .pipe(takeUntil(input.destroy$))
      .subscribe({ next: () => then(), error: () => then() });
  }

  /**
   * Đảm bảo lookup cache có đủ data cho mọi external ref (GETDATA/LOOKUP/MYORG)
   * hiện diện trong grid (column + cell config). Dùng ở save flow Render — cell
   * formula có thể được add sau khi load (qua cell config dialog), `dataLookupService`
   * chưa fetch → lookup cache miss → snapshot cho cell phụ thuộc trả `#NODATA!`.
   * Hàm này refetch phần thiếu rồi emit.
   *
   * Iterate qua `gridApi.forEachNode` thay vì `rowData` field để bắt state hiện tại
   * (user có thể đã edit cell config kể từ load).
   */
  ensureLookupCacheReady$(input: {
    gridApi: GridApi | undefined;
    columnConfigs: ColumnConfig[];
    year: number;
    month: number | null;
  }): Observable<void> {
    const allFormulas: string[] = [];
    for (const config of input.columnConfigs) {
      if (config.formula) allFormulas.push(config.formula);
    }
    input.gridApi?.forEachNode((node) => {
      const cellConfig = node.data?._cellConfig;
      if (!cellConfig) return;
      for (const field of Object.keys(cellConfig)) {
        const cellFormula = cellConfig[field]?.formula;
        if (cellFormula) allFormulas.push(cellFormula);
      }
    });

    if (allFormulas.length === 0) return of(undefined);

    const lookupParams = this.formulaService.extractGetdataParams(
      allFormulas, input.year, input.month,
    );

    const missing: LookupParams[] = lookupParams
      .filter(p => !this.dataLookupService.getCachedLookup(p.templateCode, p.year, p.month, null))
      .map(p => ({
        templateCode: p.templateCode,
        year: p.year,
        month: p.month,
        columns: p.columns,
      }));

    if (missing.length === 0) return of(undefined);

    return this.dataLookupService.batchLookup(missing).pipe(
      map(() => undefined),
      // Fetch lỗi thì vẫn tiếp tục — snapshot cho cell phụ thuộc lookup đó sẽ trả
      // '#NODATA!' (hành vi hiện tại).
      catchError(() => of(undefined)),
    );
  }
}
