import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { CatalogItem } from '../../excel-builder/models/catalog.data';
import { SidebarMenuService } from '../../shared/sidebar-menu.service';
import { Page, ResponseData } from '../../shared/models/common.model';
import { CatalogTypeItem, CreateCatalogItemRequest, CreateCatalogTypeRequest, FilterCatalogItemRequest, UpdateCatalogItemRequest, UpdateCatalogTypeRequest } from '../models/catalog.model';


@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);
  private sidebarMenuService = inject(SidebarMenuService);
  private baseUrl = '/excelpro-service/v1/master-data';

  // === Catalog Items ===

  getCatalogs(type: string, includeInactive = false): Observable<CatalogItem[]> {
    return this.http
      .get<ResponseData<CatalogItem[]>>(`${this.baseUrl}/catalogs`, {
        params: { type, includeInactive: String(includeInactive) }
      })
      .pipe(map(res => res.data));
  }

  searchCatalogItems(req: FilterCatalogItemRequest): Observable<Page<CatalogItem>> {
    if (req.pageNum == undefined) req.pageNum = 0;
    if (req.pageSize == undefined) req.pageSize = 20;

    return this.http
      .post<ResponseData<Page<CatalogItem>>>(`${this.baseUrl}/catalogs/search`, req)
      .pipe(map(res => res.data));
  }

  createCatalogItem(request: CreateCatalogItemRequest): Observable<CatalogItem> {
    return this.http
      .post<ResponseData<CatalogItem>>(`${this.baseUrl}/catalogs`, request)
      .pipe(map(res => res.data));
  }

  updateCatalogItem(id: string, request: UpdateCatalogItemRequest): Observable<CatalogItem> {
    return this.http
      .put<ResponseData<CatalogItem>>(`${this.baseUrl}/catalogs/${id}`, request)
      .pipe(map(res => res.data));
  }

  deleteCatalogItem(id: string): Observable<void> {
    return this.http
      .delete<ResponseData<void>>(`${this.baseUrl}/catalogs/${id}`)
      .pipe(map(res => res.data));
  }

  /**
   * Cached map: SidebarMenu menuKey → label.
   * Dùng cho excel-render để hiển thị tên nhóm chức năng từ URL slug `/report/:type`
   * (giả định `:type` chính là menuKey). Đã chuyển nguồn từ MASTER_CATALOG.REPORT_FC_GROUP
   * sang bảng SIDEBAR_MENU theo yêu cầu thống nhất nguồn dữ liệu.
   */
  getReportFcGroupMap(): Observable<Map<string, string>> {
    return this.sidebarMenuService.getMenuLabelMap();
  }

  // === Catalog Types ===

  getCatalogTypes(includeInactive = false): Observable<CatalogTypeItem[]> {
    return this.http
      .get<ResponseData<CatalogTypeItem[]>>(`${this.baseUrl}/catalog-types`, {
        params: { includeInactive: String(includeInactive) }
      })
      .pipe(map(res => res.data));
  }

  createCatalogType(request: CreateCatalogTypeRequest): Observable<CatalogTypeItem> {
    return this.http
      .post<ResponseData<CatalogTypeItem>>(`${this.baseUrl}/catalog-types`, request)
      .pipe(map(res => res.data));
  }

  updateCatalogType(id: number, request: UpdateCatalogTypeRequest): Observable<CatalogTypeItem> {
    return this.http
      .put<ResponseData<CatalogTypeItem>>(`${this.baseUrl}/catalog-types/${id}`, request)
      .pipe(map(res => res.data));
  }

  deleteCatalogType(id: number): Observable<void> {
    return this.http
      .delete<ResponseData<void>>(`${this.baseUrl}/catalog-types/${id}`)
      .pipe(map(res => res.data));
  }
}
