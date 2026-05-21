import { Injectable, inject } from '@angular/core';
import { GridApi, ValueGetterParams, IRowNode, Column } from 'ag-grid-community';
import { RESERVED_KEYWORDS, ciKey, isReservedKeyword } from '../utils/formula-keywords';
import { AuthService } from '../../auth/auth.service';

export interface FormulaResult {
  value: number | string;
  // null = OK
  // Errors: "#SYNTAX!" / "#REF!" / "#CIRCULAR!" / "#DIV/0!" / "#VALUE!" / "#NOCOL!"
  // Warnings (data missing, không phải formula sai):
  //   "#NOTEMPLATE!" — mã báo cáo không tồn tại (sai)
  //   "#NODATA!"     — mã báo cáo đúng, nhưng chưa có entry data cho year/month/orgCode
  //   "#NOROW!"      — mã đúng, có data, nhưng không có row_code matching
  //   "#NOORG!"      — MYORG dùng nhưng user đang login không có companyCode (vd user HQ)
  error?: string;
}

/** Sentinel: lookup response báo template không tồn tại → FE tách `#NOTEMPLATE!` khỏi `#NODATA!`. */
const TEMPLATE_NOT_FOUND_ERROR = '#NOTEMPLATE!';

/**
 * Spec cho 1 cross-entry function (LOOKUP / MYORG / future variants). Tham số hoá:
 *  - tên function + regex word-boundary
 *  - layout args (vị trí column / year / month)
 *  - cách resolve rowCode (LOOKUP từ args, MYORG từ AuthService runtime)
 *  - error code khi rowCode null (LOOKUP: `#SYNTAX!` impossible vì là literal arg, MYORG: `#NOORG!`)
 */
interface CrossEntryFnSpec {
  fnName: string;
  /** Match toàn bộ call (cho compound replace + builder strip). PHẢI có `\b`. */
  regex: RegExp;
  /** Anchor `^...$` cho pure-call detection. */
  pureRegex: RegExp;
  /** Số args tối thiểu. LOOKUP=4 (tpl,row,col,year), MYORG=3 (tpl,col,year). */
  minArgs: number;
  /** Index của column trong args. */
  columnIdx: number;
  /** Index của yearOffset trong args. */
  yearIdx: number;
  /** Index của monthOffset trong args (optional — args.length có thể nhỏ hơn). */
  monthIdx: number;
  /** Resolver rowCode. Trả `null` → fail, caller setError(missingRowCodeError). */
  resolveRowCode: (args: string[]) => string | null;
  /** Error code khi resolveRowCode → null. */
  missingRowCodeError: string;
}

const LOOKUP_FN_SPEC: CrossEntryFnSpec = {
  fnName: 'LOOKUP',
  regex: /\bLOOKUP\s*\(([^)]+)\)/g,
  pureRegex: /^LOOKUP\s*\(([^)]+)\)$/,
  minArgs: 4,
  columnIdx: 2,
  yearIdx: 3,
  monthIdx: 4,
  // LOOKUP rowCode = literal arg; nếu args đủ length thì luôn có (string rỗng vẫn pass).
  resolveRowCode: (args) => args[1],
  missingRowCodeError: '#SYNTAX!', // Không reach được trong thực tế (args check chặn trước).
};

/**
 * Base spec cho MYORG — `resolveRowCode` được build per-instance trong
 * `FormulaService.buildMyorgSpec()` để bind AuthService runtime.
 */
const MYORG_FN_BASE_SPEC: Omit<CrossEntryFnSpec, 'resolveRowCode' | 'missingRowCodeError'> = {
  fnName: 'MYORG',
  regex: /\bMYORG\s*\(([^)]+)\)/g,
  pureRegex: /^MYORG\s*\(([^)]+)\)$/,
  minArgs: 3,
  columnIdx: 1,
  yearIdx: 2,
  monthIdx: 3,
};

/**
 * Base spec cho LOOKUPENTRY — shorthand cho LOOKUP với rowCode = `entry.orgCode`
 * (orgCode của entry đang mở, KHÔNG phải user companyCode như MYORG).
 *
 * Use case: HQ user mở entry PCHN → cell auto lookup data PCHN. PC user mở entry
 * chính mình → kết quả giống MYORG. Entry không có orgCode (HQ scope / report mode)
 * → `#NOORG!`.
 *
 * `resolveRowCode` build per-instance trong `FormulaService.buildLookupEntrySpec()`
 * để đọc `entryContext.orgCode` runtime (entryContext có thể đổi giữa các evaluate).
 */
const LOOKUPENTRY_FN_BASE_SPEC: Omit<CrossEntryFnSpec, 'resolveRowCode' | 'missingRowCodeError'> = {
  fnName: 'LOOKUPENTRY',
  regex: /\bLOOKUPENTRY\s*\(([^)]+)\)/g,
  pureRegex: /^LOOKUPENTRY\s*\(([^)]+)\)$/,
  minArgs: 3,
  columnIdx: 1,
  yearIdx: 2,
  monthIdx: 3,
};

/** Context for GETDATA / LOOKUP / MYORG / LOOKUPENTRY resolution — set by ExcelRenderComponent */
export interface FormulaEntryContext {
  year: number;
  month?: number | null;
  /**
   * orgCode của entry hiện tại đang mở. Dùng cho `LOOKUPENTRY` — rowCode tự lấy từ đây.
   * `null`/`undefined` (entry HQ scope, report mode multi-template, hoặc legacy data)
   * → LOOKUPENTRY trả `#NOORG!`.
   */
  orgCode?: string | null;
  /** Callback to get cached lookup data synchronously */
  getLookupData: (templateCode: string, year: number, month?: number | null, orgCode?: string | null) => LookupData | undefined;
}

export interface LookupData {
  templateCode: string;
  year: number;
  month: number | null;
  orgCode: string | null;
  rows: Record<string, any>[];
  /**
   * `false` = mã báo cáo không tồn tại (FE trả `#NOTEMPLATE!`).
   * `true` (hoặc undefined) = template tồn tại; rows empty → `#NODATA!`.
   */
  templateExists?: boolean;
}

/**
 * Reader đọc shadow store cho 1 cell (rowCode + field, lower-case).
 * Trả `undefined` nếu cell không phải formula → caller fallback raw data.
 * Trả error string ("#REF!"...) nếu eval ra error → caller propagate.
 */
export type ShadowReader = (rowCode: string, field: string) => any;

@Injectable({ providedIn: 'root' })
export class FormulaService {

  /** Reserved keywords giờ import từ utils/formula-keywords — share với dialog validators. */
  private readonly RESERVED_KEYWORDS = RESERVED_KEYWORDS;

  /** AuthService dùng cho MYORG: rowCode tự lấy từ companyCode user đang login. */
  private readonly authService = inject(AuthService);

  private gridApi: GridApi | null = null;
  setGridApi(api: GridApi): void { this.gridApi = api; }

  /** Entry context for GETDATA (year, month, lookup cache) */
  private entryContext: FormulaEntryContext | null = null;
  setEntryContext(ctx: FormulaEntryContext | null): void { this.entryContext = ctx; }

  /**
   * Shadow reader — set bởi `evaluateForGraph` trước khi gọi `evaluateInner`.
   *
   * Khi != null, `getComputedCellValue` đọc shadow store thay vì recurse vào valueGetter.
   * Đây là core của kiến trúc dep graph + topo eval: cells trong topo order phía trước
   * đã có shadow value; cells phía sau chưa eval → shadow trả undefined → fallback raw
   * data (tránh recursion lúc render — root cause của false-#CIRCULAR! cũ).
   */
  private _shadowReader: ShadowReader | null = null;

  /**
   * Eval entry cho graph mode. Caller (FormulaGraphService) set shadow reader,
   * truyền synthetic params trỏ tới rowCode + field cell hiện tại.
   *
   * KHÔNG có circular detection — graph đã topo sort, mọi cell trong order đều
   * có deps đã eval xong (shadow đã populated). Cycles được mark `#CIRCULAR!` ở
   * build time qua Tarjan SCC, không cần runtime stack-based detection.
   *
   * Tính toán công thức với 4 cấp độ ưu tiên (mirror dependency-extractor):
   * 1. ROW_COL: `PCHP_VAT2024` (dòng cụ thể, cột cụ thể)
   * 2. COL:     `VAT2024`      (dòng hiện tại, cột cụ thể)
   * 3. ROW:     `PCHP`         (dòng cụ thể, cột hiện tại)
   * 4. EXCEL:   `J`, `J1`      (vị trí)
   */
  evaluateForGraph(
    formula: string,
    params: ValueGetterParams,
    colMap: { [key: string]: string },
    shadowReader: ShadowReader,
  ): FormulaResult {
    if (!formula) return { value: 0 };
    const prevReader = this._shadowReader;
    this._shadowReader = shadowReader;
    try {
      return this.evaluateInner(formula, params, colMap, 'row_code');
    } finally {
      this._shadowReader = prevReader;
    }
  }

  private evaluateInner(formula: string, params: ValueGetterParams, colMap: { [key: string]: string }, rowIdField: string): FormulaResult {
    let unresolvedRef: string | null = null;
    let getdataError: string | null = null;
    try {
      // 0. Canonical hoá tên hàm (sum → SUM) — reserved function names case-insensitive.
      //    Phải chạy TRƯỚC GETDATA/LOOKUP resolution để regex GETDATA/LOOKUP match được.
      let parsed = this.canonicalizeFunctionNames(formula);

      // 0a. Pre-process GETDATA calls — resolve before tokenizer runs
      const getdataResolved = this.resolveGetdata(parsed, params, rowIdField);
      if (typeof getdataResolved === 'object') {
        return getdataResolved as FormulaResult;
      }
      parsed = getdataResolved;

      // 0b. Pre-process LOOKUP calls — explicit row_code cross-entry reference.
      // Pure LOOKUP(...) → FormulaResult (early return cho text column). Compound → string substitution.
      const lookupResolved = this.resolveLookup(parsed, (e: string) => { getdataError = e; });
      if (typeof lookupResolved === 'object') {
        return lookupResolved as FormulaResult;
      }
      parsed = lookupResolved;

      // 0c. Pre-process MYORG calls — shorthand cho LOOKUP với rowCode = companyCode user.
      const myorgResolved = this.resolveMyorg(parsed, (e: string) => { getdataError = e; });
      if (typeof myorgResolved === 'object') {
        return myorgResolved as FormulaResult;
      }
      parsed = myorgResolved;

      // 0d. Pre-process LOOKUPENTRY calls — shorthand cho LOOKUP với rowCode = entry.orgCode.
      const lookupEntryResolved = this.resolveLookupEntry(parsed, (e: string) => { getdataError = e; });
      if (typeof lookupEntryResolved === 'object') {
        return lookupEntryResolved as FormulaResult;
      }
      parsed = lookupEntryResolved;

      // 1. Xử lý %
      parsed = parsed.replace(/(\d+(\.\d+)?)%/g, '($1/100)');

      // 1.5. Pre-process aggregate functions: quote unquoted arguments
      parsed = this.quoteAggregateArgs(parsed);

      // 2. Tokenizer — preserve quoted strings by temporarily replacing them
      const quotedStrings: string[] = [];
      parsed = parsed.replace(/"[^"]*"/g, (m) => {
        quotedStrings.push(m);
        return `\x00${quotedStrings.length - 1}\x00`;
      });

      // 2.5. Build CI lookup maps 1 lần — dùng xuyên suốt identifier replacement.
      const fieldLookup = this.buildFieldLookup(params);
      const rowLookup = this.buildRowLookup(params, rowIdField);

      parsed = parsed.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (match) => {
        // Reserved keyword → trả canonical uppercase (đảm bảo new Function dispatch đúng)
        if (isReservedKeyword(match)) return match.toUpperCase();

        // Thử lần lượt 4 cấp độ (CI): ROW_COL → COL → ROW → EXCEL
        const currentField = params.colDef.field || '';
        const val =
          this.tryResolveRowCol(match, fieldLookup, rowLookup, params) ??
          this.tryResolveCol(match, fieldLookup, params) ??
          this.tryResolveRow(match, currentField, fieldLookup, rowLookup, params) ??
          this.tryResolveExcel(match, colMap, fieldLookup, params);

        if (val !== null) return val;

        // Không khớp gì cả → ghi nhận tham chiếu lỗi
        unresolvedRef = match;
        return '0';
      });

      // Restore quoted strings
      parsed = parsed.replace(/\x00(\d+)\x00/g, (_, idx) => quotedStrings[Number(idx)]);

      // Check GETDATA errors captured during resolution
      if (getdataError) {
        return { value: 0, error: getdataError };
      }

      // Nếu có tham chiếu không tìm thấy
      if (unresolvedRef) {
        return { value: 0, error: `#REF!` };
      }

      // 3. Validate: chỉ cho phép ký tự an toàn sau khi tokenize
      if (!this.isSafeExpression(parsed)) {
        return { value: 0, error: '#SYNTAX!' };
      }

      // 4. Thực thi
      const context: Record<string, any> = {
        IF: (cond: boolean, t: any, f: any) => cond ? t : f,
        MAX: Math.max, MIN: Math.min, ROUND: Math.round, ABS: Math.abs,
        CEILING: Math.ceil, FLOOR: Math.floor, POW: Math.pow, SQRT: Math.sqrt,
        ...this.buildAggregateFunctions(params)
      };

      const funcKeys = Object.keys(context);
      const funcVals = Object.values(context);

      const func = new Function(...funcKeys, `return ${parsed};`);
      const result = func(...funcVals);

      if (result === Infinity || result === -Infinity) {
        return { value: 0, error: '#DIV/0!' };
      }
      if (isNaN(result)) {
        return { value: 0, error: '#VALUE!' };
      }
      return { value: result };

    } catch (e) {
      return { value: 0, error: '#SYNTAX!' };
    }
  }

  // ============================================================
  // Case-insensitive helpers (micro-functions)
  // ============================================================

  /** Uppercase tên hàm gọi được — `sum(a,b)` → `SUM(a,b)`. Không đụng identifier không phải function. */
  private canonicalizeFunctionNames(formula: string): string {
    return formula.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)(\s*\()/g, (_, name, paren) => {
      return isReservedKeyword(name) ? name.toUpperCase() + paren : name + paren;
    });
  }

  /** Bao nháy kép cho args của aggregate functions chưa được quote. */
  private quoteAggregateArgs(parsed: string): string {
    const aggregateFns = ['SUM', 'SUMALL', 'SUMIF', 'SUMCOL', 'AVGCOL', 'COUNTIF', 'AVG', 'AVGROW', 'VLOOKUP'];
    let result = parsed;
    for (const fn of aggregateFns) {
      const fnRegex = new RegExp(`\\b${fn}\\s*\\(([^)]+)\\)`, 'g');
      result = result.replace(fnRegex, (_fullMatch, argsStr: string) => {
        const quotedArgs = argsStr.split(',').map((a: string) => {
          const trimmed = a.trim();
          if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed;
          if (/^\d+(\.\d+)?$/.test(trimmed)) return trimmed;
          return `"${trimmed}"`;
        }).join(', ');
        return `${fn}(${quotedArgs})`;
      });
    }
    return result;
  }

  /** Map<lowercased field, Column> — lookup O(1) thay vì array.find(). */
  private buildFieldLookup(params: ValueGetterParams): Map<string, Column> {
    const lookup = new Map<string, Column>();
    const cols = params.api.getColumns();
    if (!cols) return lookup;
    for (const col of cols) {
      const field = col.getColDef().field;
      if (field) lookup.set(ciKey(field), col);
    }
    return lookup;
  }

  /** Map<lowercased row_code, IRowNode> — dùng cho CI row lookup. */
  private buildRowLookup(params: ValueGetterParams, rowIdField: string): Map<string, IRowNode> {
    const lookup = new Map<string, IRowNode>();
    params.api.forEachNode(node => {
      const code = node.data?.[rowIdField];
      if (code) lookup.set(ciKey(code), node);
    });
    return lookup;
  }

  /** Chuẩn hoá value về chuỗi số (fallback '0' khi non-numeric/null). */
  private toNumericString(val: any): string {
    if (val == null || val === '') return '0';
    const num = Number(val);
    return isNaN(num) ? '0' : String(num);
  }

  /** Cấp 1: ROW_COL (`PCHP_VAT2024`). Return chuỗi số hoặc null nếu không match. */
  private tryResolveRowCol(
    token: string,
    fieldLookup: Map<string, Column>,
    rowLookup: Map<string, IRowNode>,
    params: ValueGetterParams,
  ): string | null {
    const lowered = token.toLowerCase();
    for (const [fieldKey, col] of fieldLookup) {
      const suffix = `_${fieldKey}`;
      if (lowered.endsWith(suffix) && lowered.length > suffix.length) {
        const rowKey = lowered.substring(0, lowered.length - suffix.length);
        const rowNode = rowLookup.get(rowKey);
        if (rowNode) {
          return this.toNumericString(this.getComputedCellValue(col, params, rowNode));
        }
      }
    }
    return null;
  }

  /** Cấp 2: COL ONLY — lấy cột tại dòng hiện tại. */
  private tryResolveCol(
    token: string,
    fieldLookup: Map<string, Column>,
    params: ValueGetterParams,
  ): string | null {
    const col = fieldLookup.get(ciKey(token));
    if (!col) return null;
    if (!params.node) return '0';
    return this.toNumericString(this.getComputedCellValue(col, params));
  }

  /** Cấp 3: ROW ONLY — lấy dòng tại cột hiện tại. */
  private tryResolveRow(
    token: string,
    currentField: string,
    fieldLookup: Map<string, Column>,
    rowLookup: Map<string, IRowNode>,
    params: ValueGetterParams,
  ): string | null {
    const rowNode = rowLookup.get(ciKey(token));
    if (!rowNode) return null;
    const col = fieldLookup.get(ciKey(currentField));
    const val = col
      ? this.getComputedCellValue(col, params, rowNode)
      : rowNode.data?.[currentField];
    return this.toNumericString(val);
  }

  /** Cấp 4: EXCEL COORD — `J`, `J1`. colMap keys đã uppercase từ Builder. */
  private tryResolveExcel(
    token: string,
    colMap: { [key: string]: string },
    fieldLookup: Map<string, Column>,
    params: ValueGetterParams,
  ): string | null {
    const upper = token.toUpperCase();
    const m = upper.match(/^([A-Z]+)(\d*)$/);
    if (!m) return null;
    const [, letters, rowNumStr] = m;
    const fieldName = colMap[letters];
    if (!fieldName) return null;

    let targetNode: IRowNode | null | undefined = params.node;
    if (rowNumStr) {
      const rowIndex = parseInt(rowNumStr, 10) - 1;
      targetNode = params.api.getDisplayedRowAtIndex(rowIndex);
    }
    if (!targetNode) return '0';

    const col = fieldLookup.get(ciKey(fieldName));
    const val = col
      ? this.getComputedCellValue(col, params, targetNode)
      : params.api.getCellValue({ rowNode: targetNode, colKey: fieldName });
    return this.toNumericString(val);
  }

  /**
   * Pre-process GETDATA calls in the formula.
   * GETDATA('templateCode', 'column', N-3) or GETDATA('templateCode', 'column', N-3, M-1)
   *
   * Resolves each GETDATA call to a numeric value (or 0 with error).
   * Returns the modified formula string, or a FormulaResult if fatal error.
   */
  private resolveGetdata(formula: string, params: ValueGetterParams, rowIdField: string): string | FormulaResult {
    if (!formula.includes('GETDATA')) return formula;
    if (!this.entryContext) {
      // No entry context (Builder mode) → replace GETDATA calls with 0 to avoid false #REF!
      return formula.replace(/GETDATA\s*\([^)]*\)/g, '0');
    }

    const ctx = this.entryContext;
    const rowCode = params.data?.[rowIdField] || '';

    // Pure GETDATA(...) (formula chỉ gồm 1 call, không toán tử) → trả raw value (text hoặc số).
    // Cần thiết cho cột text (vd GHICHU): substitution numeric thông thường ép Number(text) → NaN → 0.
    const pureMatch = formula.trim().match(/^GETDATA\s*\(([^)]+)\)$/);
    if (pureMatch) {
      const pureResult = this.resolvePureGetdata(pureMatch[1], rowCode, ctx);
      if (pureResult !== undefined) return pureResult;
    }

    // Match GETDATA(...) with nested parens support (simple level)
    const getdataRegex = /GETDATA\s*\(([^)]+)\)/g;
    let result = formula;
    let error: string | null = null;

    result = result.replace(getdataRegex, (fullMatch, argsStr: string) => {
      if (error) return '0'; // Already errored, skip further

      // Parse arguments (split by comma, strip quotes)
      const args = argsStr.split(',').map(a => a.trim().replace(/^['"]|['"]$/g, ''));
      if (args.length < 3) {
        error = '#SYNTAX!';
        return '0';
      }

      const templateCode = args[0];
      const column = args[1];
      const yearOffsetStr = args[2];
      const monthStr = args.length >= 4 ? args[3] : undefined;

      // Resolve year
      const targetYear = this.resolveYearOffset(yearOffsetStr, ctx.year);
      if (targetYear === null) {
        error = '#SYNTAX!';
        return '0';
      }

      // Resolve month (optional)
      const targetMonth = monthStr ? this.resolveMonthOffset(monthStr, ctx.month) : null;

      // Get lookup data from cache
      const lookupData = ctx.getLookupData(templateCode, targetYear, targetMonth?.month, null);
      if (lookupData && lookupData.templateExists === false) {
        error = TEMPLATE_NOT_FOUND_ERROR;
        return '0';
      }
      if (!lookupData || lookupData.rows.length === 0) {
        error = '#NODATA!';
        return '0';
      }

      // Handle year rollover for M-1 when month=1
      const effectiveYear = targetMonth?.yearAdjust ? targetYear + targetMonth.yearAdjust : targetYear;
      if (effectiveYear !== targetYear) {
        const adjustedLookup = ctx.getLookupData(templateCode, effectiveYear, targetMonth?.month, null);
        if (adjustedLookup && adjustedLookup.templateExists === false) {
          error = TEMPLATE_NOT_FOUND_ERROR;
          return '0';
        }
        if (!adjustedLookup || adjustedLookup.rows.length === 0) {
          error = '#NODATA!';
          return '0';
        }
        return this.extractGetdataValue(adjustedLookup.rows, rowCode, column, (e) => { error = e; });
      }

      return this.extractGetdataValue(lookupData.rows, rowCode, column, (e) => { error = e; });
    });

    if (error) {
      return { value: 0, error } as FormulaResult;
    }
    return result;
  }

  /**
   * Resolve pure GETDATA(...) formula → trả raw value (string hoặc number) qua FormulaResult.
   * Gọi khi formula CHỈ gồm 1 GETDATA call (không có toán tử bao quanh).
   *
   * Lý do tách: pipeline numeric thông thường ép `Number(textValue)` → NaN → '0', cột text (vd GHICHU)
   * sẽ luôn hiển thị 0. Pure GETDATA short-circuit trước tokenizer → giữ raw value.
   *
   * Trả `undefined` nếu syntax sai (caller fallback substitution path để giữ behavior `#SYNTAX!`).
   */
  private resolvePureGetdata(argsStr: string, rowCode: string, ctx: FormulaEntryContext): FormulaResult | undefined {
    const args = argsStr.split(',').map(a => a.trim().replace(/^['"]|['"]$/g, ''));
    if (args.length < 3) return undefined;

    const templateCode = args[0];
    const column = args[1];
    const targetYear = this.resolveYearOffset(args[2], ctx.year);
    if (targetYear === null) return undefined;
    const targetMonth = args.length >= 4 ? this.resolveMonthOffset(args[3], ctx.month) : null;
    const effectiveYear = targetMonth?.yearAdjust ? targetYear + targetMonth.yearAdjust : targetYear;

    const lookupData = ctx.getLookupData(templateCode, effectiveYear, targetMonth?.month, null);
    if (lookupData && lookupData.templateExists === false) {
      return { value: 0, error: TEMPLATE_NOT_FOUND_ERROR };
    }
    if (!lookupData || lookupData.rows.length === 0) return { value: 0, error: '#NODATA!' };

    const matchedRow = lookupData.rows.find(r => r['row_code'] === rowCode);
    if (!matchedRow) return { value: 0, error: '#NOROW!' };
    if (!(column in matchedRow)) return { value: 0, error: '#NOCOL!' };

    const raw = matchedRow[column];
    if (raw == null) return { value: '' };
    if (typeof raw === 'number') return { value: raw };
    const asNum = Number(raw);
    return { value: typeof raw === 'string' && !isNaN(asNum) && raw.trim() !== '' ? asNum : String(raw) };
  }

  private extractGetdataValue(rows: Record<string, any>[], rowCode: string, column: string, setError: (e: string) => void): string {
    // Find matching row
    const matchedRow = rows.find(r => r['row_code'] === rowCode);
    if (!matchedRow) {
      setError('#NOROW!');
      return '0';
    }

    // Get column value
    if (!(column in matchedRow)) {
      setError('#NOCOL!');
      return '0';
    }

    const val = Number(matchedRow[column]);
    return isNaN(val) ? '0' : String(val);
  }

  /**
   * Pre-process LOOKUP calls in the formula.
   * LOOKUP('templateCode', 'rowCode', 'column', yearOffset[, month])
   *
   * Unlike GETDATA, LOOKUP specifies an explicit rowCode instead of matching the current row.
   */
  private resolveLookup(formula: string, setError: (e: string) => void): string | FormulaResult {
    return this.resolveCrossEntry(formula, setError, LOOKUP_FN_SPEC);
  }

  /**
   * Pre-process MYORG calls in the formula.
   * MYORG('templateCode', 'column', yearOffset[, month])
   *
   * Shorthand cho LOOKUP với rowCode tự động lấy từ `companyCode` user đang login.
   * Use case: 1 template chung cho tất cả PC — mỗi đơn vị login thấy số của mình.
   *
   * Cache key dùng orgCode = null (giống LOOKUP) để share batch lookup; row matching
   * vẫn diễn ra ở FE qua `extractGetdataValue` với rowCode = userOrgCode (case-sensitive).
   *
   * User HQ (chưa thuộc 1 PC) → cell trả `#NOORG!`. Precedence so với `#SYNTAX!`:
   * args sai > NOORG (syntax check chạy trước) → consistent giữa pure path + compound path.
   */
  private resolveMyorg(formula: string, setError: (e: string) => void): string | FormulaResult {
    return this.resolveCrossEntry(formula, setError, this.buildMyorgSpec());
  }

  private buildMyorgSpec(): CrossEntryFnSpec {
    const userOrgCode = this.authService.currentUser?.companyCode;
    return {
      ...MYORG_FN_BASE_SPEC,
      // rowCode = companyCode user, return null khi HQ user → trigger `#NOORG!`.
      resolveRowCode: () => userOrgCode || null,
      missingRowCodeError: '#NOORG!',
    };
  }

  /**
   * Pre-process LOOKUPENTRY calls in the formula.
   * LOOKUPENTRY('templateCode', 'column', yearOffset[, month])
   *
   * Shorthand cho LOOKUP với rowCode tự động lấy từ `entry.orgCode` của entry đang mở.
   * Use case: HQ user mở entry PCHN → cell auto lookup data PCHN. Khác MYORG ở chỗ
   * MYORG dùng user companyCode (không đổi giữa các entries), LOOKUPENTRY dùng orgCode
   * của entry hiện tại (đổi theo entry).
   *
   * Cache key dùng orgCode = null (giống LOOKUP/MYORG/GETDATA) để share batch lookup;
   * row matching vẫn diễn ra ở FE qua `extractGetdataValue` với rowCode = entry.orgCode.
   *
   * Entry không có orgCode (HQ scope, report mode multi-template, legacy data) →
   * cell trả `#NOORG!` (symmetric với MYORG khi HQ user).
   */
  private resolveLookupEntry(formula: string, setError: (e: string) => void): string | FormulaResult {
    return this.resolveCrossEntry(formula, setError, this.buildLookupEntrySpec());
  }

  private buildLookupEntrySpec(): CrossEntryFnSpec {
    const entryOrgCode = this.entryContext?.orgCode;
    return {
      ...LOOKUPENTRY_FN_BASE_SPEC,
      // rowCode = entry.orgCode, return null khi entry không có orgCode → trigger `#NOORG!`.
      resolveRowCode: () => entryOrgCode || null,
      missingRowCodeError: '#NOORG!',
    };
  }

  /**
   * Engine xử lý cross-entry function (LOOKUP / MYORG / future variants).
   * Spec quyết định:
   *  - regex word-boundary match cho function name
   *  - vị trí args (rowCode source: từ args[N] hoặc runtime resolver)
   *  - error code khi rowCode resolve fail (vd `#NOORG!` cho MYORG HQ user)
   *
   * Pure path (formula chỉ gồm 1 call) trả raw text/number qua FormulaResult — cần
   * cho cột text vì substitution numeric ép `Number(text)` → '0'. Compound path
   * substitute giá trị numeric (text → '0') để eval expression không NaN.
   */
  private resolveCrossEntry(
    formula: string,
    setError: (e: string) => void,
    spec: CrossEntryFnSpec,
  ): string | FormulaResult {
    if (!formula.includes(spec.fnName)) return formula;
    if (!this.entryContext) {
      // Builder mode: strip để tránh false #REF! khi tokenizer chạy.
      return formula.replace(spec.regex, '0');
    }

    const ctx = this.entryContext;

    // Pure single-call → giữ raw value (text/number). undefined = syntax error → fall
    // through compound (set #SYNTAX!) để precedence syntax > rowCode-missing.
    const pureMatch = formula.trim().match(spec.pureRegex);
    if (pureMatch) {
      const pureResult = this.resolvePureCrossEntry(pureMatch[1], ctx, spec);
      if (pureResult !== undefined) return pureResult;
    }

    return formula.replace(spec.regex, (_fullMatch: string, argsStr: string) => {
      const args = argsStr.split(',').map(a => a.trim().replace(/^['"]|['"]$/g, ''));
      if (args.length < spec.minArgs) {
        setError('#SYNTAX!');
        return '0';
      }

      const rowCode = spec.resolveRowCode(args);
      if (rowCode == null) {
        setError(spec.missingRowCodeError);
        return '0';
      }

      const templateCode = args[0];
      const column = args[spec.columnIdx];
      const targetYear = this.resolveYearOffset(args[spec.yearIdx], ctx.year);
      if (targetYear === null) {
        setError('#SYNTAX!');
        return '0';
      }

      const monthStr = args.length > spec.monthIdx ? args[spec.monthIdx] : undefined;
      const targetMonth = monthStr ? this.resolveMonthOffset(monthStr, ctx.month) : null;
      const effectiveYear = targetMonth?.yearAdjust ? targetYear + targetMonth.yearAdjust : targetYear;
      const effectiveMonth = targetMonth?.month ?? null;

      const lookupData = ctx.getLookupData(templateCode, effectiveYear, effectiveMonth, null);
      if (lookupData && lookupData.templateExists === false) {
        setError(TEMPLATE_NOT_FOUND_ERROR);
        return '0';
      }
      if (!lookupData || lookupData.rows.length === 0) {
        setError('#NODATA!');
        return '0';
      }

      return this.extractGetdataValue(lookupData.rows, rowCode, column, setError);
    });
  }

  /**
   * Resolve pure cross-entry call → FormulaResult với raw value.
   * Trả `undefined` cho syntax error (caller fallback compound → set `#SYNTAX!`).
   * KHÔNG trả `undefined` cho rowCode-missing — fall-through compound sẽ override
   * thành `#SYNTAX!` ở pure-args-bad case (precedence syntax > rowCode-missing).
   */
  private resolvePureCrossEntry(
    argsStr: string,
    ctx: FormulaEntryContext,
    spec: CrossEntryFnSpec,
  ): FormulaResult | undefined {
    const args = argsStr.split(',').map((a) => a.trim().replace(/^['"]|['"]$/g, ''));
    if (args.length < spec.minArgs) return undefined;

    const rowCode = spec.resolveRowCode(args);
    if (rowCode == null) return { value: 0, error: spec.missingRowCodeError };

    const templateCode = args[0];
    const column = args[spec.columnIdx];
    const targetYear = this.resolveYearOffset(args[spec.yearIdx], ctx.year);
    if (targetYear === null) return undefined;
    const monthStr = args.length > spec.monthIdx ? args[spec.monthIdx] : undefined;
    const targetMonth = monthStr ? this.resolveMonthOffset(monthStr, ctx.month) : null;
    const effectiveYear = targetMonth?.yearAdjust ? targetYear + targetMonth.yearAdjust : targetYear;

    const lookupData = ctx.getLookupData(templateCode, effectiveYear, targetMonth?.month, null);
    if (lookupData && lookupData.templateExists === false) {
      return { value: 0, error: TEMPLATE_NOT_FOUND_ERROR };
    }
    if (!lookupData || lookupData.rows.length === 0) return { value: 0, error: '#NODATA!' };

    const matchedRow = lookupData.rows.find((r) => r['row_code'] === rowCode);
    if (!matchedRow) return { value: 0, error: '#NOROW!' };
    if (!(column in matchedRow)) return { value: 0, error: '#NOCOL!' };

    const raw = matchedRow[column];
    if (raw == null) return { value: '' };
    if (typeof raw === 'number') return { value: raw };
    const asNum = Number(raw);
    return {
      value:
        typeof raw === 'string' && !isNaN(asNum) && raw.trim() !== '' ? asNum : String(raw),
    };
  }

  /** Resolve year offset: "N" → current year, "N-3" → current year - 3 */
  private resolveYearOffset(offset: string, currentYear: number): number | null {
    const trimmed = offset.trim();
    // Exact number
    if (/^\d{4}$/.test(trimmed)) return parseInt(trimmed, 10);
    // N or N-x or N+x
    const match = trimmed.match(/^N\s*([+-]\s*\d+)?$/i);
    if (match) {
      if (!match[1]) return currentYear;
      const delta = parseInt(match[1].replace(/\s/g, ''), 10);
      return currentYear + delta;
    }
    return null;
  }

  /** Resolve month offset: "3" → fixed month, "M" → current, "M-1" → current-1 */
  private resolveMonthOffset(offset: string, currentMonth?: number | null): { month: number; yearAdjust: number } | null {
    const trimmed = offset.trim();
    // Fixed number
    if (/^\d{1,2}$/.test(trimmed)) {
      const m = parseInt(trimmed, 10);
      if (m >= 1 && m <= 12) return { month: m, yearAdjust: 0 };
      return null;
    }
    // M or M-x or M+x
    const match = trimmed.match(/^M\s*([+-]\s*\d+)?$/i);
    if (match && currentMonth != null) {
      let m = currentMonth;
      let yearAdj = 0;
      if (match[1]) {
        const delta = parseInt(match[1].replace(/\s/g, ''), 10);
        m += delta;
      }
      // Handle month overflow/underflow
      while (m < 1) { m += 12; yearAdj--; }
      while (m > 12) { m -= 12; yearAdj++; }
      return { month: m, yearAdjust: yearAdj };
    }
    return null;
  }

  /**
   * Kiểm tra biểu thức sau tokenize chỉ chứa ký tự an toàn.
   * Chặn code injection qua new Function().
   */
  private isSafeExpression(parsed: string): boolean {
    let stripped = parsed;
    for (const keyword of this.RESERVED_KEYWORDS) {
      stripped = stripped.replace(new RegExp('\\b' + keyword + '\\b', 'g'), '');
    }
    // Xóa chuỗi quoted (dùng cho SUMIF/COUNTIF)
    stripped = stripped.replace(/"[^"]*"/g, '');
    // Chỉ cho phép: số, khoảng trắng, toán tử, dấu ngoặc, dấu phẩy, so sánh, logic, dấu nháy
    return /^[\d\s+\-*/().,%<>=!&|"]*$/.test(stripped);
  }

  /**
   * Đọc giá trị cell có tính đến valueGetter (công thức cột/ô).
   * Helper nền tảng cho mọi aggregate function. So khớp field case-insensitive.
   */
  private readCellValue(node: IRowNode | null | undefined, field: string, params: ValueGetterParams): any {
    if (!node?.data) return null;
    const key = ciKey(field);
    const col = params.api.getColumns()?.find(c => ciKey(c.getColDef().field) === key);
    if (col) return this.getComputedCellValue(col, params, node);
    // Fallback: tìm raw data case-insensitive (trường hợp data có key khác case)
    return node.data[field] ?? this.findDataValueCi(node.data, field);
  }

  /** Lấy giá trị raw từ data object khi key có thể khác case. */
  private findDataValueCi(data: Record<string, any>, field: string): any {
    const key = ciKey(field);
    for (const k of Object.keys(data)) {
      if (ciKey(k) === key) return data[k];
    }
    return undefined;
  }

  /** Số hoá kết quả readCellValue, fallback 0 khi non-numeric/null. */
  private readNumeric(node: IRowNode | null | undefined, field: string, params: ValueGetterParams): number {
    return Number(this.readCellValue(node, field, params)) || 0;
  }

  /** String hoá kết quả readCellValue (null/undefined → ''). Dùng cho SUMIF/COUNTIF. */
  private readString(node: IRowNode | null | undefined, field: string, params: ValueGetterParams): string {
    const v = this.readCellValue(node, field, params);
    return v == null ? '' : String(v);
  }

  private buildAggregateFunctions(params: ValueGetterParams): Record<string, Function> {
    // `params.api` PHẢI thắng `this.gridApi`: trong graph eval mode, params.api
    // là synthetic proxy của FormulaGraphService (đọc từ rawData snapshot, decouple
    // khỏi AG Grid runtime). Nếu fallback về this.gridApi thì aggregate sẽ iterate
    // qua AG Grid runtime → race condition với Input binding propagation.
    // Legacy mode (no graph) khi params.api null → fallback this.gridApi.
    const api = params.api || this.gridApi;
    const numAt = (node: IRowNode | null | undefined, field: string) => this.readNumeric(node, field, params);
    const strAt = (node: IRowNode | null | undefined, field: string) => this.readString(node, field, params);

    const resolveNode = (rowCode?: string): IRowNode | null => {
      if (!rowCode) return params.node as IRowNode | null;
      const key = ciKey(rowCode);
      let found: IRowNode | null = null;
      api.forEachNode(n => { if (ciKey(n.data?.row_code) === key) found = n; });
      return found;
    };

    const colFieldRange = (startCol: string, endCol: string): string[] => {
      const allColumns = params.api.getColumns();
      if (!allColumns) return [];
      const startKey = ciKey(startCol);
      const endKey = ciKey(endCol);
      const startIdx = allColumns.findIndex(c => ciKey(c.getColDef().field) === startKey);
      const endIdx = allColumns.findIndex(c => ciKey(c.getColDef().field) === endKey);
      if (startIdx === -1 || endIdx === -1) return [];
      const from = Math.min(startIdx, endIdx);
      const to = Math.max(startIdx, endIdx);
      return allColumns.slice(from, to + 1).map(c => c.getColDef().field).filter((f): f is string => !!f);
    };

    const rowMatches = (node: IRowNode, rowCode: string): boolean =>
      ciKey(node.data?.row_code) === ciKey(rowCode);

    /*
     * Defensive `!_isTypeHeader` skip trong các aggregate dưới đây:
     * Khái niệm "type header row" (`_isTypeHeader: true`) đã bị bỏ trong refactor catalog 2026-04 — template mới
     * KHÔNG sinh ra dòng này. Tuy nhiên template cũ (đã save trước refactor) có thể còn rows với flag đó.
     * Skip để aggregate trên template legacy vẫn cho kết quả đúng (dòng header chỉ là divider, không có data).
     * Có thể xóa nếu chắc chắn không còn template legacy chạy production.
     */
    return {
      SUM: (field: string, startRow: string, endRow: string) => {
        let sum = 0, inRange = false;
        api.forEachNode(node => {
          if (rowMatches(node, startRow)) inRange = true;
          if (inRange && !node.data?._isTypeHeader) sum += numAt(node, field);
          if (rowMatches(node, endRow)) inRange = false;
        });
        return sum;
      },

      SUMCOL: (startCol: string, endCol: string, rowCode?: string) => {
        const target = resolveNode(rowCode);
        if (!target) return 0;
        return colFieldRange(startCol, endCol).reduce((s, f) => s + numAt(target, f), 0);
      },

      SUMALL: (field: string) => {
        let sum = 0;
        api.forEachNode(node => {
          if (!node.data?._isTypeHeader) sum += numAt(node, field);
        });
        return sum;
      },

      SUMIF: (sumField: string, condField: string, condValue: string) => {
        let sum = 0;
        api.forEachNode(node => {
          if (!node.data?._isTypeHeader && strAt(node, condField) === condValue) {
            sum += numAt(node, sumField);
          }
        });
        return sum;
      },

      COUNTIF: (field: string, condValue: string) => {
        let count = 0;
        api.forEachNode(node => {
          if (!node.data?._isTypeHeader && strAt(node, field) === condValue) count++;
        });
        return count;
      },

      AVG: (field: string) => {
        let sum = 0, count = 0;
        api.forEachNode(node => {
          if (!node.data?._isTypeHeader) {
            sum += numAt(node, field);
            count++;
          }
        });
        return count > 0 ? sum / count : 0;
      },

      AVGROW: (field: string, startRow: string, endRow: string) => {
        let sum = 0, count = 0, inRange = false;
        api.forEachNode(node => {
          if (rowMatches(node, startRow)) inRange = true;
          if (inRange && !node.data?._isTypeHeader) {
            sum += numAt(node, field);
            count++;
          }
          if (rowMatches(node, endRow)) inRange = false;
        });
        return count > 0 ? sum / count : 0;
      },

      AVGCOL: (startCol: string, endCol: string, rowCode?: string) => {
        const target = resolveNode(rowCode);
        if (!target) return 0;
        const fields = colFieldRange(startCol, endCol);
        if (fields.length === 0) return 0;
        const sum = fields.reduce((s, f) => s + numAt(target, f), 0);
        return sum / fields.length;
      },

      VLOOKUP: (rowCode: string, field: string) => {
        const target = resolveNode(rowCode);
        return target ? numAt(target, field) : 0;
      },
    };
  }

  /**
   * Validate công thức realtime — kiểm tra cú pháp, tham chiếu.
   */
  validate(
    formula: string,
    colMap: Record<string, string>,
    columnFields: string[],
    rowCodes: string[]
  ): { valid: boolean; error?: string; references?: string[] } {
    if (!formula || !formula.trim()) return { valid: true, references: [] };

    const references: string[] = [];
    let error: string | undefined;

    // 1. Kiểm tra ngoặc đóng/mở
    let depth = 0;
    for (const ch of formula) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (depth < 0) { error = 'Thiếu ngoặc mở "("'; break; }
    }
    if (!error && depth > 0) error = 'Thiếu ngoặc đóng ")"';
    if (error) return { valid: false, error };

    // 2. Kiểm tra toán tử liên tiếp
    if (/[+\-*/]{2,}/.test(formula.replace(/\s/g, '').replace(/[<>=!]+/g, 'OP'))) {
      // Cho phép <=, >=, !=, == nhưng không cho ++, --, **, //
      const cleaned = formula.replace(/[<>=!]+/g, '').replace(/\s/g, '');
      if (/[+\-*/]{2,}/.test(cleaned)) {
        return { valid: false, error: 'Toán tử liên tiếp không hợp lệ' };
      }
    }

    // 3. Kiểm tra tham chiếu — tất cả so khớp case-insensitive
    const aggregateFns = ['SUM', 'SUMALL', 'SUMIF', 'SUMCOL', 'AVGCOL', 'COUNTIF', 'AVG', 'AVGROW', 'VLOOKUP'];
    // Remove aggregate function arguments + GETDATA calls (they reference external data)
    // Dùng flag `i` để CI match function name.
    let checkFormula = formula;
    for (const fn of aggregateFns) {
      checkFormula = checkFormula.replace(new RegExp(`\\b${fn}\\s*\\([^)]*\\)`, 'gi'), '0');
    }
    checkFormula = checkFormula.replace(/GETDATA\s*\([^)]*\)/gi, '0');
    // `\b` BẮT BUỘC: tránh match `LOOKUP(` bên trong `VLOOKUP(...)` — sẽ strip args
    // VLOOKUP, residue `V` → false `#REF!` ở validate. Mirror resolveLookup pattern.
    // LOOKUPENTRY strip TRƯỚC LOOKUP để tránh `\bLOOKUP\s*\(` match nhầm — thực tế
    // không match vì `\s*\(` không cover ký tự `E` ngay sau LOOKUP, nhưng strip
    // riêng cho rõ ý + tránh fragile khi regex thay đổi tương lai.
    checkFormula = checkFormula.replace(/\bLOOKUPENTRY\s*\([^)]*\)/gi, '0');
    checkFormula = checkFormula.replace(/\bLOOKUP\s*\([^)]*\)/gi, '0');
    checkFormula = checkFormula.replace(/\bMYORG\s*\([^)]*\)/gi, '0');

    const tokens = checkFormula.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g) || [];
    const fieldKeys = new Set(columnFields.map(f => ciKey(f)));
    const rowKeys = new Set(rowCodes.map(r => ciKey(r)));
    const excelColKeys = new Set(Object.keys(colMap).map(k => k.toUpperCase()));

    for (const token of tokens) {
      if (isReservedKeyword(token)) continue;

      const lowered = token.toLowerCase();

      // Check ROW_COL: rowCode_field (CI)
      let foundRowCol = false;
      for (const fieldKey of fieldKeys) {
        const suffix = `_${fieldKey}`;
        if (lowered.endsWith(suffix) && lowered.length > suffix.length) {
          const rowKey = lowered.substring(0, lowered.length - suffix.length);
          if (rowKeys.has(rowKey)) {
            references.push(token);
            foundRowCol = true;
            break;
          }
        }
      }
      if (foundRowCol) continue;

      if (fieldKeys.has(lowered)) { references.push(token); continue; }
      if (rowKeys.has(lowered)) { references.push(token); continue; }

      const colMatch = token.toUpperCase().match(/^([A-Z]+)(\d*)$/);
      if (colMatch && excelColKeys.has(colMatch[1])) { references.push(token); continue; }

      return { valid: false, error: `Tham chiếu "${token}" không tìm thấy (#REF!)` };
    }

    return { valid: true, references };
  }

  /**
   * Extract all GETDATA and LOOKUP calls from formulas for preloading.
   * Returns unique lookup params needed.
   */
  extractGetdataParams(formulas: string[], entryYear: number, entryMonth?: number | null): {
    templateCode: string;
    year: number;
    month?: number | null;
    columns: string[];
  }[] {
    const lookupMap = new Map<string, { templateCode: string; year: number; month?: number | null; columns: Set<string> }>();

    const addToMap = (templateCode: string, column: string, yearOffsetStr: string, monthStr?: string) => {
      const targetYear = this.resolveYearOffset(yearOffsetStr, entryYear);
      if (targetYear === null) return;

      const targetMonth = monthStr ? this.resolveMonthOffset(monthStr, entryMonth) : null;
      const effectiveYear = targetMonth?.yearAdjust ? targetYear + targetMonth.yearAdjust : targetYear;
      const effectiveMonth = targetMonth?.month ?? null;

      const key = `${templateCode}_${effectiveYear}_${effectiveMonth ?? ''}`;
      if (!lookupMap.has(key)) {
        lookupMap.set(key, { templateCode, year: effectiveYear, month: effectiveMonth, columns: new Set() });
      }
      lookupMap.get(key)!.columns.add(column);
    };

    // Mỗi entry document index của args trong call signature. Dùng `matchAll` thay
    // `exec`-loop để tránh stateful `lastIndex` giữa các formula (nếu loop break giữa
    // chừng do exception, lastIndex không reset → formula kế tiếp scan thiếu).
    const externalRefs: { regex: RegExp; minArgs: number; columnIdx: number; yearIdx: number; monthIdx: number }[] = [
      { regex: /GETDATA\s*\(([^)]+)\)/g,         minArgs: 3, columnIdx: 1, yearIdx: 2, monthIdx: 3 },
      { regex: /\bLOOKUP\s*\(([^)]+)\)/g,        minArgs: 4, columnIdx: 2, yearIdx: 3, monthIdx: 4 },
      // MYORG: rowCode từ AuthService, KHÔNG ảnh hưởng cache key (orgCode = null,
      // share cache với LOOKUP/GETDATA cùng template/year/month).
      { regex: /\bMYORG\s*\(([^)]+)\)/g,         minArgs: 3, columnIdx: 1, yearIdx: 2, monthIdx: 3 },
      // LOOKUPENTRY: rowCode = entry.orgCode (đã trong entryContext lúc preload), cũng KHÔNG
      // ảnh hưởng cache key. Note: `\bLOOKUP\s*\(` ở dòng trên KHÔNG match `LOOKUPENTRY(`
      // vì sau `LOOKUP` là `E` (word char) — `\s*\(` không cover. An toàn order-independent.
      { regex: /\bLOOKUPENTRY\s*\(([^)]+)\)/g,   minArgs: 3, columnIdx: 1, yearIdx: 2, monthIdx: 3 },
    ];

    for (const formula of formulas) {
      for (const { regex, minArgs, columnIdx, yearIdx, monthIdx } of externalRefs) {
        for (const match of formula.matchAll(regex)) {
          const args = match[1].split(',').map(a => a.trim().replace(/^['"]|['"]$/g, ''));
          if (args.length < minArgs) continue;
          addToMap(args[0], args[columnIdx], args[yearIdx], args.length > monthIdx ? args[monthIdx] : undefined);
        }
      }
    }

    return Array.from(lookupMap.values()).map(v => ({
      templateCode: v.templateCode,
      year: v.year,
      month: v.month,
      columns: Array.from(v.columns)
    }));
  }

  /**
   * Lấy giá trị cell có tính đến valueGetter / shadow store.
   *
   * GRAPH MODE (`_shadowReader != null`): đọc shadow store trước. Nếu cell không có
   * formula (không có entry trong shadow) → trả raw data. KHÔNG recurse vào valueGetter
   * — đây là khác biệt cốt lõi với kiến trúc cũ: tránh được cascade evaluation lúc render
   * và false-positive #CIRCULAR! do AG Grid iteration order.
   *
   * LEGACY MODE (`_shadowReader == null`): gọi recursive valueGetter (giữ cho backward
   * compat). Sau refactor không còn caller — components dùng `FormulaGraphService.getValue`.
   */
  private getComputedCellValue(targetCol: any, params: ValueGetterParams, overrideNode?: IRowNode | null): any {
      const colDef = targetCol.getColDef();
      const node = overrideNode ?? params.node;
      if (!node) return null;

      // GRAPH MODE: shadow reader đọc giá trị đã eval xong từ topo earlier-stages.
      if (this._shadowReader) {
          const rowCode = node.data?.row_code;
          const field = colDef.field;
          if (rowCode && field) {
              const shadowVal = this._shadowReader(String(rowCode), String(field));
              if (shadowVal !== undefined) return shadowVal;
          }
          // Cell không có shadow entry → cell không phải formula → raw data
          return node.data?.[colDef.field];
      }

      // LEGACY: recursive valueGetter (chỉ còn dùng nếu external code gọi `evaluate` trực tiếp).
      if (typeof colDef.valueGetter === 'function') {
          try {
              const targetParams = {
                  ...params,
                  node,
                  data: node.data,
                  colDef,
                  column: targetCol,
                  getValue: (field: string) => node.data?.[field],
              } as any;
              return colDef.valueGetter(targetParams);
          } catch {
              return node.data?.[colDef.field];
          }
      }
      return node.data?.[colDef.field];
  }
}
