import {
  extractDependencies,
  ExtractContext,
} from '../../excel-builder/service/formula-graph/dependency-extractor';

/** Subset của ColumnConfig — đủ cho scan formula. */
interface ColumnConfigShape {
  field: string;
  formula?: string;
}

export interface IncomingFormulaRef {
  /** rowCode chứa formula. */
  rowCode: string;
  /** field chứa formula. */
  field: string;
  /** Formula source — hiển thị cho user trong confirm dialog khi xóa. */
  formula: string;
}

/**
 * Quét toàn bộ formulas trong rowData → trả danh sách `(rowCode, field, formula)`
 * có reference (qua `cellDeps`) đến `targetRowCode`.
 *
 * Scan 2 nguồn:
 *  - Cell-level override: `row._cellConfig[field].formula`.
 *  - Column-level: `columnConfig.formula` (chỉ khi cell KHÔNG có override).
 *
 * Reuse `extractDependencies` thay vì viết parser mới — đã handle 4-tier resolve
 * (ROW_COL/COL/ROW/EXCEL) + aggregate range expand (SUM/SUMIF/COUNTIF/AVG/...).
 *
 * Dùng để warn user trước khi xóa row: nếu kết quả non-empty, các formula đó sẽ
 * trả `#NOROW!` hoặc tổng bị thiếu sau xóa.
 */
export function findIncomingFormulaRefs(
  targetRowCode: string,
  rowData: any[],
  columnConfigs: ColumnConfigShape[],
  colMap: Record<string, string>,
): IncomingFormulaRef[] {
  if (!targetRowCode) return [];

  const allFields = columnConfigs.map((c) => c.field);
  const rowOrder = rowData.map((r) => r?.row_code).filter((c) => !!c) as string[];
  const hits: IncomingFormulaRef[] = [];
  const seen = new Set<string>();

  const tryPush = (
    formula: string,
    ownerRowCode: string,
    ownerField: string,
  ): void => {
    if (!formula) return;
    const ctx: ExtractContext = {
      currentRowCode: ownerRowCode,
      currentField: ownerField,
      rowOrder,
      allFields,
      colMap,
    };
    const { cellDeps } = extractDependencies(formula, ctx);
    if (cellDeps.some((d) => d.rowCode === targetRowCode)) {
      const key = `${ownerRowCode}|${ownerField}`;
      if (!seen.has(key)) {
        seen.add(key);
        hits.push({ rowCode: ownerRowCode, field: ownerField, formula });
      }
    }
  };

  for (const row of rowData) {
    const ownerCode = row?.row_code;
    if (!ownerCode) continue;

    const cellCfg = row._cellConfig;
    for (const col of columnConfigs) {
      const cellFormula = cellCfg?.[col.field]?.formula;
      const hasOverride = !!(
        cellCfg?.[col.field]?.formula ||
        cellCfg?.[col.field]?.dropdown ||
        cellCfg?.[col.field]?.datePicker
      );
      if (cellFormula) {
        tryPush(cellFormula, ownerCode, col.field);
      } else if (col.formula && !hasOverride) {
        tryPush(col.formula, ownerCode, col.field);
      }
    }
  }
  return hits;
}
