/**
 * Pure util — build text mô tả danh sách cột của 1 template để paste vào tài liệu
 * Phân tích yêu cầu (PRD). Trigger ẨN qua phím tắt `Ctrl+Alt+C` ở excel-render.
 * KHÔNG phụ thuộc Angular / DOM — testable trực tiếp.
 */

import {
  collectAllLeafFields,
  columnGroupContainsField,
} from '../../shared/grid-core';
import { stripHeaderPlaceholders } from '../../excel-builder/utils/dynamic-header.util';

/** Subset của `ColumnConfig` (excel-render) — đủ cho extract docs. */
export interface ColumnConfigShape {
  field: string;
  headerName: string;
  formula?: string;
  dataType?: 'number' | 'text' | 'date';
}

/** Subset của `ColumnGroupConfig` — duck-type qua excel-render + excel-builder. */
export interface ColumnGroupShape {
  groupId: string;
  headerName: string;
  columnFields?: string[];
  children?: ColumnGroupShape[];
  items?: Array<
    | { type: 'field'; field: string }
    | { type: 'group'; groupId: string }
  >;
}

/** Subset của row trong rowData — đủ để scan cell-level formula. */
export interface RowDataLike {
  row_code?: string;
  row_name?: string;
  _isTypeHeader?: boolean;
  _cellConfig?: {
    [field: string]: { formula?: string } | undefined;
  };
  [field: string]: any;
}

/** Metadata của 1 template TARGET (LOOKUP family) đã fetch — caller inject vào builder. */
export interface TargetTemplateInfo {
  /** Tên hiển thị của template target (resolveHeaderName đã apply). */
  name: string;
  /** field → headerName map (từ columnConfigs của template target, đã resolve placeholder). */
  fieldToHeader: Map<string, string>;
  /** rowCode → rowName map (từ rows của template target). */
  rowCodeToName: Map<string, string>;
}

export interface ColumnDocsInput {
  templateName: string;
  columnConfigs: ColumnConfigShape[];
  columnGroups: ColumnGroupShape[];
  rowData?: RowDataLike[];
  /** Map templateCode → metadata, fetched ngoài util (xem `extractReferencedTemplateCodes`). */
  targetTemplates?: Map<string, TargetTemplateInfo>;
}

/** Map kiểu dữ liệu sang nhãn tiếng Việt format "Cho phép nhập <kiểu>". */
export function dataTypeLabel(
  t: ColumnConfigShape['dataType'],
): string {
  switch (t) {
    case 'number':
      return 'Cho phép nhập số';
    case 'date':
      return 'Cho phép nhập ngày tháng';
    case 'text':
    default:
      return 'Cho phép nhập văn bản';
  }
}

// ---- Cross-entry functions metadata ----

interface CrossEntryFn {
  name: string;
  /** Index của string args cần dịch: 'template' | 'rowCode' | 'field' | null (skip). */
  argTypes: Array<'template' | 'rowCode' | 'field' | null>;
}

const CROSS_ENTRY_FNS: CrossEntryFn[] = [
  // LOOKUP(templateCode, rowCode, field, yearOffset[, monthOffset])
  { name: 'LOOKUP', argTypes: ['template', 'rowCode', 'field', null, null] },
  // LOOKUPENTRY(templateCode, field, yearOffset[, monthOffset]) — rowCode implicit
  { name: 'LOOKUPENTRY', argTypes: ['template', 'field', null, null] },
  // MYORG(templateCode, field, yearOffset[, monthOffset]) — rowCode = user.companyCode
  { name: 'MYORG', argTypes: ['template', 'field', null, null] },
  // GETDATA(templateCode, field, yearOffset[, monthOffset]) — rowCode = currentRow
  { name: 'GETDATA', argTypes: ['template', 'field', null, null] },
];

/** Tách args 1 function call theo `,` outer-level (respect cặp quote). */
function splitArgs(argsStr: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inQuote: '"' | "'" | null = null;
  let buf = '';
  for (let i = 0; i < argsStr.length; i++) {
    const c = argsStr[i];
    if (inQuote) {
      buf += c;
      if (c === '\\' && i + 1 < argsStr.length) {
        buf += argsStr[i + 1];
        i++;
        continue;
      }
      if (c === inQuote) inQuote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inQuote = c;
      buf += c;
      continue;
    }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) {
      out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += c;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** Lấy nội dung literal nếu arg là `"..."` hoặc `'...'`, ngược lại trả `null`. */
function unquoteLiteral(arg: string): string | null {
  if (arg.length < 2) return null;
  const q = arg[0];
  if ((q !== '"' && q !== "'") || arg[arg.length - 1] !== q) return null;
  return arg.slice(1, -1).replace(new RegExp(`\\\\${q}`, 'g'), q);
}

/**
 * Scan formula → tìm các call cross-entry → trả Set templateCode literal (arg đầu).
 * Trả `null` nếu arg không phải literal string (vd biến — không lookup được).
 */
export function extractTemplateCodesFromFormula(formula: string): string[] {
  const codes: string[] = [];
  for (const fn of CROSS_ENTRY_FNS) {
    const re = new RegExp(`\\b${fn.name}\\s*\\(([^)]*)\\)`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(formula)) !== null) {
      const args = splitArgs(m[1]);
      const tpl = args[0] ? unquoteLiteral(args[0]) : null;
      if (tpl) codes.push(tpl);
    }
  }
  return codes;
}

/**
 * Scan toàn bộ formula trong rowData (cell-level) + columnConfigs (column-level)
 * → trả Set templateCode TARGET cần fetch. Caller dùng để pre-fetch metadata
 * trước khi build text final.
 */
export function extractReferencedTemplateCodes(input: {
  columnConfigs: ColumnConfigShape[];
  rowData?: RowDataLike[];
}): Set<string> {
  const codes = new Set<string>();
  for (const col of input.columnConfigs) {
    if (col.formula) extractTemplateCodesFromFormula(col.formula).forEach((c) => codes.add(c));
  }
  for (const row of input.rowData ?? []) {
    const cfg = row?._cellConfig;
    if (!cfg) continue;
    for (const f of Object.keys(cfg)) {
      const ff = cfg[f]?.formula;
      if (ff) extractTemplateCodesFromFormula(ff).forEach((c) => codes.add(c));
    }
  }
  return codes;
}

/**
 * Translate formula cho document — 2 pass:
 *
 * 1. **Cross-entry calls** (LOOKUP/LOOKUPENTRY/MYORG/GETDATA): swap string-arg
 *    `"templateCode"`/`"rowCode"`/`"field"` thành tên đầy đủ
 *    `"Tên BM (templateCode)"` / `"Tên dòng (rowCode)"` / `"Tên cột (field)"` —
 *    dựa vào `targetTemplates` map. Nếu chưa có metadata cho code đó → giữ nguyên.
 *
 * 2. **Field references** ở context bare hoặc quoted (KHÔNG nằm trong cross-entry
 *    call đã xử lý ở pass 1): swap field → `"<headerName>"` của template HIỆN
 *    TẠI (xem `translateBareFields`).
 *
 * Kết quả giữ syntax Excel/macro intact, chỉ thay nội dung literal.
 */
export function translateFormulaForDocs(opts: {
  formula: string;
  currentFieldToHeader: Map<string, string>;
  targetTemplates?: Map<string, TargetTemplateInfo>;
}): string {
  const { formula, currentFieldToHeader, targetTemplates } = opts;
  if (!formula) return formula;
  // Pass 1: cross-entry calls.
  let out = translateCrossEntryArgs(formula, targetTemplates ?? new Map());
  // Pass 2: còn lại — field references bare/quoted.
  out = translateBareFields(out, currentFieldToHeader);
  return out;
}

function translateCrossEntryArgs(
  formula: string,
  targetTemplates: Map<string, TargetTemplateInfo>,
): string {
  let out = formula;
  for (const fn of CROSS_ENTRY_FNS) {
    const re = new RegExp(`\\b${fn.name}\\s*\\(([^)]*)\\)`, 'g');
    out = out.replace(re, (_full, argsStr: string) => {
      const args = splitArgs(argsStr);
      const tplLiteral = args[0] ? unquoteLiteral(args[0]) : null;
      const tplInfo = tplLiteral ? targetTemplates.get(tplLiteral) : undefined;
      const newArgs = args.map((arg, idx) => {
        const typ = fn.argTypes[idx];
        if (!typ) return arg; // year/month/extra — giữ
        const literal = unquoteLiteral(arg);
        if (literal === null) return arg; // không phải string literal — bỏ qua
        if (typ === 'template') {
          return tplInfo ? quoteFriendly(`${tplInfo.name} (${literal})`) : arg;
        }
        if (typ === 'rowCode') {
          const rowName = tplInfo?.rowCodeToName.get(literal);
          return rowName ? quoteFriendly(`Dòng "${rowName}" (${literal})`) : arg;
        }
        // 'field'
        const header = tplInfo?.fieldToHeader.get(literal);
        return header ? quoteFriendly(`Cột "${header}" (${literal})`) : arg;
      });
      return `${fn.name}(${newArgs.join(', ')})`;
    });
  }
  return out;
}

function quoteFriendly(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`;
}

/**
 * String-aware substitute field → headerName cho phần còn lại của formula (sau
 * khi đã xử lý cross-entry args). Quoted literal `"field"` → giữ outer quote,
 * swap content. Bare token `field` → wrap trong double-quote `"<header>"`. Token
 * nằm trong string literal khác → KHÔNG thay (tránh phá nội dung).
 */
export function translateBareFields(
  formula: string,
  fieldToHeader: Map<string, string>,
): string {
  if (!formula || fieldToHeader.size === 0) return formula;
  const fields = [...fieldToHeader.keys()].sort((a, b) => b.length - a.length);
  const fieldHead = new RegExp(`^(${fields.join('|')})(?![A-Za-z0-9_])`);
  const isWord = (c: string): boolean => /[A-Za-z0-9_]/.test(c);

  let out = '';
  let i = 0;
  let inQuote: '"' | "'" | null = null;

  while (i < formula.length) {
    const ch = formula[i];

    if (inQuote) {
      out += ch;
      if (ch === inQuote) inQuote = null;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const close = formula.indexOf(ch, i + 1);
      if (close > i + 1) {
        const inner = formula.slice(i + 1, close);
        if (fieldToHeader.has(inner)) {
          const header = fieldToHeader.get(inner)!;
          const escaped = header.replace(new RegExp(ch, 'g'), `\\${ch}`);
          out += `${ch}${escaped}${ch}`;
          i = close + 1;
          continue;
        }
      }
      inQuote = ch;
      out += ch;
      i++;
      continue;
    }

    const prev = i === 0 ? '' : formula[i - 1];
    if (isWord(ch) && (!prev || !isWord(prev))) {
      const m = formula.slice(i).match(fieldHead);
      if (m) {
        const f = m[1];
        const header = fieldToHeader.get(f) ?? f;
        out += `"${header.replace(/"/g, '\\"')}"`;
        i += f.length;
        continue;
      }
    }

    out += ch;
    i++;
  }
  return out;
}

/** 1 leaf column đã được walk — kèm path ancestor headerNames để render `Cha/Con/Cháu`. */
export interface LeafColumnEntry {
  field: string;
  /** Mảng headerName từ root group → leaf headerName. Leaf flat (không group): 1 phần tử. */
  pathHeaders: string[];
}

/**
 * Walk leaf columns theo thứ tự visual: loop `columnConfigs` theo thứ tự gốc →
 * field thuộc group emit root group 1 lần (DFS qua `items[]`), field flat emit
 * trực tiếp. Pure — không mutate input.
 */
export function walkLeafColumnsInVisualOrder(
  columnConfigs: ColumnConfigShape[],
  columnGroups: ColumnGroupShape[],
): LeafColumnEntry[] {
  const result: LeafColumnEntry[] = [];
  const configByField = new Map<string, ColumnConfigShape>();
  columnConfigs.forEach((c) => configByField.set(c.field, c));
  const groupedFields = collectAllLeafFields(columnGroups);
  const emittedRootGroups = new Set<string>();

  const walkGroup = (group: ColumnGroupShape, ancestorHeaders: string[]): void => {
    const newPath = [...ancestorHeaders, group.headerName];
    const childMap = new Map<string, ColumnGroupShape>();
    (group.children ?? []).forEach((c) => childMap.set(c.groupId, c));
    const items = deriveItemsOrder(group);
    for (const it of items) {
      if (it.type === 'field') {
        const cfg = configByField.get(it.field);
        if (cfg) {
          result.push({ field: it.field, pathHeaders: [...newPath, cfg.headerName] });
        }
      } else {
        const sub = childMap.get(it.groupId);
        if (sub) walkGroup(sub, newPath);
      }
    }
  };

  for (const config of columnConfigs) {
    if (groupedFields.has(config.field)) {
      const rootGroup = columnGroups.find((g) => columnGroupContainsField(g, config.field));
      if (rootGroup && !emittedRootGroups.has(rootGroup.groupId)) {
        emittedRootGroups.add(rootGroup.groupId);
        walkGroup(rootGroup, []);
      }
    } else {
      result.push({ field: config.field, pathHeaders: [config.headerName] });
    }
  }
  return result;
}

function deriveItemsOrder(
  group: ColumnGroupShape,
): NonNullable<ColumnGroupShape['items']> {
  if (group.items && group.items.length > 0) return group.items;
  const out: NonNullable<ColumnGroupShape['items']> = [];
  (group.columnFields ?? []).forEach((f) => out.push({ type: 'field', field: f }));
  (group.children ?? []).forEach((c) => out.push({ type: 'group', groupId: c.groupId }));
  return out;
}

/** Build map field → headerName (strip braces khỏi placeholder) từ columnConfigs. */
function buildFieldToHeader(
  columnConfigs: ColumnConfigShape[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of columnConfigs) {
    if (c.headerName) map.set(c.field, stripHeaderPlaceholders(c.headerName));
  }
  return map;
}

/** 1 nhóm cell có cùng formula trong cùng cột. */
interface CellFormulaGroup {
  formula: string;
  rowCodes: string[];
}

/**
 * Scan rowData → trả mảng cell-level formula nhóm theo formula text cho 1 field.
 * Bỏ qua row có `_isTypeHeader` (section boundary, không có cell value). Giữ thứ
 * tự xuất hiện đầu tiên của formula.
 */
function collectCellFormulas(
  rowData: RowDataLike[],
  field: string,
): CellFormulaGroup[] {
  const byFormula = new Map<string, CellFormulaGroup>();
  for (const row of rowData) {
    if (!row || row._isTypeHeader) continue;
    const f = row._cellConfig?.[field]?.formula;
    if (!f || !row.row_code) continue;
    const g = byFormula.get(f);
    if (g) g.rowCodes.push(row.row_code);
    else byFormula.set(f, { formula: f, rowCodes: [row.row_code] });
  }
  return [...byFormula.values()];
}

/**
 * Body — chỉ phần numbered list, KHÔNG có dòng header "Hệ thống hiển thị ...".
 * Tách riêng để feature khác (vd `generateImportExportDoc`) reuse mà không phải
 * post-process strip dòng đầu.
 *
 * Format mỗi dòng:
 * ```
 * 1. {headerPath} - Cho phép nhập {kiểu}
 *    - Công thức (mặc định cả cột): {translatedFormula}
 *    - Công thức tại ô (R001, R002): {translatedFormula}
 * 2. ...
 * ```
 *
 * Placeholder `${N}`, `${M}`, `${N-3}`, ... trong headerName được resolve qua
 * `resolveHeaderName(year, month)`. Empty `columnConfigs` → trả empty string.
 */
export function buildColumnDocsBody(
  input: Omit<ColumnDocsInput, 'templateName'>,
): string {
  const {
    columnConfigs,
    columnGroups,
    rowData = [],
    targetTemplates,
  } = input;
  if (!columnConfigs || columnConfigs.length === 0) return '';

  const fieldToHeader = buildFieldToHeader(columnConfigs);
  const leaves = walkLeafColumnsInVisualOrder(columnConfigs, columnGroups);
  const configByField = new Map<string, ColumnConfigShape>();
  columnConfigs.forEach((c) => configByField.set(c.field, c));

  const lines: string[] = [];
  leaves.forEach((leaf, idx) => {
    const cfg = configByField.get(leaf.field);
    if (!cfg) return;
    const path = leaf.pathHeaders
      .map((h) => stripHeaderPlaceholders(h))
      .join('/');
    const typeLbl = dataTypeLabel(cfg.dataType);
    lines.push(`${idx + 1}. ${path} - ${typeLbl}`);

    if (cfg.formula) {
      const translated = translateFormulaForDocs({
        formula: cfg.formula,
        currentFieldToHeader: fieldToHeader,
        targetTemplates,
      });
      lines.push(`    - Công thức (mặc định cả cột): ${translated}`);
    }

    const cellGroups = collectCellFormulas(rowData, leaf.field);
    for (const g of cellGroups) {
      const translated = translateFormulaForDocs({
        formula: g.formula,
        currentFieldToHeader: fieldToHeader,
        targetTemplates,
      });
      const rows = g.rowCodes.join(', ');
      lines.push(`    - Công thức tại ô (${rows}): ${translated}`);
    }
  });
  return lines.join('\n');
}

/**
 * Builder chính — sinh text copy clipboard. Header line + body.
 *
 * ```
 * Hệ thống hiển thị chi tiết biểu mẫu "{templateName}" bao gồm các trường sau:
 * <body từ buildColumnDocsBody>
 * ```
 *
 * Empty `columnConfigs` → chỉ trả dòng header.
 */
export function buildColumnDocsText(input: ColumnDocsInput): string {
  const strippedTplName = stripHeaderPlaceholders(input.templateName);
  const header = `Hệ thống hiển thị chi tiết biểu mẫu "${strippedTplName || 'Không tên'}" bao gồm các trường sau:`;
  const body = buildColumnDocsBody(input);
  return body ? `${header}\n${body}` : header;
}
