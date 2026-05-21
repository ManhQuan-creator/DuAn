import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';

export interface DeptTypeItem {
  deptTypeCode: string;
  deptTypeName: string;
  /** HQ_DEPT | PC_DEPT */
  orgLevelScope: string;
  sortOrder: number;
  active: boolean;
}

interface ApiEnvelope<T> {
  code: string;
  message: string;
  data: T;
}

const BASE_URL = '/excelpro-service/v1/dept-types';

@Injectable({ providedIn: 'root' })
export class DeptTypeService {
  private readonly http = inject(HttpClient);

  /** Cache trong RAM — danh mục thay đổi rất ít. */
  private cacheActive: DeptTypeItem[] | null = null;

  getAll(): Observable<DeptTypeItem[]> {
    return this.http
      .get<ApiEnvelope<DeptTypeItem[]>>(BASE_URL)
      .pipe(map((r) => r.data ?? []));
  }

  getAllActive(forceReload = false): Observable<DeptTypeItem[]> {
    if (!forceReload && this.cacheActive) {
      return of(this.cacheActive);
    }
    return this.http
      .get<ApiEnvelope<DeptTypeItem[]>>(`${BASE_URL}/active`)
      .pipe(
        map((r) => r.data ?? []),
        tap((list) => (this.cacheActive = list)),
      );
  }

  getByScope(orgLevelScope: 'HQ_DEPT' | 'PC_DEPT'): Observable<DeptTypeItem[]> {
    return this.http
      .get<ApiEnvelope<DeptTypeItem[]>>(`${BASE_URL}/by-scope/${orgLevelScope}`)
      .pipe(map((r) => r.data ?? []));
  }

  invalidateCache(): void {
    this.cacheActive = null;
  }
}
