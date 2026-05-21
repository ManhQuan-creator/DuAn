/**
 * Pure parser: đọc 1 formula string + context → trích danh sách (rowCode, field)
 * deps + external refs.
 *
 * Không import AG Grid → unit-testable.
 *
 * Logic mirror `formula.service.evaluate` tokenization, nhưng OBSERVE thay vì replace:
 * 1. Strip GETDATA(...) / LOOKUP(...) / MYORG(...) / LOOKUPENTRY(...) → record external refs.
 * 2. Strip quoted strings (cho SUMIF/COUNTIF args).
 * 3. Scan aggregate calls → expand range qua `range-expander` → cellDeps.
 * 4. Scan residue identifiers → 4-tier resolution (ROW_COL/COL/ROW/EXCEL).
 * 5. Deduplicate cellDeps.
 */

import { isReservedKeyword, ciKey } from '../../utils/formula-keywords';
import { CellRef, ExternalRef, ExtractedDeps, AggregateMeta } from './types';
import { expandAggregate, AGGREGATE_FNS, RangeExpanderContext } from './range-expander';

export interface ExtractContext {
  /** rowCode hiện tại của formula owner — ORIGINAL CASE. */
  currentRowCode: string;
  /** field hiện tại của formula owner — ORIGINAL CASE. Dùng cho ROW-only resolution. */
  currentField: string;
  /** rowCodes theo display order — ORIGINAL CASE. */
  rowOrder: string[];
  /** Tất cả field names trong template — ORIGINAL CASE. */
  allFields: string[];
  /** colMap (uppercase Excel letter → field name). */
  colMap: { [key: string]: string };
}

// ============ Phase helpers ============

/**
 * Strip GETDATA(args)/LOOKUP(args)/MYORG(args)/LOOKUPENTRY(args) khỏi formula text +
 * record external refs. Replace bằng ` 0 ` để không vướng token scan sau này.
 *
 * `\b` BẮT BUỘC cho LOOKUP/MYORG/LOOKUPENTRY để tránh match nhầm bên trong `VLOOKUP(...)`
 * (mirror formula.service `\bLOOKUP\s*\(`).
 */
function stripExternalRefs(formula: string, externalDeps: ExternalRef[]): string {
  let working = formula;

  working = working.replace(/GETDATA\s*\(([^)]*)\)/gi, (_match, argsStr: string) => {
    const args = splitArgs(argsStr);
    if (args.length >= 3) {
      externalDeps.push({
        templateCode: args[0],
        column: args[1],
        yearOffset: args[2],
        monthOffset: args.length >= 4 ? args[3] : undefined,
      });
    }
    return ' 0 ';
  });

  working = working.replace(/\bLOOKUP\s*\(([^)]*)\)/gi, (_match, argsStr: string) => {
    const args = splitArgs(argsStr);
    if (args.length >= 4) {
      externalDeps.push({
        templateCode: args[0],
        rowCode: args[1],
        column: args[2],
        yearOffset: args[3],
        monthOffset: args.length >= 5 ? args[4] : undefined,
      });
    }
    return ' 0 ';
  });

  // MYORG: shorthand cho LOOKUP với rowCode = currentUser.companyCode (resolve runtime).
  // Dep graph chỉ cần biết external ref params (template/column/year/month) để invalidate
  // khi entryContext đổi — rowCode auth-driven không ảnh hưởng cache key.
  working = working.replace(/\bMYORG\s*\(([^)]*)\)/gi, (_match, argsStr: string) => {
    const args = splitArgs(argsStr);
    if (args.length >= 3) {
      externalDeps.push({
        templateCode: args[0],
        column: args[1],
        yearOffset: args[2],
        monthOffset: args.length >= 4 ? args[3] : undefined,
      });
    }
    return ' 0 ';
  });

  // LOOKUPENTRY: shorthand cho LOOKUP với rowCode = entry.orgCode (entry hiện tại).
  // Layout args giống MYORG (template/column/year/month). Dep graph cũng KHÔNG track
  // rowCode vì orgCode resolve ở runtime từ entryContext.
  working = working.replace(/\bLOOKUPENTRY\s*\(([^)]*)\)/gi, (_match, argsStr: string) => {
    const args = splitArgs(argsStr);
    if (args.length >= 3) {
      externalDeps.push({
        templateCode: args[0],
        column: args[1],
        yearOffset: args[2],
        monthOffset: args.length >= 4 ? args[3] : undefined,
      });
    }
    return ' 0 ';
  });

  return working;
}

/**
 * Replace `"..."` strings bằng placeholder `__QSTR_N__` để token scan KHÔNG nhầm
 * nội dung quoted với identifiers (vd SUMIF/COUNTIF condValue).
 */
function stripQuotedStrings(formula: string, captureBuf: string[]): string {
  return formula.replace(/"[^"]*"/g, (m) => {
    captureBuf.push(m);
    return ` __QSTR_${captureBuf.length - 1}__ `;
  });
}

/**
 * Scan aggregate calls (SUM/SUMALL/SUMIF/...). Expand mỗi call ra `cellDeps[]` qua
 * range-expander, replace bằng ` 0 ` (loại token aggregate name khỏi tier scan).
 *
 * Self-dep filtering: aggregate (SUMALL/SUMIF/COUNTIF/AVG/SUM-có-range-bao-current-row)
 * implicitly include calling cell trong tập rows iterate. Nếu add edge `cell → cell`
 * thì topo Tarjan mark self-loop → false `#CIRCULAR!`. Runtime đọc current cell qua
 * shadow trả `undefined` → fallback raw data (=0) — semantic well-defined. Skip để
 * dep graph match runtime behavior. Direct self-ref (vd `r1_X = r1_X + 1` ở r1.X)
 * vẫn cycle: token resolution ở `scanResidueTokens` KHÔNG dùng filter này.
 */
function expandAggregateCalls(
  formula: string,
  ctx: ExtractContext,
  quotedStrings: string[],
  cellDeps: CellRef[],
  aggregates: AggregateMeta[],
): string {
  const expanderCtx: RangeExpanderContext = {
    rowOrder: ctx.rowOrder,
    allFields: ctx.allFields,
    currentRowCode: ctx.currentRowCode,
  };
  const isSelfDep = (d: CellRef): boolean =>
    d.rowCode === ctx.currentRowCode && d.field === ctx.currentField;

  let working = formula;
  for (const fn of AGGREGATE_FNS) {
    // `FN(...)` — args không nested paren (đủ cho aggregate hiện tại).
    const regex = new RegExp(`\\b${fn}\\s*\\(([^)]*)\\)`, 'gi');
    working = working.replace(regex, (_full, argsStr: string) => {
      // Restore quoted strings trong args (SUMIF/COUNTIF condValue dạng quoted)
      const restoredArgs = argsStr.replace(/__QSTR_(\d+)__/g, (_m: string, idx: string) => {
        return quotedStrings[Number(idx)] ?? '""';
      });
      const deps = expandAggregate(fn, restoredArgs, expanderCtx).filter(d => !isSelfDep(d));
      cellDeps.push(...deps);
      aggregates.push({
        fn: fn.toUpperCase() as AggregateMeta['fn'],
        fields: deps.length > 0 ? Array.from(new Set(deps.map(d => d.field))) : [],
        rowsExpanded: deps.length > 0 ? Array.from(new Set(deps.map(d => d.rowCode))) : [],
      });
      return ' 0 ';
    });
  }
  return working;
}

// ============ 4-tier token resolution ============

/**
 * Build CI first-wins lookup maps cho rowOrder + allFields.
 * Mirror formulaService.forEachNode: lowercase key → first original-case match.
 */
function buildLookupMaps(ctx: ExtractContext): {
  fieldByLower: Map<string, string>;
  rowByLower: Map<string, string>;
} {
  const fieldByLower = new Map<string, string>();
  for (const f of ctx.allFields) {
    const lo = ciKey(f);
    if (!fieldByLower.has(lo)) fieldByLower.set(lo, f);
  }
  const rowByLower = new Map<string, string>();
  for (const rc of ctx.rowOrder) {
    const lo = ciKey(rc);
    if (!rowByLower.has(lo)) rowByLower.set(lo, rc);
  }
  return { fieldByLower, rowByLower };
}

/**
 * Cấp 1: token = `{rowCode}_{field}` (CI). Try mọi field suffix → split rowCode.
 * Trả CellRef nếu match, null nếu không.
 */
function resolveRowCol(
  lowered: string,
  fieldByLower: Map<string, string>,
  rowByLower: Map<string, string>,
): CellRef | null {
  for (const [fieldLo, fieldOrig] of fieldByLower) {
    const suffix = `_${fieldLo}`;
    if (lowered.endsWith(suffix) && lowered.length > suffix.length) {
      const rowLo = lowered.substring(0, lowered.length - suffix.length);
      const rowOrig = rowByLower.get(rowLo);
      if (rowOrig) return { rowCode: rowOrig, field: fieldOrig };
    }
  }
  return null;
}

/**
 * Cấp 4: Excel coord — `J` (current row), `J1` (row index 1).
 * Trả CellRef nếu letters match colMap, null nếu không.
 */
function resolveExcelCoord(
  token: string,
  ctx: ExtractContext,
  excelColKeysSet: Set<string>,
): CellRef | null {
  const upper = token.toUpperCase();
  const m = upper.match(/^([A-Z]+)(\d*)$/);
  if (!m) return null;
  const letters = m[1];
  const rowNumStr = m[2];
  if (!excelColKeysSet.has(letters)) return null;
  const fieldName = ctx.colMap[letters];
  if (!fieldName) return null;

  let rowKey = ctx.currentRowCode;
  if (rowNumStr) {
    const idx = parseInt(rowNumStr, 10) - 1;
    if (idx >= 0 && idx < ctx.rowOrder.length) rowKey = ctx.rowOrder[idx];
  }
  return { rowCode: rowKey, field: fieldName };
}

/**
 * Resolve 1 token qua 4 tiers. Trả CellRef nếu resolve được, null nếu unresolved
 * (caller push vào unresolvedTokens).
 *
 * Tier order match formulaService.evaluate:
 *  1. ROW_COL `{rowCode}_{field}` — split khớp suffix-field
 *  2. COL chỉ field → current row
 *  3. ROW chỉ rowCode → current field
 *  4. EXCEL coord `J`/`J1`
 */
function resolveToken(
  token: string,
  ctx: ExtractContext,
  fieldByLower: Map<string, string>,
  rowByLower: Map<string, string>,
  excelColKeysSet: Set<string>,
): CellRef | null {
  const lowered = token.toLowerCase();

  const rowCol = resolveRowCol(lowered, fieldByLower, rowByLower);
  if (rowCol) return rowCol;

  const fieldOrig = fieldByLower.get(lowered);
  if (fieldOrig) return { rowCode: ctx.currentRowCode, field: fieldOrig };

  const rowOrig = rowByLower.get(lowered);
  if (rowOrig) return { rowCode: rowOrig, field: ctx.currentField };

  return resolveExcelCoord(token, ctx, excelColKeysSet);
}

/** Scan residue identifiers + push deps. Tokens không resolve → unresolvedTokens. */
function scanResidueTokens(
  formula: string,
  ctx: ExtractContext,
  cellDeps: CellRef[],
  unresolvedTokens: string[],
): void {
  const { fieldByLower, rowByLower } = buildLookupMaps(ctx);
  const excelColKeysSet = new Set(Object.keys(ctx.colMap).map(k => k.toUpperCase()));

  const tokenRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(formula)) !== null) {
    const token = match[1];
    if (token.startsWith('__QSTR_')) continue;
    if (isReservedKeyword(token)) continue;

    const ref = resolveToken(token, ctx, fieldByLower, rowByLower, excelColKeysSet);
    if (ref) {
      cellDeps.push(ref);
    } else {
      unresolvedTokens.push(token);
    }
  }
}

/** Dedup cellDeps theo `rowCode|field` key (preserve insertion order). */
function dedupCellDeps(cellDeps: CellRef[]): CellRef[] {
  const seen = new Set<string>();
  const out: CellRef[] = [];
  for (const d of cellDeps) {
    const key = `${d.rowCode}|${d.field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

// ============ Misc ============

/** Tách args bằng comma, strip quote/whitespace. Không support nested paren. */
function splitArgs(argsStr: string): string[] {
  return argsStr.split(',').map((a: string) => a.trim().replace(/^['"]|['"]$/g, ''));
}

// ============ Main entry ============

/**
 * Trích deps từ formula. Trả `unresolvedTokens` — formula sẽ trả `#REF!` lúc eval,
 * nhưng cell vẫn xuất hiện trong graph như formula node với 0 cell-deps.
 */
export function extractDependencies(formula: string, ctx: ExtractContext): ExtractedDeps {
  if (!formula) {
    return { cellDeps: [], externalDeps: [], aggregates: [], unresolvedTokens: [] };
  }

  const cellDeps: CellRef[] = [];
  const externalDeps: ExternalRef[] = [];
  const aggregates: AggregateMeta[] = [];
  const unresolvedTokens: string[] = [];

  let working = stripExternalRefs(formula, externalDeps);

  const quotedStrings: string[] = [];
  working = stripQuotedStrings(working, quotedStrings);

  working = expandAggregateCalls(working, ctx, quotedStrings, cellDeps, aggregates);

  scanResidueTokens(working, ctx, cellDeps, unresolvedTokens);

  return {
    cellDeps: dedupCellDeps(cellDeps),
    externalDeps,
    aggregates,
    unresolvedTokens,
  };
}
