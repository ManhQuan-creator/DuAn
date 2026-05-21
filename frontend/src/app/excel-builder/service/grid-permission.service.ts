import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ResponseData } from '../../shared/models/common.model';
import { GridPermission, GridPermissionRequest } from '../models/grid.permission.model';

@Injectable({ providedIn: 'root' })
export class GridPermissionService {
  private http = inject(HttpClient);
  private baseUrl = '/excelpro-service/v1/grid-templates';

  getPermissions(templateId: number): Observable<GridPermission[]> {
    return this.http
      .get<ResponseData<GridPermission[]>>(`${this.baseUrl}/${templateId}/permissions`)
      .pipe(map(res => res.data));
  }

  savePermission(templateId: number, perm: Omit<GridPermissionRequest, 'id' | 'createdBy' | 'createdAt'>): Observable<GridPermission> {
    return this.http
      .post<ResponseData<GridPermission>>(`${this.baseUrl}/${templateId}/permissions`, perm)
      .pipe(map(res => res.data));
  }

  deletePermission(templateId: number, permId: number): Observable<void> {
    return this.http
      .delete<ResponseData<void>>(`${this.baseUrl}/${templateId}/permissions/${permId}`)
      .pipe(map(res => res.data));
  }
}
