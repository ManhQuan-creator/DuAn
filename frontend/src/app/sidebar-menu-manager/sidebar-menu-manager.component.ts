import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import {
  animate,
  query,
  stagger,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { FormsModule } from '@angular/forms';
import {
  CdkDrag,
  CdkDragDrop,
  DragDropModule,
} from '@angular/cdk/drag-drop';
import { TuiButtonModule, TuiSvgModule } from '@taiga-ui/core';
import { Observable, Subject, finalize, forkJoin, takeUntil } from 'rxjs';
import { AppDialogService } from '../shared/dialog.service';
import {
  PageHeaderBreadcrumb,
  PageHeaderComponent,
} from '../shared/components/page-header/page-header.component';
import {
  CreateSidebarMenuRequest,
  SidebarMenuNode,
  SidebarMenuService,
  UpdateSidebarMenuRequest,
} from '../shared/sidebar-menu.service';
import {
  SidebarMenuFormDialogComponent,
  SidebarMenuFormResult,
} from './sidebar-menu-form-dialog/sidebar-menu-form-dialog.component';

interface FlatMenuRow {
  node: SidebarMenuNode;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

const BREADCRUMBS: PageHeaderBreadcrumb[] = [
  { label: 'Trang chủ', link: '' },
  { label: 'Hệ thống', link: '' },
  { label: 'Quản lý menu sidebar', link: '' },
];

// Fade + slide + collapse cho từng row khi tree thay đổi.
// - Dùng stagger ở :enter để expandAll tạo hiệu ứng "đổ xuống" mượt.
// - :leave nhanh hơn một chút để collapseAll không cảm giác chậm.
const TREE_LIST_ANIMATION = trigger('treeList', [
  transition('* => *', [
    query(
      ':enter',
      [
        style({
          opacity: 0,
          height: 0,
          paddingTop: 0,
          paddingBottom: 0,
          transform: 'translateY(-6px)',
          overflow: 'hidden',
        }),
        stagger(15, [
          animate(
            '220ms cubic-bezier(0.4, 0, 0.2, 1)',
            style({
              opacity: 1,
              height: '*',
              paddingTop: '*',
              paddingBottom: '*',
              transform: 'translateY(0)',
            }),
          ),
        ]),
      ],
      { optional: true },
    ),
    query(
      ':leave',
      [
        style({ overflow: 'hidden' }),
        animate(
          '160ms cubic-bezier(0.4, 0, 0.2, 1)',
          style({
            opacity: 0,
            height: 0,
            paddingTop: 0,
            paddingBottom: 0,
            transform: 'translateY(-6px)',
          }),
        ),
      ],
      { optional: true },
    ),
  ]),
]);

@Component({
  selector: 'app-sidebar-menu-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    TuiButtonModule,
    TuiSvgModule,
    PageHeaderComponent,
    SidebarMenuFormDialogComponent,
  ],
  templateUrl: './sidebar-menu-manager.component.html',
  styleUrls: ['./sidebar-menu-manager.component.scss'],
  animations: [TREE_LIST_ANIMATION],
})
export class SidebarMenuManagerComponent implements OnInit, OnDestroy {
  private readonly service = inject(SidebarMenuService);
  private readonly dialog = inject(AppDialogService);
  private readonly destroy$ = new Subject<void>();

  readonly breadcrumbs = BREADCRUMBS;

  loading = false;
  tree: SidebarMenuNode[] = [];
  flatRows: FlatMenuRow[] = [];
  expandedIds = new Set<number>();

  // Form dialog state
  formDialogOpen = false;
  formMode: 'create' | 'edit' = 'create';
  formParentId: number | null = null;
  formParentLabel: string | null = null;
  formEditingNode: SidebarMenuNode | null = null;

  ngOnInit(): void {
    this.loadTree();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===== Tree loading & flattening =====

  loadTree(): void {
    this.loading = true;
    this.service
      .getFullTree()
      .pipe(takeUntil(this.destroy$), finalize(() => (this.loading = false)))
      .subscribe({
        next: (tree) => {
          this.tree = tree;
          this.autoExpandRootsIfEmpty(tree);
          this.rebuildFlatRows();
        },
        error: (err) =>
          this.dialog.error(err?.error?.message || 'Không tải được danh sách menu'),
      });
  }

  private autoExpandRootsIfEmpty(tree: SidebarMenuNode[]): void {
    if (this.expandedIds.size > 0) return;
    for (const root of tree) this.expandedIds.add(root.id);
  }

  private rebuildFlatRows(): void {
    this.flatRows = flattenTree(this.tree, 0, this.expandedIds);
  }

  // Giữ identity của row theo id → *ngFor không dựng lại toàn bộ DOM khi
  // flatten, cho phép :enter/:leave chạy đúng các phần tử thực sự thêm/gỡ.
  trackByRow = (_: number, row: FlatMenuRow): number => row.node.id;

  // ===== Expand / collapse =====

  toggleExpand(row: FlatMenuRow): void {
    if (!row.hasChildren) return;
    if (this.expandedIds.has(row.node.id)) {
      this.expandedIds.delete(row.node.id);
    } else {
      this.expandedIds.add(row.node.id);
    }
    this.rebuildFlatRows();
  }

  toggleExpandAll(): void {
    if (this.isAllExpanded) this.collapseAll();
    else this.expandAll();
  }

  get isAllExpanded(): boolean {
    const ids = collectExpandableIds(this.tree);
    return ids.length > 0 && ids.every((id) => this.expandedIds.has(id));
  }

  private expandAll(): void {
    collectExpandableIds(this.tree).forEach((id) => this.expandedIds.add(id));
    this.rebuildFlatRows();
  }

  private collapseAll(): void {
    this.expandedIds.clear();
    this.rebuildFlatRows();
  }

  // ===== Permission display helpers =====

  hasRestrictions(node: SidebarMenuNode): boolean {
    return !!node.orgGroupCode || (node.permissionRules?.length ?? 0) > 0;
  }

  /** Số rule per-dept (không tính rule lãnh đạo cấp cao deptCode=null). */
  deptRuleCount(node: SidebarMenuNode): number {
    return node.permissionRules?.filter((r) => r.deptCode != null).length ?? 0;
  }

  /** Số chức danh trong rule lãnh đạo cấp cao (deptCode null). 0 nếu không có. */
  topLevelPositionCount(node: SidebarMenuNode): number {
    const top = node.permissionRules?.find((r) => r.deptCode == null);
    return top?.positionCodes?.length ?? 0;
  }

  /** Tổng số chức danh trong các rule per-dept. */
  totalDeptPositionCount(node: SidebarMenuNode): number {
    return (
      node.permissionRules
        ?.filter((r) => r.deptCode != null)
        .reduce((sum, r) => sum + (r.positionCodes?.length ?? 0), 0) ?? 0
    );
  }

  permissionLabel(node: SidebarMenuNode): string {
    const parts: string[] = [];
    if (node.orgGroupCode) parts.push(node.orgGroupCode);
    const top = this.topLevelPositionCount(node);
    if (top > 0) parts.push(`${top} lãnh đạo`);
    const dept = this.deptRuleCount(node);
    if (dept > 0) {
      const pos = this.totalDeptPositionCount(node);
      parts.push(pos > 0 ? `${dept} ban/phòng • ${pos} chức danh` : `${dept} ban/phòng`);
    }
    return parts.join(' • ');
  }

  // ===== CRUD via dialog =====

  openCreateRoot(): void {
    this.openFormDialog('create', null, null, null);
  }

  openCreateChild(parent: SidebarMenuNode): void {
    this.openFormDialog('create', parent.id, parent.label, null);
  }

  openEditDialog(node: SidebarMenuNode): void {
    this.openFormDialog('edit', node.parentId ?? null, null, node);
  }

  private openFormDialog(
    mode: 'create' | 'edit',
    parentId: number | null,
    parentLabel: string | null,
    editingNode: SidebarMenuNode | null,
  ): void {
    this.formMode = mode;
    this.formParentId = parentId;
    this.formParentLabel = parentLabel;
    this.formEditingNode = editingNode;
    this.formDialogOpen = true;
  }

  onFormSaved(result: SidebarMenuFormResult): void {
    if (result.mode === 'create') {
      this.handleCreate(result.payload as CreateSidebarMenuRequest);
    } else if (this.formEditingNode) {
      this.handleUpdate(
        this.formEditingNode.id,
        result.payload as UpdateSidebarMenuRequest,
      );
    }
  }

  private handleCreate(req: CreateSidebarMenuRequest): void {
    this.runAndReload(this.service.create(req), 'Đã tạo menu mới', 'Tạo menu thất bại', () => {
      if (req.parentId) this.expandedIds.add(req.parentId);
    });
  }

  private handleUpdate(id: number, req: UpdateSidebarMenuRequest): void {
    this.runAndReload(
      this.service.update(id, req),
      'Đã cập nhật menu',
      'Cập nhật thất bại',
    );
  }

  confirmDelete(node: SidebarMenuNode): void {
    const childCount = countDescendants(node);
    const message =
      childCount > 0
        ? `Menu "${node.label}" có ${childCount} menu con. Xóa menu này sẽ xóa toàn bộ menu con. Bạn chắc chắn?`
        : `Bạn có chắc chắn muốn xóa menu "${node.label}"?`;
    this.dialog
      .confirm({
        title: 'Xác nhận xóa menu',
        message,
        status: 'warning',
        confirmText: 'Xóa',
        cancelText: 'Hủy',
      })
      .subscribe((ok) => ok && this.deleteMenu(node));
  }

  private deleteMenu(node: SidebarMenuNode): void {
    this.runAndReload(this.service.delete(node.id), 'Đã xóa menu', 'Xóa thất bại', () => {
      this.expandedIds.delete(node.id);
    });
  }

  /** Chạy 1 API gây thay đổi dữ liệu, kèm toast thành công/lỗi và reload tree. */
  private runAndReload<T>(
    request$: Observable<T>,
    successMessage: string,
    errorMessage: string,
    onSuccess?: () => void,
  ): void {
    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.dialog.success(successMessage);
        onSuccess?.();
        this.formDialogOpen = false;
        this.service.invalidateMenuOptionsCache();
        this.loadTree();
      },
      error: (err) => this.dialog.error(err?.error?.message || errorMessage),
    });
  }

  // ===== Drag & drop reordering =====

  // Chỉ cho phép preview sort giữa các row cùng parent. End-of-list (target
  // undefined) cũng allow — onDrop sẽ quy chiếu vị trí về đúng sibling gần nhất.
  sortPredicate = (index: number, drag: CdkDrag<FlatMenuRow>): boolean => {
    const source = drag.data;
    const target = this.flatRows[index];
    if (!target) return true;
    if (target.node.id === source.node.id) return true;
    return target.node.parentId === source.node.parentId;
  };

  onDrop(event: CdkDragDrop<FlatMenuRow[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    const draggedNode = (event.item.data as FlatMenuRow).node;
    const siblings = this.findSiblings(draggedNode);
    const srcIdx = siblings.findIndex((s) => s.id === draggedNode.id);
    if (srcIdx === -1) return;

    const destIdx = this.computeDestSiblingIndex(draggedNode, event);
    if (destIdx === srcIdx) return;

    this.reorderSiblings(siblings, srcIdx, destIdx);
    this.rebuildFlatRows();
    this.persistSiblingOrder(siblings);
  }

  /** Quy chiếu currentIndex (trong flat list) về index trong mảng siblings. */
  private computeDestSiblingIndex(
    draggedNode: SidebarMenuNode,
    event: CdkDragDrop<FlatMenuRow[]>,
  ): number {
    const parentId = draggedNode.parentId ?? null;
    const postMove = [...this.flatRows];
    const [moved] = postMove.splice(event.previousIndex, 1);
    postMove.splice(event.currentIndex, 0, moved);

    let count = 0;
    for (let i = 0; i < event.currentIndex; i++) {
      const row = postMove[i];
      if (row.node.id === draggedNode.id) continue;
      if ((row.node.parentId ?? null) === parentId) count++;
    }
    return count;
  }

  /** Mutate mảng siblings trong tree + gán lại sortOrder tuần tự. */
  private reorderSiblings(
    siblings: SidebarMenuNode[],
    from: number,
    to: number,
  ): void {
    const [moved] = siblings.splice(from, 1);
    siblings.splice(to, 0, moved);
    siblings.forEach((s, idx) => (s.sortOrder = idx));
  }

  /** Batch update sortOrder cho toàn bộ siblings. Lỗi → reload để revert. */
  private persistSiblingOrder(siblings: SidebarMenuNode[]): void {
    const updates = siblings.map((s, idx) =>
      this.service.update(s.id, { sortOrder: idx }),
    );
    forkJoin(updates)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.service.invalidateMenuOptionsCache(),
        error: (err) => {
          this.dialog.error(err?.error?.message || 'Đổi thứ tự thất bại');
          this.loadTree();
        },
      });
  }

  private findSiblings(node: SidebarMenuNode): SidebarMenuNode[] {
    if (node.parentId == null) return this.tree;
    return findNodeById(this.tree, node.parentId)?.children ?? [];
  }
}

// ===== Pure tree helpers =====

function flattenTree(
  nodes: SidebarMenuNode[],
  depth: number,
  expandedIds: Set<number>,
): FlatMenuRow[] {
  const rows: FlatMenuRow[] = [];
  for (const node of nodes) {
    const hasChildren = !!node.children?.length;
    const isExpanded = expandedIds.has(node.id);
    rows.push({ node, depth, hasChildren, isExpanded });
    if (hasChildren && isExpanded) {
      rows.push(...flattenTree(node.children!, depth + 1, expandedIds));
    }
  }
  return rows;
}

/** Chỉ lấy id của các node thực sự có con (có thể expand). */
function collectExpandableIds(nodes: SidebarMenuNode[]): number[] {
  const ids: number[] = [];
  for (const n of nodes) {
    if (n.children?.length) {
      ids.push(n.id);
      ids.push(...collectExpandableIds(n.children));
    }
  }
  return ids;
}

function findNodeById(
  nodes: SidebarMenuNode[],
  id: number,
): SidebarMenuNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) {
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

function countDescendants(node: SidebarMenuNode): number {
  if (!node.children?.length) return 0;
  let count = node.children.length;
  for (const c of node.children) count += countDescendants(c);
  return count;
}
