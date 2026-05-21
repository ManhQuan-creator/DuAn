/**
 * Helpers thuần cho cấu trúc column groups (nested) — share giữa Builder + Render.
 * Cả 2 component định nghĩa local `ColumnGroupConfig` riêng nhưng cùng shape, nên util
 * dùng structural interface `ColumnGroupLike` để duck-type qua cả hai.
 */

export interface ColumnGroupLike {
  columnFields?: string[];
  children?: ColumnGroupLike[];
}

/**
 * Recursively xoá field stale (không còn trong validFields) khỏi `g.columnFields`
 * ở mọi cấp. Mutate in-place — caller không cần re-assign.
 */
export function cleanStaleColumnGroupFields<G extends ColumnGroupLike>(
  groups: G[],
  validFields: Set<string>,
): void {
  for (const g of groups) {
    g.columnFields = (g.columnFields ?? []).filter((f) => validFields.has(f));
    if (g.children && g.children.length > 0) {
      cleanStaleColumnGroupFields(g.children, validFields);
    }
  }
}

/**
 * Thu thập tất cả leaf fields ở mọi cấp của cây groups (cả lá trực tiếp lẫn nested).
 * Trả về Set để query O(1) — caller dùng để check field nào đã thuộc nhóm.
 */
export function collectAllLeafFields<G extends ColumnGroupLike>(groups: G[]): Set<string> {
  const result = new Set<string>();
  const walk = (gs: G[]) => {
    for (const g of gs) {
      (g.columnFields ?? []).forEach((f) => result.add(f));
      if (g.children && g.children.length > 0) walk(g.children as G[]);
    }
  };
  walk(groups);
  return result;
}

/**
 * Kiểm tra group (hoặc sub-group đệ quy) có chứa `field` không — cả leaf trực tiếp
 * lẫn nested.
 */
export function columnGroupContainsField<G extends ColumnGroupLike>(group: G, field: string): boolean {
  if ((group.columnFields ?? []).includes(field)) return true;
  return (group.children ?? []).some((c) => columnGroupContainsField(c as G, field));
}
