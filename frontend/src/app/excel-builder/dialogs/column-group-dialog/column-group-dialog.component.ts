import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButtonModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiCheckboxLabeledModule, TuiInputModule } from '@taiga-ui/kit';
import { AppDialogDirective } from '../../../shared/components/app-dialog.directive';
import { AppDialogService } from '../../../shared/dialog.service';
import {
  ColumnConfig,
  ColumnGroupConfig,
  ColumnGroupItem,
  reconcileColumnGroupItems,
} from '../../excel-builder.component';
import {
  MoveContext,
  MovePickerState,
  MoveTargetOption,
  PreviewBlock,
} from './column-group-dialog.types';
import {
  appendItemRef,
  attachChildGroup,
  collectAllFieldsIn,
  findChildGroup,
  findGroupByPath,
  getBreadcrumbLabels,
  groupIdExists,
  insertFieldItem,
  isSelfOrDescendantOf,
  makeEmptyGroup,
  pathKey,
  pathStartsWith,
  pathsEqual,
  removeChildGroup,
  removeFieldItem,
  slugify,
  swapInArray,
  uniqueGroupId,
  walkGroups,
} from './column-group-tree.utils';

const GROUP_ID_PATTERN = /^[a-zA-Z0-9_]+$/;

/**
 * Dialog WYSIWYG quản lý cấu trúc nhóm cột.
 *
 * Kiến trúc:
 *  - Pure tree manipulation tách ra `column-group-tree.utils.ts`
 *  - Types tách ra `column-group-dialog.types.ts`
 *  - Component này CHỈ giữ UI state + form controls + event handlers
 *
 * Mọi handler theo pattern: `mutate model → recomputeAll() → CD tự update view`.
 */
@Component({
  selector: 'app-column-group-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TuiButtonModule,
    TuiTextfieldControllerModule,
    TuiInputModule,
    TuiCheckboxLabeledModule,
    AppDialogDirective,
  ],
  templateUrl: './column-group-dialog.component.html',
  styleUrls: ['./column-group-dialog.component.scss'],
})
export class ColumnGroupDialogComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() columnGroups: ColumnGroupConfig[] = [];
  @Input() columnConfigs: ColumnConfig[] = [];
  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() applyGroups = new EventEmitter<ColumnGroupConfig[]>();

  private readonly appDialog = inject(AppDialogService);

  // ─── UI state ─────────────────────────────────────────────
  selectedPath: string[] | null = null;
  renamingPath: string[] | null = null;
  addingSubToPath: string[] | null = null;
  settingsOpenForPath: string[] | null = null;
  expandedGroupIds = new Set<string>();
  movePicker: MovePickerState | null = null;

  // ─── Form controls ────────────────────────────────────────
  readonly rootGroupNameCtrl = new FormControl('', Validators.required);
  readonly renameCtrl = new FormControl('', Validators.required);
  readonly addSubNameCtrl = new FormControl('', Validators.required);
  readonly chipSearchCtrl = new FormControl('', { nonNullable: true });
  readonly customGroupIdCtrl = new FormControl('', Validators.pattern(GROUP_ID_PATTERN));

  // ─── Cached views (recompute sau mỗi mutation) ────────────
  availableColumns: ColumnConfig[] = [];
  availableColumnsFiltered: ColumnConfig[] = [];
  previewBlocks: PreviewBlock[] = [];
  private fieldToRootMap = new Map<string, ColumnGroupConfig>();

  // ═════════════════════════════════════════════════════════
  // Lifecycle
  // ═════════════════════════════════════════════════════════

  ngOnChanges(changes: SimpleChanges): void {
    const opened = (changes['isOpen'] || changes['columnGroups']) && this.isOpen;
    if (opened) this.initOnOpen();
  }

  private initOnOpen(): void {
    this.resetUi();
    this.columnGroups.forEach(reconcileColumnGroupItems);
    walkGroups(this.columnGroups, (g) => this.expandedGroupIds.add(g.groupId));
    this.recomputeAll();
  }

  private resetUi(): void {
    this.selectedPath = null;
    this.renamingPath = null;
    this.addingSubToPath = null;
    this.settingsOpenForPath = null;
    this.movePicker = null;
    this.rootGroupNameCtrl.reset();
    this.renameCtrl.reset();
    this.addSubNameCtrl.reset();
    this.chipSearchCtrl.reset('');
    this.customGroupIdCtrl.reset();
  }

  // ═════════════════════════════════════════════════════════
  // Recompute pipeline
  // ═════════════════════════════════════════════════════════

  /** Recompute toàn bộ caches. Gọi sau mỗi mutation. */
  private recomputeAll(): void {
    this.recomputeFieldToRoot();
    this.recomputeAvailable();
    this.recomputePreviewBlocks();
  }

  private recomputeFieldToRoot(): void {
    this.fieldToRootMap.clear();
    for (const root of this.columnGroups) {
      collectAllFieldsIn(root).forEach((f) => this.fieldToRootMap.set(f, root));
    }
  }

  private recomputeAvailable(): void {
    this.availableColumns = this.columnConfigs.filter((c) => !this.fieldToRootMap.has(c.field));
    this.applyChipSearch();
  }

  private applyChipSearch(): void {
    const q = this.chipSearchCtrl.value.trim().toLowerCase();
    this.availableColumnsFiltered = !q
      ? this.availableColumns
      : this.availableColumns.filter(
          (c) => c.headerName.toLowerCase().includes(q) || c.field.toLowerCase().includes(q),
        );
  }

  private recomputePreviewBlocks(): void {
    const emitted = new Set<string>();
    const blocks: PreviewBlock[] = [];
    for (const cfg of this.columnConfigs) {
      const root = this.fieldToRootMap.get(cfg.field);
      if (!root) {
        blocks.push({ kind: 'leaf', field: cfg.field, headerName: cfg.headerName });
        continue;
      }
      if (!emitted.has(root.groupId)) {
        emitted.add(root.groupId);
        blocks.push({ kind: 'group', group: root });
      }
    }
    this.previewBlocks = blocks;
  }

  // ═════════════════════════════════════════════════════════
  // Template lookups (delegated to utils)
  // ═════════════════════════════════════════════════════════

  findChildGroup = (parent: ColumnGroupConfig, groupId: string): ColumnGroupConfig | null =>
    findChildGroup(parent, groupId);

  pathOf = (parentPath: string[], groupId: string): string[] => [...parentPath, groupId];

  getBreadcrumb(path: string[]): string {
    return getBreadcrumbLabels(this.columnGroups, path).join(' › ');
  }

  getColumnHeaderName(field: string): string {
    return this.columnConfigs.find((c) => c.field === field)?.headerName ?? field;
  }

  isEmpty(group: ColumnGroupConfig): boolean {
    return (group.columnFields?.length ?? 0) === 0 && (group.children?.length ?? 0) === 0;
  }

  // ═════════════════════════════════════════════════════════
  // UI state predicates
  // ═════════════════════════════════════════════════════════

  isSelected(path: string[]): boolean {
    return pathsEqual(this.selectedPath, path);
  }

  isRenaming(path: string[]): boolean {
    return pathsEqual(this.renamingPath, path);
  }

  isAddingSubTo(path: string[]): boolean {
    return pathsEqual(this.addingSubToPath, path);
  }

  isSettingsOpen(path: string[]): boolean {
    return pathsEqual(this.settingsOpenForPath, path);
  }

  isExpanded(groupId: string): boolean {
    return this.expandedGroupIds.has(groupId);
  }

  // ═════════════════════════════════════════════════════════
  // Selection
  // ═════════════════════════════════════════════════════════

  selectGroup(path: string[]): void {
    this.selectedPath = path;
  }

  toggleExpand(groupId: string): void {
    if (this.expandedGroupIds.has(groupId)) this.expandedGroupIds.delete(groupId);
    else this.expandedGroupIds.add(groupId);
  }

  // ═════════════════════════════════════════════════════════
  // Add root + sub
  // ═════════════════════════════════════════════════════════

  addRootGroup(): void {
    if (this.rootGroupNameCtrl.invalid) {
      this.rootGroupNameCtrl.markAsTouched();
      return;
    }
    const name = this.rootGroupNameCtrl.value!.trim();
    const groupId = uniqueGroupId(slugify(name), this.columnGroups);
    this.columnGroups.push(makeEmptyGroup(groupId, name));
    this.expandedGroupIds.add(groupId);
    this.rootGroupNameCtrl.reset();
    this.recomputeAll();
  }

  startAddingSub(path: string[]): void {
    this.addingSubToPath = path;
    this.addSubNameCtrl.reset();
    if (path.length > 0) this.expandedGroupIds.add(path[path.length - 1]);
  }

  commitAddSub(): void {
    if (!this.addingSubToPath || this.addSubNameCtrl.invalid) {
      this.addSubNameCtrl.markAsTouched();
      return;
    }
    const parent = findGroupByPath(this.columnGroups, this.addingSubToPath);
    if (!parent) return;
    const name = this.addSubNameCtrl.value!.trim();
    const groupId = uniqueGroupId(slugify(name), this.columnGroups);
    attachChildGroup(parent, makeEmptyGroup(groupId, name));
    this.expandedGroupIds.add(parent.groupId).add(groupId);
    this.addingSubToPath = null;
    this.addSubNameCtrl.reset();
    this.recomputeAll();
  }

  cancelAddSub(): void {
    this.addingSubToPath = null;
    this.addSubNameCtrl.reset();
  }

  // ═════════════════════════════════════════════════════════
  // Inline rename
  // ═════════════════════════════════════════════════════════

  startRename(path: string[]): void {
    const group = findGroupByPath(this.columnGroups, path);
    if (!group) return;
    this.renamingPath = path;
    this.renameCtrl.setValue(group.headerName);
    this.focusRenameInput();
  }

  commitRename(): void {
    if (!this.renamingPath) return;
    const group = findGroupByPath(this.columnGroups, this.renamingPath);
    const newName = (this.renameCtrl.value ?? '').trim();
    if (group && newName) {
      group.headerName = newName;
      this.recomputePreviewBlocks();
    }
    this.renamingPath = null;
  }

  cancelRename(): void {
    this.renamingPath = null;
    this.renameCtrl.reset();
  }

  private focusRenameInput(): void {
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('.cg-node-rename input');
      el?.focus();
      el?.select();
    });
  }

  // ═════════════════════════════════════════════════════════
  // Settings popover
  // ═════════════════════════════════════════════════════════

  toggleSettings(path: string[]): void {
    if (this.isSettingsOpen(path)) {
      this.settingsOpenForPath = null;
      return;
    }
    this.settingsOpenForPath = path;
    const group = findGroupByPath(this.columnGroups, path);
    this.customGroupIdCtrl.setValue(group?.groupId ?? '');
  }

  toggleMarryChildren(path: string[], checked: boolean): void {
    const group = findGroupByPath(this.columnGroups, path);
    if (group) group.marryChildren = checked;
  }

  commitCustomGroupId(path: string[]): void {
    if (this.customGroupIdCtrl.invalid) {
      this.customGroupIdCtrl.markAsTouched();
      return;
    }
    const newId = (this.customGroupIdCtrl.value ?? '').trim();
    const group = findGroupByPath(this.columnGroups, path);
    if (!newId || !group || newId === group.groupId) return;
    if (groupIdExists(this.columnGroups, newId)) {
      this.appDialog.warning(`Mã nhóm "${newId}" đã tồn tại!`);
      return;
    }
    this.renameGroupId(group, path, newId);
    this.recomputeAll();
  }

  /** Đổi groupId + cập nhật mọi reference (parent.items, expanded, paths). */
  private renameGroupId(group: ColumnGroupConfig, path: string[], newId: string): void {
    const oldId = group.groupId;
    group.groupId = newId;

    const parentPath = path.slice(0, -1);
    const parent = parentPath.length ? findGroupByPath(this.columnGroups, parentPath) : null;
    if (parent) {
      parent.items = (parent.items ?? []).map((it) =>
        it.type === 'group' && it.groupId === oldId ? { type: 'group', groupId: newId } : it,
      );
    }
    if (this.expandedGroupIds.delete(oldId)) this.expandedGroupIds.add(newId);

    const newPath = [...parentPath, newId];
    this.settingsOpenForPath = newPath;
    if (pathsEqual(this.selectedPath, path)) this.selectedPath = newPath;
  }

  // ═════════════════════════════════════════════════════════
  // Field assignment (chip click)
  // ═════════════════════════════════════════════════════════

  onChipSearchChange(): void {
    this.applyChipSearch();
  }

  onChipClick(field: string): void {
    if (!this.selectedPath) {
      this.appDialog.warning('Hãy click chọn 1 nhóm trong cây trước khi gán cột.');
      return;
    }
    const target = findGroupByPath(this.columnGroups, this.selectedPath);
    if (!target) return;
    insertFieldItem(target, field);
    this.recomputeAll();
  }

  removeFieldFromGroup(parentPath: string[], field: string): void {
    const parent = findGroupByPath(this.columnGroups, parentPath);
    if (!parent) return;
    removeFieldItem(parent, field);
    this.recomputeAll();
  }

  // ═════════════════════════════════════════════════════════
  // Reorder (▲▼) — within siblings
  // ═════════════════════════════════════════════════════════

  moveUp(parentPath: string[], idx: number): void {
    if (idx <= 0) return;
    this.swapSiblings(parentPath, idx, idx - 1);
  }

  moveDown(parentPath: string[], idx: number): void {
    const len = this.getSiblingsLength(parentPath);
    if (idx >= len - 1) return;
    this.swapSiblings(parentPath, idx, idx + 1);
  }

  private swapSiblings(parentPath: string[], i: number, j: number): void {
    if (parentPath.length === 0) {
      swapInArray(this.columnGroups, i, j);
    } else {
      const parent = findGroupByPath(this.columnGroups, parentPath);
      if (!parent?.items?.length) return;
      swapInArray(parent.items, i, j);
    }
    this.recomputeAll();
  }

  private getSiblingsLength(parentPath: string[]): number {
    if (parentPath.length === 0) return this.columnGroups.length;
    const parent = findGroupByPath(this.columnGroups, parentPath);
    return parent?.items?.length ?? 0;
  }

  // ═════════════════════════════════════════════════════════
  // Remove
  // ═════════════════════════════════════════════════════════

  removeGroupByPath(path: string[]): void {
    if (path.length === 0) return;
    const groupId = path[path.length - 1];
    const parentPath = path.slice(0, -1);
    const parent = parentPath.length ? findGroupByPath(this.columnGroups, parentPath) : null;
    if (parent) {
      removeChildGroup(parent, groupId);
    } else {
      this.columnGroups = this.columnGroups.filter((g) => g.groupId !== groupId);
    }
    this.clearUiPathsAt(path);
    this.recomputeAll();
  }

  /** Xoá mọi UI path đang ref vào subtree của `removedPath`. */
  private clearUiPathsAt(removedPath: string[]): void {
    if (pathStartsWith(this.renamingPath, removedPath)) this.renamingPath = null;
    if (pathStartsWith(this.selectedPath, removedPath)) this.selectedPath = null;
    if (pathStartsWith(this.settingsOpenForPath, removedPath)) this.settingsOpenForPath = null;
    if (pathStartsWith(this.addingSubToPath, removedPath)) this.addingSubToPath = null;
  }

  // ═════════════════════════════════════════════════════════
  // Move-to picker (cross-tree move)
  // ═════════════════════════════════════════════════════════

  startMoveGroup(itemPath: string[]): void {
    if (itemPath.length === 0) return;
    const movingGroup = findGroupByPath(this.columnGroups, itemPath);
    if (!movingGroup) return;
    const fromParentPath = itemPath.slice(0, -1);
    const groupId = itemPath[itemPath.length - 1];
    this.movePicker = {
      title: `Chuyển nhóm "${movingGroup.headerName}" sang...`,
      context: { kind: 'group', groupId, fromParentPath },
      targets: this.buildMoveTargets({
        fromParentPath,
        excludeSubtreeOf: movingGroup,
        includeRoot: true,
      }),
    };
  }

  startMoveField(parentPath: string[], field: string): void {
    this.movePicker = {
      title: `Chuyển cột "${this.getColumnHeaderName(field)}" sang...`,
      context: { kind: 'field', field, fromParentPath: parentPath },
      targets: this.buildMoveTargets({
        fromParentPath: parentPath,
        excludeSubtreeOf: null,
        includeRoot: false,
      }),
    };
  }

  doMoveTo(targetParentPath: string[]): void {
    if (!this.movePicker) return;
    this.executeMove(this.movePicker.context, targetParentPath);
    this.movePicker = null;
    this.recomputeAll();
  }

  cancelMovePicker(): void {
    this.movePicker = null;
  }

  /** Build danh sách target options. Unified cho cả group-move và field-move qua flags. */
  private buildMoveTargets(opts: {
    fromParentPath: readonly string[];
    excludeSubtreeOf: ColumnGroupConfig | null;
    includeRoot: boolean;
  }): MoveTargetOption[] {
    const fromKey = pathKey(opts.fromParentPath);
    const targets: MoveTargetOption[] = [];

    if (opts.includeRoot) {
      targets.push(this.makeMoveOption('— Nhóm gốc —', [], fromKey === ''));
    }

    walkGroups(this.columnGroups, (g, path) => {
      if (opts.excludeSubtreeOf && isSelfOrDescendantOf(opts.excludeSubtreeOf, g)) return;
      const breadcrumb = getBreadcrumbLabels(this.columnGroups, path).join(' › ');
      targets.push(this.makeMoveOption(breadcrumb, path, pathKey(path) === fromKey));
    });

    return targets;
  }

  private makeMoveOption(label: string, path: string[], isCurrent: boolean): MoveTargetOption {
    return {
      label,
      path,
      disabled: isCurrent,
      reason: isCurrent ? '(đang ở đây)' : undefined,
    };
  }

  /** Dispatch move dựa trên context kind. */
  private executeMove(ctx: MoveContext, toParentPath: string[]): void {
    if (ctx.kind === 'group') {
      this.moveGroupBetween(ctx.fromParentPath, toParentPath, ctx.groupId);
    } else {
      this.moveFieldBetween(ctx.fromParentPath, toParentPath, ctx.field);
    }
  }

  private moveGroupBetween(
    fromParentPath: string[],
    toParentPath: string[],
    groupId: string,
  ): void {
    const fromParent = fromParentPath.length
      ? findGroupByPath(this.columnGroups, fromParentPath)
      : null;
    const toParent = toParentPath.length
      ? findGroupByPath(this.columnGroups, toParentPath)
      : null;

    const movingGroup = this.detachGroupFromParent(fromParent, groupId);
    if (!movingGroup) return;

    if (toParent && isSelfOrDescendantOf(movingGroup, toParent)) {
      this.appDialog.warning('Không thể chuyển nhóm vào con của chính nó.');
      // Re-attach (rollback) — defensive, UI đã filter target
      this.attachGroupToParent(fromParent, movingGroup);
      return;
    }
    this.attachGroupToParent(toParent, movingGroup);
  }

  private moveFieldBetween(
    fromParentPath: string[],
    toParentPath: string[],
    field: string,
  ): void {
    if (toParentPath.length === 0) return; // field không thể ở root level
    const fromParent = findGroupByPath(this.columnGroups, fromParentPath);
    const toParent = findGroupByPath(this.columnGroups, toParentPath);
    if (!fromParent || !toParent || fromParent === toParent) return;
    removeFieldItem(fromParent, field);
    insertFieldItem(toParent, field);
  }

  /** Tách 1 group ra khỏi parent (hoặc khỏi root nếu parent=null). */
  private detachGroupFromParent(
    parent: ColumnGroupConfig | null,
    groupId: string,
  ): ColumnGroupConfig | null {
    const arr = parent ? (parent.children ?? []) : this.columnGroups;
    const idx = arr.findIndex((g) => g.groupId === groupId);
    if (idx < 0) return null;
    const [removed] = arr.splice(idx, 1);
    if (parent) {
      parent.items = (parent.items ?? []).filter(
        (it) => !(it.type === 'group' && it.groupId === groupId),
      );
    }
    return removed;
  }

  /** Gắn 1 group vào parent (hoặc thành root nếu parent=null). Append cuối list. */
  private attachGroupToParent(
    parent: ColumnGroupConfig | null,
    group: ColumnGroupConfig,
  ): void {
    if (parent) {
      attachChildGroup(parent, group);
    } else {
      this.columnGroups.push(group);
    }
  }

  // ═════════════════════════════════════════════════════════
  // Apply / close
  // ═════════════════════════════════════════════════════════

  onApply(): void {
    this.columnGroups.forEach(reconcileColumnGroupItems);
    this.applyGroups.emit(this.columnGroups);
    this.close();
  }

  close(): void {
    this.isOpen = false;
    this.isOpenChange.emit(false);
  }

  // ═════════════════════════════════════════════════════════
  // *ngFor trackBy
  // ═════════════════════════════════════════════════════════

  trackItem = (_: number, item: ColumnGroupItem): string =>
    item.type === 'field' ? `f:${item.field}` : `g:${item.groupId}`;

  trackGroup = (_: number, g: ColumnGroupConfig): string => g.groupId;

  trackCol = (_: number, c: ColumnConfig): string => c.field;

  trackPreview = (_: number, b: PreviewBlock): string =>
    b.kind === 'leaf' ? `l:${b.field}` : `g:${b.group.groupId}`;

  trackTarget = (_: number, t: MoveTargetOption): string => pathKey(t.path) || '__root__';
}
