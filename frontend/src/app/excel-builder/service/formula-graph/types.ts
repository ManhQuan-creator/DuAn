/**
 * Types cho FormulaGraphService — DAG dependency graph + topological eval + shadow store.
 */

/** Tham chiếu cell trong grid. rowCode + field giữ nguyên ORIGINAL CASE. */
export interface CellRef {
  rowCode: string;
  field: string;
}

/** Canonical key dạng `rowCode|field` GIỮ NGUYÊN CASE. Map.get/set dùng key này. */
export type CellKey = string;

/**
 * Tạo cellKey từ rowCode + field — GIỮ NGUYÊN CASE.
 *
 * Lý do giữ case: 2 rows có rowCode khác case (vd `rdvpt` và `rDvPT` trong template
 * legacy) là 2 entries DISTINCT trong shadow. Nếu lowercase ở key, chúng collapse vào
 * 1 entry → row sau overwrite formula của row trước → false cycle khi formula chéo.
 *
 * Token resolution case-insensitive (vd `rdvpt_X`) được xử lý ở
 * `dependency-extractor.ts` qua `fieldByLower`/`rowByLower` first-wins map (mirror
 * formulaService.forEachNode runtime: first match wins).
 */
export function makeCellKey(rowCode: string, field: string): CellKey {
  return `${rowCode ?? ''}|${field ?? ''}`;
}

/** Parse cellKey ngược lại CellRef. */
export function parseCellKey(key: CellKey): CellRef {
  const idx = key.indexOf('|');
  return { rowCode: key.slice(0, idx), field: key.slice(idx + 1) };
}

/** Mỗi formula cell trong template: column-level apply cho mọi row, hoặc cell-level override. */
export interface FormulaCell {
  rowCode: string;
  field: string;
  formula: string;
  origin: 'column' | 'cell';
}

/**
 * Tham chiếu external (GETDATA/LOOKUP/MYORG) — không phải cell trong grid hiện tại.
 * Recompute khi entryContext (year/month) hoặc lookup cache đổi.
 */
export interface ExternalRef {
  templateCode: string;
  column: string;
  yearOffset: string;   // raw: "N", "N-3", "2024"
  monthOffset?: string; // raw: "M", "M-1", "3"
  /**
   * - LOOKUP → rowCode tường minh từ formula args.
   * - GETDATA → undefined (runtime match current row).
   * - MYORG  → undefined (runtime match `AuthService.currentUser.companyCode`).
   */
  rowCode?: string;
}

/** Aggregate range metadata — diagnostics-only. rowOrder snapshot tại build time. */
export interface AggregateMeta {
  fn: 'SUM' | 'SUMALL' | 'SUMIF' | 'SUMCOL' | 'AVG' | 'AVGROW' | 'AVGCOL' | 'COUNTIF' | 'VLOOKUP';
  fields: string[];     // 1-2 fields aggregate đụng đến (sumField + condField cho SUMIF)
  rowsExpanded: string[]; // list rowCodes đã expand từ range (original case)
}

/** Output của dependency extractor cho 1 formula. */
export interface ExtractedDeps {
  /** Cell deps có thể resolve trong grid (rowCode + field). */
  cellDeps: CellRef[];
  /** External deps (GETDATA/LOOKUP/MYORG). */
  externalDeps: ExternalRef[];
  /** Aggregate metadata cho diagnostics. */
  aggregates: AggregateMeta[];
  /** Token không resolve được → formula sẽ trả #REF! lúc eval. */
  unresolvedTokens: string[];
}

/** Kết quả build graph. */
export interface GraphBuildResult {
  totalNodes: number;
  formulaNodes: number;
  externalCells: number;
  cycles: CellRef[][];
  buildMs: number;
}

/** Kết quả 1 lần recompute. */
export interface RecomputeStats {
  evaluated: number;
  ms: number;
  cycles: number;
}
