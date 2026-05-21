/**
 * Reserved keywords cho formula engine — tên hàm built-in và logic.
 * Dùng canonical form UPPERCASE; so khớp case-insensitive qua `isReservedKeyword()`.
 * Share giữa FormulaService và column-config-dialog để validation đồng bộ.
 */
export const RESERVED_KEYWORDS = [
  'IF', 'AND', 'OR', 'TRUE', 'FALSE',
  'MAX', 'MIN', 'ROUND', 'ABS', 'CEILING', 'FLOOR', 'PI', 'POW', 'SQRT',
  'SUM', 'SUMCOL', 'SUMALL', 'SUMIF', 'COUNTIF',
  'AVG', 'AVGROW', 'AVGCOL', 'VLOOKUP', 'GETDATA', 'LOOKUP', 'MYORG', 'LOOKUPENTRY',
] as const;

const RESERVED_SET = new Set<string>(RESERVED_KEYWORDS);

/** Normalize key cho CI lookup. null/undefined → ''. */
export function ciKey(s: string | null | undefined): string {
  return (s ?? '').toLowerCase();
}

/** Kiểm tra tên có phải reserved keyword không (case-insensitive). */
export function isReservedKeyword(name: string | null | undefined): boolean {
  if (!name) return false;
  return RESERVED_SET.has(name.toUpperCase());
}
