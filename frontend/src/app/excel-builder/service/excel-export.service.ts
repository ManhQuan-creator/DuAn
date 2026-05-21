import { Injectable } from '@angular/core';
import { ColumnConfig, ColumnGroupConfig } from '../excel-builder.component';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { resolveHeaderName } from '../utils/dynamic-header.util';

/**
 * Cột virtual `row_code` ("Mã dòng") — KHÔNG nằm trong template.columnConfigs (builder
 * render qua `buildRowCodeColDef()` runtime), nhưng PHẢI có trong file Excel để
 * import biết match dòng. Inject vào export + import như nguồn duy nhất.
 */
const ROW_CODE_VIRTUAL_CONFIG: ColumnConfig = {
  field: 'row_code',
  headerName: 'Mã dòng',
  dataType: 'text',
};

/**
 * Layout file Excel (export + import — phải đồng bộ):
 *   Row 1:                Tên báo cáo (merge col 1 → col N), bold size 14, center.
 *   Row 2:                Trống (separator visual).
 *   Row 3..3+maxDepth:    Header (single hoặc multi-level).
 *   Row 3+totalHeaderRows+: Data.
 *
 * Import detect title row qua merge full-width ở row 1 → backward compat với
 * file cũ (no title) bằng cách trả offset=0.
 */
const TITLE_ROW_OFFSET = 2;

/**
 * Sanitize tên file cho cross-platform: bỏ ký tự cấm Windows (`/ \ : * ? " < > |`),
 * collapse whitespace, trim. Empty → fallback "Bao cao".
 *
 * KHÔNG strip Unicode tiếng Việt (Windows + macOS đều support UTF-8 NTFS/HFS+).
 */
export function sanitizeFilename(raw: string): string {
  const cleaned = (raw ?? '').replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  return cleaned || 'Bao cao';
}

/** Convert Excel column letters (A, B, ..., AA) → 1-based column index. */
function colLetterToIdx(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n;
}

/**
 * Build Excel numFmt string từ `_cellConfig[field].format`. Excel native:
 *   - `0.0000%` → ×100 + suffix `%`, 4 chữ số thập phân
 *   - `#,##0.00` → thousands separator, 2 chữ số thập phân
 *   - `#,##0` → integer thousands separator (default cho number)
 */
function buildNumFmt(fmt?: { decimals?: number; percent?: boolean } | null): string {
  const decimals = fmt?.decimals ?? 0;
  const decimalPart = decimals > 0 ? '.' + '0'.repeat(decimals) : '';
  return fmt?.percent ? `0${decimalPart}%` : `#,##0${decimalPart}`;
}

/** Một ô header đã được tính toán vị trí */
interface HeaderCell {
  value: string;
  row: number;    // 1-based
  col: number;    // 1-based start
  colEnd: number; // 1-based end (inclusive)
  rowEnd: number; // 1-based end (inclusive)
}

@Injectable({ providedIn: 'root' })
export class ExcelExportService {

  async exportGrid(
    columnConfigs: ColumnConfig[],
    columnGroups: ColumnGroupConfig[],
    rowData: any[],
    fileName: string,
    year?: number | null,
    month?: number | null,
    displayTitle?: string,
  ): Promise<void> {
    const resolveYear = year ?? new Date().getFullYear();
    const resolveMonth = month ?? new Date().getMonth() + 1;
    const h = (raw: string): string => resolveHeaderName(raw, resolveYear, resolveMonth);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');

    // Catalog columns đã bị loại bỏ — toàn bộ là cột thường, giữ thứ tự gốc.
    // Prepend cột virtual "Mã dòng" nếu template chưa có (case mặc định) — để
    // file Excel xuất ra mang theo row_code, đảm bảo import lại match được dòng.
    const allCols = columnConfigs.some(c => c.field === 'row_code')
      ? [...columnConfigs]
      : [ROW_CODE_VIRTUAL_CONFIG, ...columnConfigs];

    // Title row 1 + empty row 2 — đặt trước header. Layout đồng bộ với import detect.
    this.writeTitleRow(ws, displayTitle ?? fileName, allCols.length);

    // Tính chiều sâu tối đa của cây nhóm
    const maxDepth = this.calcDepth(columnGroups);
    const totalHeaderRows = maxDepth > 0 ? maxDepth + 1 : 1;

    if (maxDepth > 0) {
      // ── Multi-level header ──────────────────────────────────────
      const headerCells: HeaderCell[] = [];
      const flatCols: ColumnConfig[] = [];
      let colCursor = 1;

      // Header rows được shift xuống bằng TITLE_ROW_OFFSET vì 2 dòng đầu là title + empty.
      const headerStartRow = 1 + TITLE_ROW_OFFSET;
      const headerEndRow = totalHeaderRows + TITLE_ROW_OFFSET;

      // fieldToRootGroup: tìm root group chứa field
      const processColumn = (col: ColumnConfig): void => {
        // standalone column: merge toàn bộ totalHeaderRows
        headerCells.push({
          value: h(col.headerName),
          row: headerStartRow, col: colCursor,
          colEnd: colCursor, rowEnd: headerEndRow
        });
        flatCols.push(col);
        colCursor++;
      };

      const processGroup = (group: ColumnGroupConfig, depth: number): void => {
        const groupStartCol = colCursor;

        if (group.children && group.children.length > 0) {
          for (const child of group.children) {
            processGroup(child, depth + 1);
          }
        } else {
          // Nhóm lá: xử lý từng cột
          const groupCols = group.columnFields
            .map(f => allCols.find(c => c.field === f))
            .filter(Boolean) as ColumnConfig[];
          for (const gc of groupCols) {
            // Tên cột ở dòng cuối header
            headerCells.push({
              value: h(gc.headerName),
              row: headerEndRow, col: colCursor,
              colEnd: colCursor, rowEnd: headerEndRow
            });
            flatCols.push(gc);
            colCursor++;
          }
        }

        const groupEndCol = colCursor - 1;
        if (groupStartCol <= groupEndCol) {
          // Header của nhóm: từ dòng (headerStartRow + depth) đến dòng cuối nhóm
          const groupRow = headerStartRow + depth;
          headerCells.push({
            value: h(group.headerName),
            row: groupRow, col: groupStartCol,
            colEnd: groupEndCol, rowEnd: groupRow
          });
        }
      };

      // Duyệt allCols để giữ thứ tự
      const emittedRoots = new Set<string>();
      for (const col of allCols) {
        const rootGroup = columnGroups.find(g => this.groupContainsField(g, col.field));
        if (rootGroup) {
          if (!emittedRoots.has(rootGroup.groupId)) {
            emittedRoots.add(rootGroup.groupId);
            processGroup(rootGroup, 0);
          }
        } else {
          processColumn(col);
        }
      }

      // Ghi header cells
      for (const hc of headerCells) {
        const cell = ws.getCell(hc.row, hc.col);
        cell.value = hc.value;
        // Merge nếu cần
        if (hc.row !== hc.rowEnd || hc.col !== hc.colEnd) {
          ws.mergeCells(hc.row, hc.col, hc.rowEnd, hc.colEnd);
        }
        this.styleHeaderCell(cell);
      }

      // Ghi data rows — shift xuống TITLE_ROW_OFFSET vì có title + empty row
      this.writeDataRows(ws, flatCols, rowData, totalHeaderRows + 1 + TITLE_ROW_OFFSET);
      this.autoFitColumns(ws, flatCols, resolveYear, resolveMonth);
    } else {
      // ── Single-level header ─────────────────────────────────────
      const headerRow = 1 + TITLE_ROW_OFFSET;
      const orderedCols = allCols.map(c => h(c.headerName));
      ws.getRow(headerRow).values = orderedCols;
      ws.getRow(headerRow).eachCell(cell => this.styleHeaderCell(cell));
      this.writeDataRows(ws, allCols, rowData, headerRow + 1);
      this.autoFitColumns(ws, allCols, resolveYear, resolveMonth);
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${fileName}.xlsx`);
  }

  private styleHeaderCell(cell: ExcelJS.Cell): void {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' }
    };
  }

  /**
   * Ghi title row 1 (merge full width). Row 2 trống tự nhiên (không cần ghi).
   * `totalCols < 1` → skip (worksheet rỗng).
   */
  private writeTitleRow(ws: ExcelJS.Worksheet, title: string, totalCols: number): void {
    if (totalCols < 1) return;
    const cell = ws.getCell(1, 1);
    cell.value = title;
    cell.font = { bold: true, size: 14 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (totalCols > 1) {
      ws.mergeCells(1, 1, 1, totalCols);
    }
    ws.getRow(1).height = 24;
  }

  /**
   * Detect title row 1 (merge full-width) → trả `TITLE_ROW_OFFSET`. File cũ
   * không có title → trả 0 (legacy mode, header start ngay từ row 1).
   *
   * Match rule: merge có `r1=r2=1` + `c1=1` + `c2=colCount` (span toàn bộ cột).
   * Single-column file (`colCount<2`) coi như legacy — title row vô nghĩa.
   */
  private detectTitleRowOffset(ws: ExcelJS.Worksheet): number {
    const colCount = ws.columnCount;
    if (colCount < 2) return 0;
    const merges = (ws as any).model?.merges ?? [];
    for (const m of merges) {
      if (typeof m !== 'string') continue;
      const match = m.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (!match) continue;
      const c1 = colLetterToIdx(match[1]);
      const r1 = parseInt(match[2], 10);
      const c2 = colLetterToIdx(match[3]);
      const r2 = parseInt(match[4], 10);
      if (r1 === 1 && r2 === 1 && c1 === 1 && c2 === colCount) {
        return TITLE_ROW_OFFSET;
      }
    }
    return 0;
  }

  private writeDataRows(ws: ExcelJS.Worksheet, flatCols: ColumnConfig[], rowData: any[], startRow: number): void {
    rowData.forEach((row, idx) => {
      const wsRow = ws.getRow(startRow + idx);
      flatCols.forEach((col, cIdx) => {
        const cell = wsRow.getCell(cIdx + 1);
        const val = row[col.field];
        const cellDatePicker = row._cellConfig?.[col.field]?.datePicker;
        if (cellDatePicker && val && String(val).match(/^\d{4}-\d{2}-\d{2}/)) {
          cell.value = new Date(String(val));
          cell.numFmt = 'DD/MM/YYYY';
        } else if (col.dataType === 'date') {
          if (val && String(val).match(/^\d{4}-\d{2}-\d{2}/)) {
            cell.value = new Date(String(val));
            cell.numFmt = 'DD/MM/YYYY';
          } else {
            cell.value = val != null ? String(val) : '';
          }
        } else if (col.dataType === 'text') {
          // Best-effort: text column với value parse được số + có format số → write
          // as number + numFmt (đồng bộ display web). Ngược lại giữ string nguyên.
          const textFmt = row._cellConfig?.[col.field]?.format;
          const textNum = val != null && val !== '' ? Number(val) : NaN;
          if (textFmt && (textFmt.decimals != null || textFmt.percent) && Number.isFinite(textNum)) {
            cell.value = textNum;
            cell.numFmt = buildNumFmt(textFmt);
          } else {
            cell.value = val != null ? String(val) : '';
          }
        } else {
          cell.value = val != null && val !== '' ? Number(val) : null;
          // numFmt theo per-cell format: percent (Excel ×100 + suffix) + decimals.
          // Cell.value lưu RAW (vd 0.010101) — Excel native '0.0000%' tự ×100 khi
          // hiển thị → khớp với behavior web ở formatCellValue (cũng ×100).
          cell.numFmt = buildNumFmt(row._cellConfig?.[col.field]?.format);
        }
      });
      if (row._isTypeHeader) {
        wsRow.eachCell(cell => {
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        });
      }
    });
  }

  private autoFitColumns(ws: ExcelJS.Worksheet, flatCols: ColumnConfig[], year: number, month?: number | null): void {
    const resolveMonth = month ?? new Date().getMonth() + 1;
    flatCols.forEach((col, idx) => {
      const header = resolveHeaderName(col.headerName, year, resolveMonth);
      ws.getColumn(idx + 1).width = Math.max(header.length + 4, 12);
    });
  }

  /** Tính chiều sâu tối đa của cây nhóm (0 = không có nhóm) */
  private calcDepth(groups: ColumnGroupConfig[]): number {
    if (!groups || groups.length === 0) return 0;
    let max = 0;
    for (const g of groups) {
      if (g.children && g.children.length > 0) {
        max = Math.max(max, 1 + this.calcDepth(g.children));
      } else {
        max = Math.max(max, 1);
      }
    }
    return max;
  }

  private groupContainsField(group: ColumnGroupConfig, field: string): boolean {
    if (group.children && group.children.length > 0) {
      return group.children.some(c => this.groupContainsField(c, field));
    }
    return group.columnFields.includes(field);
  }

  async importGrid(
    file: File,
    columnConfigs: ColumnConfig[],
    columnGroups: ColumnGroupConfig[],
    year?: number | null,
    month?: number | null,
  ): Promise<{ matchedRows: any[]; unmatchedCols: string[]; rowCodeUnresolved: boolean }> {
    const resolveYear = year ?? new Date().getFullYear();
    const resolveMonth = month ?? new Date().getMonth() + 1;
    const buffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const ws = wb.getWorksheet(1);
    if (!ws) throw new Error('Không tìm thấy sheet');

    // File mới: title row 1 (merge full-width) + empty row 2 → header start row 3.
    // File cũ (no title): legacy mode, header start row 1.
    const titleOffset = this.detectTitleRowOffset(ws);
    const { colPathMap, totalHeaderRows } = this.buildHeaderPathMap(ws, 1 + titleOffset);
    const configPaths = this.buildConfigPaths(columnConfigs, columnGroups, resolveYear, resolveMonth);
    // Inject virtual row_code config (Mã dòng) — cùng nguồn với exportGrid. Đảm bảo
    // import match được khi file Excel có header "Mã dòng" mà columnConfigs không
    // chứa entry tương ứng (cột row_code build runtime ở builder).
    if (!columnConfigs.some(c => c.field === 'row_code')) {
      configPaths.push({ config: ROW_CODE_VIRTUAL_CONFIG, path: [ROW_CODE_VIRTUAL_CONFIG.headerName] });
    }

    const norm = (s: string) => s.trim().toLowerCase();
    const keyOf = (path: string[]) => path.map(norm).join('||');

    const usedConfigs = new Set<string>();
    const colIndexToField = new Map<number, { field: string; dataType?: string }>();
    const unmatchedCols: string[] = [];
    const queueLeafPass: number[] = [];

    // Pass 1: full path equality
    const configByPath = new Map<string, Array<{ config: ColumnConfig; path: string[] }>>();
    for (const cp of configPaths) {
      const k = keyOf(cp.path);
      const arr = configByPath.get(k) ?? [];
      arr.push(cp);
      configByPath.set(k, arr);
    }
    colPathMap.forEach((excelPath, colIdx) => {
      const candidates = configByPath.get(keyOf(excelPath)) ?? [];
      const unused = candidates.filter(c => !usedConfigs.has(c.config.field));
      if (unused.length === 0) {
        queueLeafPass.push(colIdx);
        return;
      }
      if (unused.length > 1) {
        console.warn(`[importGrid] Trùng config cho path "${excelPath.join(' > ')}" — chọn cái đầu`);
      }
      const picked = unused[0].config;
      colIndexToField.set(colIdx, { field: picked.field, dataType: picked.dataType });
      usedConfigs.add(picked.field);
    });

    // Pass 2: leaf-only fallback (file Excel cũ không có nhóm cha)
    for (const colIdx of queueLeafPass) {
      const excelPath = colPathMap.get(colIdx)!;
      const leaf = excelPath[excelPath.length - 1];
      const match = configPaths.find(
        c => norm(c.path[c.path.length - 1]) === norm(leaf) && !usedConfigs.has(c.config.field),
      );
      if (match) {
        colIndexToField.set(colIdx, { field: match.config.field, dataType: match.config.dataType });
        usedConfigs.add(match.config.field);
      } else {
        unmatchedCols.push(leaf || `Col${colIdx}`);
      }
    }

    // Debug: log resolved config paths khi có unmatched — giúp user trace
    // mismatch giữa header file Excel (đã resolved theo context lúc export) và
    // config (resolve theo year/month đang chọn).
    if (unmatchedCols.length > 0) {
      console.warn(
        '[importGrid] Cột không match. Config paths đã resolve:',
        configPaths.map(c => c.path.join(' > ')),
        '\nHeader Excel:',
        Array.from(colPathMap.values()).map(p => p.join(' > ')),
      );
    }

    // row_code resolution: tìm cột Excel match field 'row_code'
    let rowCodeColIdx: number | null = null;
    for (const [colIdx, info] of colIndexToField.entries()) {
      if (info.field === 'row_code') {
        rowCodeColIdx = colIdx;
        break;
      }
    }

    const dataStartRow = totalHeaderRows + 1;
    const matchedRows: any[] = [];
    for (let r = dataStartRow; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      if (!row.hasValues) continue;
      const rowObj: any = {};
      if (rowCodeColIdx != null) {
        const code = String(row.getCell(rowCodeColIdx).value ?? '').trim();
        if (code) rowObj.row_code = code;
      }
      colIndexToField.forEach(({ field, dataType }, colIdx) => {
        if (colIdx === rowCodeColIdx) return;
        const cell = row.getCell(colIdx);
        const val = cell.value;
        if (dataType === 'date') {
          rowObj[field] = val instanceof Date ? val.toISOString().slice(0, 10) : (val != null ? String(val) : '');
        } else if (dataType === 'text') {
          rowObj[field] = val != null ? String(val) : '';
        } else {
          rowObj[field] = val != null ? Number(val) || 0 : 0;
        }
      });
      matchedRows.push(rowObj);
    }

    return { matchedRows, unmatchedCols, rowCodeUnresolved: rowCodeColIdx == null };
  }

  /**
   * Parse merges + walk các dòng header để build path đầy đủ (cha → con → cháu...)
   * cho mỗi cột Excel. Hỗ trợ n cấp.
   *
   * @param startRow Dòng bắt đầu của header (1 = legacy file, 3 = file có title row).
   *   Merges với `r1 < startRow` được skip khỏi tính `totalHeaderRows` — title row
   *   không bị nhầm là 1 cấp header.
   */
  private buildHeaderPathMap(ws: ExcelJS.Worksheet, startRow: number = 1): {
    colPathMap: Map<number, string[]>;
    totalHeaderRows: number;
  } {
    const merges = (ws as any).model?.merges ?? [];
    const mergeAnchor = new Map<string, { r: number; c: number }>();
    let totalHeaderRows = startRow;

    for (const m of merges) {
      if (typeof m !== 'string') continue;
      const match = m.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (!match) continue;
      const c1 = colLetterToIdx(match[1]);
      const r1 = parseInt(match[2], 10);
      const c2 = colLetterToIdx(match[3]);
      const r2 = parseInt(match[4], 10);
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          mergeAnchor.set(`${r},${c}`, { r: r1, c: c1 });
        }
      }
      // Title row (r1 < startRow) không tính vào header depth.
      if (r1 >= startRow && r2 > totalHeaderRows) totalHeaderRows = r2;
    }

    const getMergedValue = (r: number, c: number): string => {
      const anchor = mergeAnchor.get(`${r},${c}`) ?? { r, c };
      const v = ws.getRow(anchor.r).getCell(anchor.c).value;
      if (v == null) return '';
      // ExcelJS có thể trả object {richText: [...]} cho rich text — flatten
      if (typeof v === 'object' && (v as any).richText) {
        return (v as any).richText.map((t: any) => t.text).join('').trim();
      }
      return String(v).trim();
    };

    const colPathMap = new Map<number, string[]>();
    const colCount = ws.columnCount;
    for (let c = 1; c <= colCount; c++) {
      const path: string[] = [];
      for (let r = startRow; r <= totalHeaderRows; r++) {
        const v = getMergedValue(r, c);
        if (v && (path.length === 0 || path[path.length - 1] !== v)) {
          path.push(v);
        }
      }
      if (path.length > 0) colPathMap.set(c, path);
    }
    return { colPathMap, totalHeaderRows };
  }

  /**
   * Build path đầy đủ cho mỗi ColumnConfig — recursive walk columnGroups (n cấp),
   * resolve dynamic placeholder ${N}/${M} ở mọi cấp.
   */
  private buildConfigPaths(
    columnConfigs: ColumnConfig[],
    columnGroups: ColumnGroupConfig[],
    year: number,
    month: number,
  ): Array<{ config: ColumnConfig; path: string[] }> {
    const h = (raw: string) => resolveHeaderName(raw, year, month);
    const result: Array<{ config: ColumnConfig; path: string[] }> = [];

    const walkGroup = (group: ColumnGroupConfig, ancestors: string[]): void => {
      const newAncestors = [...ancestors, h(group.headerName)];
      if (group.children && group.children.length > 0) {
        for (const child of group.children) walkGroup(child, newAncestors);
      }
      for (const field of group.columnFields ?? []) {
        const cfg = columnConfigs.find(c => c.field === field);
        if (cfg && !cfg.formula) {
          result.push({ config: cfg, path: [...newAncestors, h(cfg.headerName)] });
        }
      }
    };
    for (const g of columnGroups) walkGroup(g, []);

    // Standalone columns (không thuộc nhóm nào)
    for (const cfg of columnConfigs) {
      if (cfg.formula) continue;
      const inGroup = columnGroups.some(g => this.groupContainsField(g, cfg.field));
      if (!inGroup) {
        result.push({ config: cfg, path: [h(cfg.headerName)] });
      }
    }
    return result;
  }
}
