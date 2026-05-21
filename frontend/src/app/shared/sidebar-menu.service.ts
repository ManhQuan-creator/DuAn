import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';

/**
 * Một quy tắc phân quyền hiển thị menu sidebar.
 *
 * Hai loại rule:
 *  1. {@code deptCode != null} — quy tắc theo Ban/Phòng:
 *     "user thuộc {@code deptCode} VÀ chức danh nằm trong {@code positionCodes}".
 *     Nếu {@code positionCodes} rỗng → áp dụng cho mọi chức danh thuộc dept đó.
 *  2. {@code deptCode == null} — quy tắc cho lãnh đạo cấp cao (HDTV/TGD/PTGD/GD/PGD):
 *     "user có deptCode = null (lãnh đạo) VÀ chức danh nằm trong {@code positionCodes}".
 *     {@code positionCodes} bắt buộc không rỗng.
 *
 * Một SidebarMenu có thể có nhiều rule (OR-logic): user thấy menu nếu match ÍT NHẤT một rule
 * (và đã thuộc đúng orgGroupCode).
 */
export interface PermissionRule {
  deptCode: string | null;
  positionCodes: string[];
}

export interface SidebarMenuNode {
  id: number;
  parentId: number | null;
  menuKey: string;
  label: string;
  path?: string | null;
  icon?: string | null;
  sortOrder: number;
  /** null = mọi nhóm xem được, "EVNNPC" hoặc "PC_COMPANY" */
  orgGroupCode?: string | null;
  /** Quy tắc per-dept. Empty = không giới hạn thêm theo dept/position. */
  permissionRules?: PermissionRule[];
  active: boolean;
  children?: SidebarMenuNode[];
}

export interface CreateSidebarMenuRequest {
  parentId?: number | null;
  menuKey: string;
  label: string;
  path?: string | null;
  icon?: string | null;
  sortOrder?: number;
  orgGroupCode?: string | null;
  permissionRules?: PermissionRule[];
}

export interface UpdateSidebarMenuRequest {
  parentId?: number | null;
  menuKey?: string;
  label?: string;
  path?: string | null;
  icon?: string | null;
  sortOrder?: number;
  active?: boolean;
  orgGroupCode?: string | null;
  permissionRules?: PermissionRule[];
  /** Cờ buộc backend cập nhật field tương ứng kể cả khi danh sách rỗng/null. */
  updateOrgGroupCode?: boolean;
  updatePermissionRules?: boolean;
}

interface ApiEnvelope<T> {
  code: string;
  message: string;
  data: T;
}

/**
 * Option dùng cho dropdown chọn "Nhóm chức năng báo cáo" trong Excel Builder.
 * Chỉ chứa menu lá (có {@code path}), kèm thông tin parent để hiển thị nhóm.
 */
export interface SidebarMenuOption {
  /** Khóa định danh menu (lưu vào GridTemplate.reportFcGroups). */
  menuKey: string;
  label: string;
  /** menuKey của parent (null nếu là menu cấp gốc — hiếm khi dùng cho leaf). */
  parentMenuKey: string | null;
  /** Label parent để hiển thị làm group header trong dropdown. */
  parentLabel: string | null;
}

@Injectable({ providedIn: 'root' })
export class SidebarMenuService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/excelpro-service/v1/sidebar-menus';

  /** Cache cho dropdown "Nhóm chức năng báo cáo" — dùng chung trong Excel Builder + Render. */
  private menuOptions$: Observable<SidebarMenuOption[]> | null = null;

  /** Cây menu đang active — dùng cho sidebar runtime */
  getActiveTree(): Observable<SidebarMenuNode[]> {
    return this.http
      .get<ApiEnvelope<SidebarMenuNode[]>>(`${this.baseUrl}/tree`)
      .pipe(map(res => res.data ?? []));
  }

  /**
   * Lấy danh sách menu lá (có {@code path}) phẳng kèm parent info — dùng cho dropdown
   * "Nhóm chức năng báo cáo" trong Excel Builder. Cache RAM để tránh gọi lại nhiều lần.
   */
  getMenuOptionsForFcGroup(): Observable<SidebarMenuOption[]> {
    if (!this.menuOptions$) {
      this.menuOptions$ = this.getActiveTree().pipe(
        map((tree) => this.flattenLeafOptions(tree)),
        shareReplay(1),
      );
    }
    return this.menuOptions$;
  }

  /** Map menuKey → label, dùng để hiển thị tên nhóm chức năng (breadcrumb, list, ...). */
  getMenuLabelMap(): Observable<Map<string, string>> {
    return this.getMenuOptionsForFcGroup().pipe(
      map((opts) => new Map(opts.map((o) => [o.menuKey, o.label]))),
    );
  }

  /** Reset cache khi menu được CRUD. */
  invalidateMenuOptionsCache(): void {
    this.menuOptions$ = null;
  }

  /** Flatten cây menu lấy ra các leaf (có path) kèm parent info, sắp xếp theo sortOrder. */
  private flattenLeafOptions(
    nodes: SidebarMenuNode[],
    parent: SidebarMenuNode | null = null,
  ): SidebarMenuOption[] {
    const result: SidebarMenuOption[] = [];
    const sorted = [...nodes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const node of sorted) {
      const hasPath = !!node.path;
      const hasChildren = !!node.children?.length;
      if (hasPath) {
        result.push({
          menuKey: node.menuKey,
          label: node.label,
          parentMenuKey: parent?.menuKey ?? null,
          parentLabel: parent?.label ?? null,
        });
      }
      if (hasChildren) {
        result.push(...this.flattenLeafOptions(node.children!, node));
      }
    }
    return result;
  }

  /** Cây menu đầy đủ (cả inactive) — dùng cho admin manager */
  getFullTree(): Observable<SidebarMenuNode[]> {
    return this.http
      .get<ApiEnvelope<SidebarMenuNode[]>>(`${this.baseUrl}/tree/full`)
      .pipe(map(res => res.data ?? []));
  }

  create(req: CreateSidebarMenuRequest): Observable<SidebarMenuNode> {
    return this.http
      .post<ApiEnvelope<SidebarMenuNode>>(this.baseUrl, req)
      .pipe(map(res => res.data));
  }

  update(id: number, req: UpdateSidebarMenuRequest): Observable<SidebarMenuNode> {
    return this.http
      .put<ApiEnvelope<SidebarMenuNode>>(`${this.baseUrl}/${id}`, req)
      .pipe(map(res => res.data));
  }

  delete(id: number): Observable<void> {
    return this.http
      .delete<ApiEnvelope<void>>(`${this.baseUrl}/${id}`)
      .pipe(map(() => undefined));
  }
}
