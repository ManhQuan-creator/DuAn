import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TuiHostedDropdownModule, TuiSvgModule } from '@taiga-ui/core';
import { TreeNode } from '../tree-node.model';

/**
 * Tree-select 1 giá trị — wrap `tui-hosted-dropdown` + render cây đệ quy bằng template.
 *
 * - Input: `nodes: TreeNode<V>[]` (mảng root, thường 1 phần tử nhưng support nhiều).
 * - CVA value: `V | null`. Tích hợp `[(ngModel)]` + `[formControl]`.
 * - **Branch** (node có `children`) → click toggle expand/collapse, KHÔNG chọn được.
 * - **Leaf** (node không có `children`) → click select + close dropdown.
 * - Search (text input trên đầu dropdown) match `label` + `searchText`. Khi có search,
 *   filter giữ leaf match + tất cả ancestors; auto-expand toàn bộ visible branches.
 *   Clear search → restore expand state thủ công của user.
 * - `clearable = true` (default) → render row "Toàn bộ" (label tùy biến qua `clearLabel`)
 *   ở đầu dropdown để reset value về `null`.
 *
 * Mặc định khi nhận `nodes` mới: tất cả branches được expand.
 *
 * Pattern khác `<app-single-select>` (combo-box flat list) — dùng khi data có cấu trúc
 * tree thực sự (vd cây tổ chức, cây menu).
 */
@Component({
  selector: 'app-tree-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TuiHostedDropdownModule,
    TuiSvgModule,
  ],
  templateUrl: './tree-select.component.html',
  styleUrls: ['./tree-select.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TreeSelectComponent),
      multi: true,
    },
  ],
})
export class TreeSelectComponent<V = string> implements ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() set nodes(value: TreeNode<V>[]) {
    const next = value ?? [];
    if (next === this._nodes) return;
    this._nodes = next;
    this.expandedKeys = new Set(this.collectBranchKeys(next));
    this.syncSelectedFromValue();
  }
  get nodes(): TreeNode<V>[] { return this._nodes; }

  @Input() placeholder = 'Chọn...';
  @Input() searchPlaceholder = 'Tìm theo tên...';
  @Input() clearable = true;
  @Input() clearLabel = '-- Bỏ chọn --';
  @Input() size: 's' | 'm' | 'l' = 'm';

  open = false;
  disabled = false;
  searchText = '';
  value: V | null = null;
  selectedLabel = '';

  private _nodes: TreeNode<V>[] = [];
  private expandedKeys = new Set<V>();

  private onChange: (value: V | null) => void = () => {};
  private onTouched: () => void = () => {};

  readonly trackByValue = (_: number, node: TreeNode<V>): unknown => node.value;

  /** Cây sau khi filter theo `searchText`. Khi search rỗng → trả `_nodes` nguyên. */
  get visibleNodes(): TreeNode<V>[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this._nodes;
    return this._nodes
      .map(n => this.filterNode(n, q))
      .filter((n): n is TreeNode<V> => n !== null);
  }

  hasChildren(node: TreeNode<V>): boolean {
    return !!node.children && node.children.length > 0;
  }

  isExpanded(node: TreeNode<V>): boolean {
    // Khi đang search → auto-expand toàn bộ nhánh visible.
    if (this.searchText.trim()) return true;
    return this.expandedKeys.has(node.value);
  }

  isSelected(node: TreeNode<V>): boolean {
    return !this.hasChildren(node) && this.value != null && this.value === node.value;
  }

  onNodeClick(node: TreeNode<V>): void {
    if (node.disabled) return;
    if (this.hasChildren(node)) {
      // Branch → toggle expand. Trong khi search, auto-expand override nên skip toggle.
      if (this.searchText.trim()) return;
      if (this.expandedKeys.has(node.value)) {
        this.expandedKeys.delete(node.value);
      } else {
        this.expandedKeys.add(node.value);
      }
      return;
    }
    // Leaf → select + close.
    this.value = node.value;
    this.selectedLabel = node.label;
    this.searchText = '';
    this.open = false;
    this.onChange(this.value);
    this.onTouched();
  }

  onClear(): void {
    if (this.value == null) {
      this.open = false;
      return;
    }
    this.value = null;
    this.selectedLabel = '';
    this.searchText = '';
    this.open = false;
    this.onChange(null);
    this.onTouched();
  }

  onSearchChange(text: string): void {
    this.searchText = text ?? '';
  }

  // ─── ControlValueAccessor ──────────────────────────────
  writeValue(value: V | null | undefined): void {
    this.value = value ?? null;
    this.syncSelectedFromValue();
    this.cdr.markForCheck();
  }
  registerOnChange(fn: (value: V | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  // ─── Helpers ──────────────────────────────────────────
  private syncSelectedFromValue(): void {
    if (this.value == null || !this._nodes.length) {
      this.selectedLabel = '';
      return;
    }
    const found = this.findNode(this._nodes, this.value);
    this.selectedLabel = found?.label ?? '';
  }

  private findNode(nodes: TreeNode<V>[], target: V): TreeNode<V> | null {
    for (const n of nodes) {
      if (n.value === target) return n;
      if (n.children?.length) {
        const hit = this.findNode(n.children, target);
        if (hit) return hit;
      }
    }
    return null;
  }

  private collectBranchKeys(nodes: TreeNode<V>[]): V[] {
    const out: V[] = [];
    const visit = (list: TreeNode<V>[]): void => {
      for (const n of list) {
        if (n.children?.length) {
          out.push(n.value);
          visit(n.children);
        }
      }
    };
    visit(nodes);
    return out;
  }

  /** Filter node theo query — leaf giữ nếu match `label/searchText`; branch giữ nếu chính nó match HOẶC có descendant match. */
  private filterNode(node: TreeNode<V>, q: string): TreeNode<V> | null {
    const hay = `${node.label} ${node.searchText ?? ''}`.toLowerCase();
    const selfMatch = hay.includes(q);
    if (!node.children?.length) {
      return selfMatch ? node : null;
    }
    const matchedChildren = node.children
      .map(c => this.filterNode(c, q))
      .filter((c): c is TreeNode<V> => c !== null);
    if (matchedChildren.length) {
      return { ...node, children: matchedChildren };
    }
    if (selfMatch) {
      // Branch self match nhưng không có descendant match → giữ branch + show full children.
      return node;
    }
    return null;
  }
}
