/**
 * Node của cây cho `<app-tree-select>`.
 *
 * - `value`: định danh duy nhất trong toàn cây (cả branch + leaf).
 * - `label`: text hiển thị.
 * - `children`: có = branch (chỉ expand/collapse, không chọn được).
 *               không có (hoặc array rỗng) = leaf (chọn được trừ khi `disabled`).
 * - `searchText`: keywords bổ sung dùng cho filter — không hiển thị.
 *
 * Caller chịu trách nhiệm mapping từ data shape của mình (vd `{ code, name, children }`)
 * sang `TreeNode<V>` trước khi truyền vào component.
 */
export interface TreeNode<V = string> {
  value: V;
  label: string;
  children?: TreeNode<V>[];
  disabled?: boolean;
  searchText?: string;
}
