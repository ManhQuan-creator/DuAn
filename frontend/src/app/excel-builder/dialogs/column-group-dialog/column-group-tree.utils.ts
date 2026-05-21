/**
 * Pure tree manipulation utilities cho ColumnGroupConfig.
 * KHÔNG có Angular dependency — dễ unit test, dễ reason.
 *
 * Quy ước:
 *  - `path: string[]` — mảng groupId từ root → node. `[]` = root level (không có group cụ thể).
 *  - Mọi function ở đây hoặc PURE (read-only) hoặc MUTATE đối số nhận vào (đã document rõ).
 */

import { ColumnGroupConfig, ColumnGroupItem } from '../../excel-builder.component';

// ═══════════════════════════════════════════════════════════
// Path helpers
// ═══════════════════════════════════════════════════════════

export function pathKey(path: readonly string[] | null | undefined): string {
  return path ? path.join('/') : '';
}

export function pathsEqual(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined,
): boolean {
  if (!a || !b) return a === b;
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

/** True nếu `child` nằm trong subtree của `ancestor` (cùng path hoặc dài hơn, prefix-match). */
export function pathStartsWith(
  child: readonly string[] | null | undefined,
  ancestor: readonly string[],
): boolean {
  if (!child) return false;
  if (child.length < ancestor.length) return false;
  return ancestor.every((s, i) => s === child[i]);
}

// ═══════════════════════════════════════════════════════════
// Lookup
// ═══════════════════════════════════════════════════════════

export function findGroupByPath(
  groups: ColumnGroupConfig[],
  path: readonly string[],
): ColumnGroupConfig | null {
  if (path.length === 0) return null;
  let current: ColumnGroupConfig | undefined;
  let arr: ColumnGroupConfig[] = groups;
  for (const id of path) {
    current = arr.find((g) => g.groupId === id);
    if (!current) return null;
    arr = current.children ?? [];
  }
  return current ?? null;
}

export function findChildGroup(
  parent: ColumnGroupConfig,
  groupId: string,
): ColumnGroupConfig | null {
  return (parent.children ?? []).find((c) => c.groupId === groupId) ?? null;
}

export function groupIdExists(groups: ColumnGroupConfig[], id: string): boolean {
  for (const g of groups) {
    if (g.groupId === id) return true;
    if (g.children && groupIdExists(g.children, id)) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════
// Tree walk
// ═══════════════════════════════════════════════════════════

/** Visit từng node, sâu trước (DFS). Visitor nhận group + path tới node đó. */
export function walkGroups(
  groups: ColumnGroupConfig[],
  visit: (group: ColumnGroupConfig, path: string[]) => void,
  parentPath: readonly string[] = [],
): void {
  for (const g of groups) {
    const path = [...parentPath, g.groupId];
    visit(g, path);
    if (g.children?.length) walkGroups(g.children, visit, path);
  }
}

/** Tập hợp tất cả field thuộc subtree của 1 group (cả lá trực tiếp lẫn nested). */
export function collectAllFieldsIn(group: ColumnGroupConfig): Set<string> {
  const result = new Set<string>();
  const walk = (g: ColumnGroupConfig) => {
    (g.columnFields ?? []).forEach((f) => result.add(f));
    (g.children ?? []).forEach(walk);
  };
  walk(group);
  return result;
}

/** True nếu `candidate` chính là `root` hoặc thuộc subtree của `root`. */
export function isSelfOrDescendantOf(
  root: ColumnGroupConfig,
  candidate: ColumnGroupConfig | null,
): boolean {
  if (!candidate) return false;
  if (candidate === root) return true;
  return (root.children ?? []).some((c) => isSelfOrDescendantOf(c, candidate));
}

/** Trả về mảng headerName từ root → leaf cho path. Fallback về groupId nếu không tìm được. */
export function getBreadcrumbLabels(
  groups: ColumnGroupConfig[],
  path: readonly string[],
): string[] {
  const labels: string[] = [];
  let arr = groups;
  for (const id of path) {
    const g = arr.find((x) => x.groupId === id);
    labels.push(g?.headerName ?? id);
    arr = g?.children ?? [];
  }
  return labels;
}

// ═══════════════════════════════════════════════════════════
// Slug + factory
// ═══════════════════════════════════════════════════════════

/** Chuyển tên → slug ASCII an toàn cho groupId. Bỏ dấu, đ→d, non-alnum→`_`. */
export function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, (m) => (m === 'Đ' ? 'D' : 'd'))
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return base || `grp${Date.now()}`;
}

/** Trả về groupId unique trong cây hiện tại. Append `_1`, `_2`... nếu trùng. */
export function uniqueGroupId(seed: string, groups: ColumnGroupConfig[]): string {
  let id = seed;
  let i = 1;
  while (groupIdExists(groups, id)) id = `${seed}_${i++}`;
  return id;
}

export function makeEmptyGroup(groupId: string, name: string): ColumnGroupConfig {
  return {
    groupId,
    headerName: name,
    columnFields: [],
    children: [],
    items: [],
    marryChildren: false,
  };
}

// ═══════════════════════════════════════════════════════════
// Item operations on a parent group (MUTATE)
// ═══════════════════════════════════════════════════════════

/** Append item vào parent.items, khử trùng. */
export function appendItemRef(parent: ColumnGroupConfig, item: ColumnGroupItem): void {
  if (!parent.items) parent.items = [];
  const dup = parent.items.some(
    (it) =>
      (it.type === 'field' && item.type === 'field' && it.field === item.field) ||
      (it.type === 'group' && item.type === 'group' && it.groupId === item.groupId),
  );
  if (!dup) parent.items.push(item);
}

/** Insert 1 leaf field vào parent (cập nhật cả columnFields và items). */
export function insertFieldItem(
  parent: ColumnGroupConfig,
  field: string,
  atIndex?: number,
): void {
  if (!parent.items) parent.items = [];
  if (parent.columnFields.includes(field)) return;
  parent.columnFields.push(field);
  const idx =
    atIndex === undefined ? parent.items.length : clampIndex(atIndex, parent.items.length);
  parent.items.splice(idx, 0, { type: 'field', field });
}

/** Remove leaf field khỏi parent (cả columnFields và items). */
export function removeFieldItem(parent: ColumnGroupConfig, field: string): void {
  parent.columnFields = (parent.columnFields ?? []).filter((f) => f !== field);
  parent.items = (parent.items ?? []).filter(
    (it) => !(it.type === 'field' && it.field === field),
  );
}

/** Remove 1 sub-group reference khỏi parent (cả children và items entry). */
export function removeChildGroup(parent: ColumnGroupConfig, groupId: string): void {
  parent.children = (parent.children ?? []).filter((g) => g.groupId !== groupId);
  parent.items = (parent.items ?? []).filter(
    (it) => !(it.type === 'group' && it.groupId === groupId),
  );
}

/** Đẩy 1 sub-group instance vào parent.children + push entry vào parent.items. */
export function attachChildGroup(parent: ColumnGroupConfig, child: ColumnGroupConfig): void {
  if (!parent.children) parent.children = [];
  parent.children.push(child);
  appendItemRef(parent, { type: 'group', groupId: child.groupId });
}

// ═══════════════════════════════════════════════════════════
// Generic helpers
// ═══════════════════════════════════════════════════════════

export function clampIndex(idx: number, max: number): number {
  return Math.max(0, Math.min(idx, max));
}

export function swapInArray<T>(arr: T[], i: number, j: number): void {
  [arr[i], arr[j]] = [arr[j], arr[i]];
}
