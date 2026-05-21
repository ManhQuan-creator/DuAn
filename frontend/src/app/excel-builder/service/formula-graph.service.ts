/**
 * FormulaGraphService — engine kiến trúc Excel cho ExcelPro.
 *
 * 3 thành phần:
 * 1. **Dependency Graph (DAG)**: parse formula → trích `(rowCode, field)` deps,
 *    build forward (`cell → deps`) + reverse (`cell → dependents`) maps.
 *    External refs (GETDATA/LOOKUP) tag riêng — không vào topo edges.
 * 2. **Topological Sort** (Kahn's + Tarjan SCC): sắp xếp formula cells theo thứ tự
 *    `deps trước, dependents sau`. Cycles detect ở build time (deterministic).
 * 3. **Shadow Value Store**: Map<rowCode|field, value> lưu computed value.
 *    valueGetter chỉ đọc shadow (O(1)) — KHÔNG recursion lúc render.
 *
 * Lifecycle:
 * - Load template/entry → `setColumnDefs/setRowOrder/setRawData/setColMap` → `buildGraph` → `recomputeAll`.
 * - Cell edit → `setData(rowCode, field, value)` → BFS reverse-deps → sub-topo eval → update shadow.
 * - Cell config save / row add-delete → `buildGraph` (graph topology đổi) → `recomputeAll`.
 * - Entry context (year/month) đổi → `invalidateExternal()` → recompute external-dep cells.
 */

import { Injectable, inject } from '@angular/core';
import { GridApi, IRowNode, Column, ValueGetterParams } from 'ag-grid-community';
import { FormulaService, FormulaEntryContext } from './formula.service';
import {
  CellRef,
  CellKey,
  FormulaCell,
  ExternalRef,
  GraphBuildResult,
  RecomputeStats,
  makeCellKey,
  parseCellKey,
} from './formula-graph/types';
import { extractDependencies, ExtractContext } from './formula-graph/dependency-extractor';
import { topoSort, collectAffected } from './formula-graph/topo-sort';

/** Subset của ColumnConfig đủ cho graph build — không phụ thuộc model đầy đủ. */
interface ColumnConfigLite {
  field: string;
  formula?: string;
  dataType?: string;
  excelCol?: string;
}

/** Sentinel string lưu vào shadow khi cell có lỗi build/eval. */
const ERR_CIRCULAR = '#CIRCULAR!';
const ERR_NO_ROW = '#NOROW!';

@Injectable({ providedIn: 'root' })
export class FormulaGraphService {
  private formulaService = inject(FormulaService);

  // ============ State (set bởi setters) ============

  private columnConfigs: ColumnConfigLite[] = [];
  private rowOrder: string[] = [];
  private rawData: any[] = [];
  private colMap: { [key: string]: string } = {};
  private entryContext: FormulaEntryContext | null = null;

  // ============ Indexes (build từ setters — O(1) lookup, decouple AG Grid) ============

  /** O(1) lookup row by exact rowCode — thay forEachNode linear scan. Build tại setRawData. */
  private rowByCode = new Map<string, any>();

  /** O(1) lookup synthetic Column by exact field — thay getColumns().find(). Build tại setColumnDefs. */
  private columnByField = new Map<string, Column>();

  /**
   * Cached synthetic GridApi proxy override `forEachNode`/`getColumns`/
   * `getDisplayedRowAtIndex`/`getCellValue` đọc từ snapshot nội bộ (rawData +
   * columnConfigs). Render path (AG Grid valueGetter, refreshCells, vv) vẫn dùng
   * gridApi thật qua component — không qua proxy này.
   *
   * Invalidate khi rawData/columnConfigs thay đổi (set null → next access rebuild).
   */
  private apiProxy: GridApi | null = null;

  // ============ State (build bởi buildGraph) ============

  /** Mọi formula cell trong template (column-level × rows + cell-level overrides). */
  private formulaCells = new Map<CellKey, FormulaCell>();
  /** Forward: cell → set deps. */
  private forward = new Map<CellKey, Set<CellKey>>();
  /** Reverse: cell → set dependents. */
  private reverse = new Map<CellKey, Set<CellKey>>();
  /** External refs (GETDATA/LOOKUP) per cell — recompute khi entryContext đổi. */
  private externalDepsByCell = new Map<CellKey, ExternalRef[]>();
  /** Topo order: deps-first. recomputeAll/Affected đi theo thứ tự này. */
  private topoOrder: CellKey[] = [];
  /** Cycles từ Tarjan SCC. Members sẽ được mark `#CIRCULAR!` trong shadow. */
  private cycles: CellRef[][] = [];
  /** Cycle membership flat set — O(1) lookup trong evaluateOne (replace O(cycles × cycleSize) scan). */
  private cycleMemberSet = new Set<CellKey>();

  // ============ State (eval result) ============

  /** Shadow store: cellKey → computed value (number | string error). */
  private shadow = new Map<CellKey, any>();
  /** Tách error tag riêng (cho diagnostics + getError API). */
  private shadowErrors = new Map<CellKey, string>();

  /** Bound shadow reader cho FormulaService.evaluateForGraph. Closure giữ ref ổn định. */
  private readonly shadowReader = (rowCode: string, field: string): any => {
    return this.shadow.get(makeCellKey(rowCode, field));
  };

  // ============ Public setters ============

  /**
   * No-op stub — giữ chữ ký cho component compat (Builder + Render gọi sau onGridReady).
   * Sau khi decouple formula eval khỏi AG Grid runtime, FormulaGraphService KHÔNG
   * cần gridApi nữa. Tất cả lookup (rows, columns, cells) đi qua snapshot nội bộ
   * (`rowByCode`, `columnByField`, `apiProxy`).
   */
  setGridApi(_api: GridApi | null): void { /* no-op */ }
  setEntryContext(ctx: FormulaEntryContext | null): void { this.entryContext = ctx; }
  setRowOrder(rowCodes: string[]): void { this.rowOrder = rowCodes ?? []; }
  setColMap(map: { [key: string]: string }): void { this.colMap = map ?? {}; }

  /**
   * Set columnConfigs + rebuild `columnByField` index (synthetic Column instances).
   * Invalidate `apiProxy` để lần access sau dùng Column list mới.
   */
  setColumnDefs(configs: ColumnConfigLite[]): void {
    this.columnConfigs = configs ?? [];
    this.columnByField.clear();
    for (const cfg of this.columnConfigs) {
      if (cfg.field) {
        this.columnByField.set(cfg.field, this.buildSyntheticColumn(cfg));
      }
    }
    this.apiProxy = null;
  }

  /**
   * Set rawData + rebuild `rowByCode` index. Invalidate `apiProxy`.
   *
   * Lưu ý: rawData rows được hold by reference — AG Grid mutate `node.data[field]`
   * lúc edit cell sẽ cũng mutate `rawData[i][field]` (cùng object). Nên không cần
   * rebuild rowByCode khi cell value đổi — chỉ cần khi rows array thay đổi
   * (load template, add/delete row).
   */
  setRawData(rows: any[]): void {
    this.rawData = rows ?? [];
    this.rowByCode.clear();
    for (const row of this.rawData) {
      const code = row?.row_code;
      if (code) this.rowByCode.set(String(code), row);
    }
    this.apiProxy = null;
  }

  /**
   * Build synthetic AG Grid `Column` từ ColumnConfigLite. formula.service chỉ dùng
   * `getColId()` và `getColDef()` — minimal interface, KHÔNG cần inflate đầy đủ
   * AG Grid Column (heavy class với hidden state).
   */
  private buildSyntheticColumn(cfg: ColumnConfigLite): Column {
    const colDef = { ...cfg };
    return {
      getColId: () => cfg.field,
      getColDef: () => colDef as any,
    } as Column;
  }

  /** Reset toàn bộ state (gọi khi template close/switch). */
  clear(): void {
    this.formulaCells.clear();
    this.forward.clear();
    this.reverse.clear();
    this.externalDepsByCell.clear();
    this.topoOrder = [];
    this.cycles = [];
    this.cycleMemberSet.clear();
    this.shadow.clear();
    this.shadowErrors.clear();
  }

  // ============ Build graph ============

  /**
   * Parse mọi formula cells, extract deps, build forward+reverse maps, topo sort.
   * Phải gọi sau setColumnDefs + setRowOrder + setRawData + setColMap.
   *
   * 4 bước (mỗi bước một micro-function):
   * 1. `collectFormulaCells` — list mọi formula cell trong template.
   * 2. `buildDepEdges` — extract deps + populate forward/reverse maps.
   * 3. `topoSort` — Kahn + Tarjan SCC.
   * 4. `markCycleMembers` — mark cycle members `#CIRCULAR!` trong shadow.
   */
  buildGraph(): GraphBuildResult {
    const start = performance.now();
    this.resetGraphState();

    const allCells = this.collectFormulaCells();
    this.buildDepEdges(allCells);
    this.runTopoSort();
    this.markCycleMembers();

    return {
      totalNodes: this.formulaCells.size,
      formulaNodes: this.formulaCells.size,
      externalCells: this.externalDepsByCell.size,
      cycles: this.cycles,
      buildMs: performance.now() - start,
    };
  }

  /** Clear graph state nhưng GIỮ public setters (entryContext, columnConfigs, …). */
  private resetGraphState(): void {
    this.formulaCells.clear();
    this.forward.clear();
    this.reverse.clear();
    this.externalDepsByCell.clear();
    this.shadow.clear();
    this.shadowErrors.clear();
    this.cycleMemberSet.clear();
  }

  /**
   * Collect mọi formula cells: column-level × rows (skip cells có override) + cell-level overrides.
   * Cell-level override tracking phải đi sau column-level vì có thể trùng (rowCode, field).
   */
  private collectFormulaCells(): FormulaCell[] {
    const cells: FormulaCell[] = [];

    // Column-level: 1 formula × N rows. Skip rows có cell-level override (formula/dropdown/datePicker).
    for (const colCfg of this.columnConfigs) {
      if (!colCfg.formula) continue;
      for (const row of this.rawData) {
        const rowCode = row?.row_code;
        if (!rowCode) continue;
        const cellCfg = row?._cellConfig?.[colCfg.field];
        if (cellCfg?.formula || cellCfg?.dropdown || cellCfg?.datePicker) continue;
        cells.push({ rowCode, field: colCfg.field, formula: colCfg.formula, origin: 'column' });
      }
    }

    // Cell-level: 1 formula tại 1 (row, field) cụ thể. Override column-level.
    for (const row of this.rawData) {
      const rowCode = row?.row_code;
      if (!rowCode) continue;
      const cfg = row?._cellConfig;
      if (!cfg) continue;
      for (const field of Object.keys(cfg)) {
        const formula = cfg[field]?.formula;
        if (formula) cells.push({ rowCode, field, formula, origin: 'cell' });
      }
    }

    return cells;
  }

  /**
   * Extract deps qua dependency-extractor + populate forward/reverse maps.
   *
   * First-wins per cellKey (case-sensitive): nếu trùng key (cùng exact case) — skip
   * để giữ FIRST formula. Tránh case 2 rows có rowCode khác case (`rdvpt` vs `rDvPT`)
   * collapse vào 1 entry nhầm formula của row sau.
   *
   * Deps trong extracted output đã ORIGINAL CASE (extractor tự CI lookup + first-wins).
   */
  private buildDepEdges(cells: FormulaCell[]): void {
    const allFields = this.columnConfigs.map(c => c.field).filter((f): f is string => !!f);

    for (const cell of cells) {
      const key = makeCellKey(cell.rowCode, cell.field);
      if (this.formulaCells.has(key)) continue; // first-wins
      this.formulaCells.set(key, cell);

      const extractCtx: ExtractContext = {
        currentRowCode: cell.rowCode,
        currentField: cell.field,
        rowOrder: this.rowOrder,
        allFields,
        colMap: this.colMap,
      };
      const deps = extractDependencies(cell.formula, extractCtx);

      this.addForwardEdges(key, deps.cellDeps);

      if (deps.externalDeps.length > 0) {
        this.externalDepsByCell.set(key, deps.externalDeps);
      }
    }
  }

  /** Thêm edges từ `key` → `cellDeps` vào forward + reverse maps. */
  private addForwardEdges(key: CellKey, cellDeps: CellRef[]): void {
    const depKeys = new Set<CellKey>();
    for (const d of cellDeps) {
      depKeys.add(makeCellKey(d.rowCode, d.field));
    }
    this.forward.set(key, depKeys);

    for (const depKey of depKeys) {
      let reverseSet = this.reverse.get(depKey);
      if (!reverseSet) {
        reverseSet = new Set();
        this.reverse.set(depKey, reverseSet);
      }
      reverseSet.add(key);
    }
  }

  /** Topo sort + cache cycles thành format `CellRef[][]` cho diagnostics API. */
  private runTopoSort(): void {
    const sortResult = topoSort(this.forward);
    this.topoOrder = sortResult.order;
    this.cycles = sortResult.cycles.map(scc => scc.map(parseCellKey));
  }

  /**
   * Mark cycle members với `#CIRCULAR!` trong shadow + populate `cycleMemberSet`.
   * Members sẽ bị evaluateOne skip (không gọi formula service).
   */
  private markCycleMembers(): void {
    for (const cycle of this.cycles) {
      for (const ref of cycle) {
        const k = makeCellKey(ref.rowCode, ref.field);
        this.cycleMemberSet.add(k);
        this.shadow.set(k, ERR_CIRCULAR);
        this.shadowErrors.set(k, ERR_CIRCULAR);
      }
    }
  }

  // ============ Eval ============

  /** Evaluate toàn bộ formula cells theo topo order, populate shadow store. */
  recomputeAll(): RecomputeStats {
    const start = performance.now();
    let evaluated = 0;
    for (const key of this.topoOrder) {
      if (this.evaluateOne(key)) evaluated++;
    }
    return { evaluated, ms: performance.now() - start, cycles: this.cycles.length };
  }

  /**
   * Evaluate chỉ tập cells phụ thuộc (transitive) các cells được liệt kê.
   * Walk topoOrder, lọc chỉ những cells trong affectedSet — giữ topo correctness.
   *
   * Seeds KHÔNG được include — caller dùng cho "raw data cell X đã đổi, propagate
   * tới formula dependents". X không phải formula nên không có shadow entry.
   */
  recomputeAffected(changed: CellRef[]): RecomputeStats {
    if (changed.length === 0) return { evaluated: 0, ms: 0, cycles: this.cycles.length };
    const seedKeys = changed.map(c => makeCellKey(c.rowCode, c.field));
    return this.evalSubsetTopo(collectAffected(this.reverse, seedKeys));
  }

  /**
   * User edit cell → component mutate raw data → gọi method này để propagate
   * tới dependents. `value` arg không dùng (raw đã mutate trên AG Grid node);
   * giữ trong signature cho API rõ ràng.
   */
  setData(rowCode: string, field: string, _value?: any): RecomputeStats {
    return this.recomputeAffected([{ rowCode, field }]);
  }

  /**
   * Recompute mọi cells có external deps (GETDATA/LOOKUP) + transitive dependents.
   * Gọi sau khi entryContext đổi (year/month) hoặc lookup cache fill xong.
   *
   * Khác `recomputeAffected`: seeds tự eval lại vì formula của chúng có thể trả
   * giá trị khác (GETDATA cache đã hot, year/month đổi → resolve khác).
   */
  invalidateExternal(): RecomputeStats {
    if (this.externalDepsByCell.size === 0) {
      return { evaluated: 0, ms: 0, cycles: this.cycles.length };
    }
    const seedKeys = Array.from(this.externalDepsByCell.keys());
    const affected = collectAffected(this.reverse, seedKeys);
    for (const k of seedKeys) affected.add(k); // include seeds
    return this.evalSubsetTopo(affected);
  }

  /** Eval mọi cells thuộc `subset` theo topo order. Helper cho recomputeAffected/invalidateExternal. */
  private evalSubsetTopo(subset: Set<CellKey>): RecomputeStats {
    const start = performance.now();
    let evaluated = 0;
    for (const key of this.topoOrder) {
      if (!subset.has(key)) continue;
      if (this.evaluateOne(key)) evaluated++;
    }
    return { evaluated, ms: performance.now() - start, cycles: this.cycles.length };
  }

  /**
   * Evaluate 1 formula cell, store kết quả vào shadow.
   *
   * - Cycle members: skip (đã `#CIRCULAR!` từ buildGraph).
   * - Synthetic params build fail (row/column không tìm thấy): mark `#NOROW!`.
   * - Eval thành công có error → store error string trong shadow để valueGetter
   *   trả cho format render (mirror behavior cũ).
   *
   * Return true nếu eval đã chạy (kể cả có error). False nếu skip vì cycle/no-row.
   */
  private evaluateOne(key: CellKey): boolean {
    if (this.cycleMemberSet.has(key)) return false;

    const cell = this.formulaCells.get(key);
    if (!cell) return false;

    const params = this.buildParams(cell.rowCode, cell.field);
    if (!params) {
      this.shadow.set(key, ERR_NO_ROW);
      this.shadowErrors.set(key, ERR_NO_ROW);
      return false;
    }

    // Set entry context cho FormulaService (GETDATA/LOOKUP cần)
    this.formulaService.setEntryContext(this.entryContext);

    const result = this.formulaService.evaluateForGraph(
      cell.formula, params, this.colMap, this.shadowReader,
    );

    if (result.error) {
      this.shadow.set(key, result.error);
      this.shadowErrors.set(key, result.error);
    } else {
      this.shadow.set(key, result.value);
      this.shadowErrors.delete(key);
    }
    return true;
  }

  // ============ Helpers: build synthetic params ============

  /**
   * Build synthetic ValueGetterParams cho `formulaService.evaluateForGraph`.
   *
   * Nguồn dữ liệu: snapshot nội bộ (`rowByCode` + `columnByField` + `apiProxy`)
   * — KHÔNG đi qua AG Grid `gridApi`. Đây là điểm decouple: formula eval không
   * còn phụ thuộc AG Grid lifecycle (init, destroy, Input binding propagation),
   * loại bỏ class race condition gây `#NOROW!` intermittent.
   *
   * Trả null nếu rowCode/field không tồn tại trong snapshot — caller mark `#NOROW!`.
   */
  private buildParams(rowCode: string, field: string): ValueGetterParams | null {
    const node = this.findNodeByRowCode(rowCode);
    const col = this.findColumn(field);
    if (!node || !col) return null;
    return {
      api: this.getApiProxy(),
      node,
      data: node.data,
      colDef: col.getColDef(),
      column: col,
      getValue: (f: string) => node.data?.[f],
    } as ValueGetterParams;
  }

  /**
   * Tìm row trong snapshot bằng exact-case Map lookup. O(1).
   *
   * Lý do exact case (không CI): `cell.rowCode` trong `formulaCells` đã giữ
   * nguyên case từ `row.row_code` ở `collectFormulaCells`. CI lookup gây collision
   * khi 2 rows có rowCode khác case (vd `rdvpt` vs `rDvPT`) — cả 2 resolve về
   * cùng 1 row → 1 trong 2 cell eval sai data.
   *
   * Trả synthetic IRowNode minimal — chỉ `data` + `id`, đủ cho formula.service
   * (`node.data.row_code`, `node.data[field]`).
   */
  private findNodeByRowCode(rowCode: string): IRowNode | null {
    const row = this.rowByCode.get(rowCode);
    if (!row) return null;
    return { data: row, id: rowCode } as IRowNode;
  }

  /**
   * Tìm Column trong snapshot bằng exact-case Map lookup. O(1).
   * Trả synthetic Column build từ `setColumnDefs`.
   */
  private findColumn(field: string): Column | null {
    return this.columnByField.get(field) ?? null;
  }

  /**
   * Synthetic AG Grid API proxy cho formula.service consume. Override 4 methods
   * mà formula eval dùng (verified từ code path scan):
   *
   * | Method | Đọc từ |
   * |---|---|
   * | `forEachNode(cb)` | `this.rawData` array |
   * | `getColumns()` | synthetic Column list từ `columnByField` |
   * | `getDisplayedRowAtIndex(i)` | `this.rawData[i]` (synthetic IRowNode) |
   * | `getCellValue({rowNode, colKey})` | `rowNode.data?.[colKey]` |
   *
   * Mọi method khác KHÔNG có trong proxy → gọi sẽ `TypeError: undefined is not
   * a function`. Đây là intentional fail-fast: nếu formula.service evolve dùng
   * method GridApi mới, smoke test sẽ phát hiện ngay → mở rộng proxy.
   *
   * Cached → invalidate khi `rawData` hoặc `columnConfigs` thay đổi (set null).
   */
  private getApiProxy(): GridApi {
    if (this.apiProxy) return this.apiProxy;
    const proxy = {
      forEachNode: (cb: (node: IRowNode) => void) => {
        for (const row of this.rawData) {
          const code = row?.row_code;
          cb({ data: row, id: code ? String(code) : undefined } as IRowNode);
        }
      },
      getColumns: () => Array.from(this.columnByField.values()),
      getDisplayedRowAtIndex: (idx: number) => {
        const row = this.rawData[idx];
        if (!row) return null;
        const code = row.row_code;
        return { data: row, id: code ? String(code) : undefined } as IRowNode;
      },
      getCellValue: (params: { rowNode: IRowNode; colKey: string | Column }) => {
        const field = typeof params.colKey === 'string'
          ? params.colKey
          : params.colKey.getColId();
        return params.rowNode.data?.[field];
      },
    } as Partial<GridApi> as GridApi;
    this.apiProxy = proxy;
    return proxy;
  }

  // ============ Public read API (cho valueGetter + diagnostics) ============

  /**
   * Đọc shadow value. Trả raw value (number) hoặc error string ('#REF!'/'#CIRCULAR!'/...).
   * undefined nếu cell không phải formula → caller fallback raw data.
   */
  getValue(rowCode: string, field: string): any {
    return this.shadow.get(makeCellKey(rowCode, field));
  }

  getError(rowCode: string, field: string): string | null {
    return this.shadowErrors.get(makeCellKey(rowCode, field)) ?? null;
  }

  /**
   * Trả set distinct field names mà giá trị có thể đổi nếu (rowCode, field) đổi.
   * Dùng để giới hạn scope `refreshCells({columns: ...})` sau cell edit.
   */
  getDependentFields(rowCode: string, field: string): string[] {
    const key = makeCellKey(rowCode, field);
    const dependents = collectAffected(this.reverse, [key]);
    const fields = new Set<string>();
    for (const depKey of dependents) {
      const cell = this.formulaCells.get(depKey);
      if (cell) fields.add(cell.field);
    }
    return Array.from(fields);
  }

  /** Tất cả field names có ÍT NHẤT 1 formula cell — dùng cho rebuild bulk. */
  getAllFormulaFields(): string[] {
    const fields = new Set<string>();
    for (const cell of this.formulaCells.values()) fields.add(cell.field);
    return Array.from(fields);
  }

  // Diagnostics
  getDependencies(cell: CellRef): CellRef[] {
    const deps = this.forward.get(makeCellKey(cell.rowCode, cell.field));
    return deps ? Array.from(deps).map(parseCellKey) : [];
  }

  getDependents(cell: CellRef): CellRef[] {
    const deps = this.reverse.get(makeCellKey(cell.rowCode, cell.field));
    return deps ? Array.from(deps).map(parseCellKey) : [];
  }

  getCycles(): CellRef[][] {
    return this.cycles;
  }
}
