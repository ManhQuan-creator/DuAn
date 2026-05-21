import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';

export type OrgLevel = 'EVNNPC' | 'HQ_DEPT';

export const ORG_LEVEL_LABELS: Record<string, string> = {
  EVNNPC:  'Tổng công ty',
  HQ_DEPT: 'Ban thuộc TCT',
};

/** Đơn vị trong sơ đồ tổ chức nội bộ TCT: EVNNPC + 14 Ban HQ_DEPT */
export interface Organization {
  id: number;
  orgCode: string;
  orgName: string;
  parentOrgCode: string | null;
  orgLevel: OrgLevel;
  active: boolean;
}

/** Công ty Điện lực thành viên (bảng PC_COMPANY riêng) */
export interface PcCompany {
  companyCode: string;
  companyName: string;
  active: boolean;
}

interface OrgResponse {
  code: string;
  message: string;
  data: Organization[];
}

interface PcCompanyResponse {
  code: string;
  message: string;
  data: PcCompany[];
}

export interface OrgPage {
  content: Organization[];
  totalElements: number;
  number: number;
  size: number;
}

interface OrgPageResponse {
  code: string;
  message: string;
  data: OrgPage;
}

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/excelpro-service/v1/organizations';
  private readonly pcUrl  = '/excelpro-service/v1/pc-companies';

  private allOrgs$: Observable<Organization[]> | null = null;

  /** EVNNPC + 14 Ban HQ_DEPT (15 rows) */
  getAll(): Observable<Organization[]> {
    if (!this.allOrgs$) {
      this.allOrgs$ = this.http.get<OrgResponse>(this.baseUrl).pipe(
        map(res => res.data ?? []),
        shareReplay(1)
      );
    }
    return this.allOrgs$;
  }

  /** 24 Công ty Điện lực thành viên */
  getPcCompanies(): Observable<PcCompany[]> {
    return this.http.get<PcCompanyResponse>(this.pcUrl).pipe(
      map(res => res.data ?? [])
    );
  }

  /** HQ departments (Ban thuộc TCT EVNNPC) */
  getHqDepts(): Observable<Organization[]> {
    return this.http.get<OrgResponse>(`${this.baseUrl}/hq-depts`).pipe(
      map(res => res.data ?? [])
    );
  }

  getAllIncludeInactive(): Observable<Organization[]> {
    return this.http.get<OrgResponse>(`${this.baseUrl}/all`).pipe(
      map(res => res.data ?? [])
    );
  }

  create(req: { orgCode: string; orgName: string; parentOrgCode?: string; orgLevel: string }): Observable<Organization> {
    return this.http.post<{ code: string; message: string; data: Organization }>(this.baseUrl, req).pipe(
      map(res => res.data)
    );
  }

  update(id: number, req: { orgName?: string; parentOrgCode?: string; orgLevel?: string; active?: boolean }): Observable<Organization> {
    return this.http.put<{ code: string; message: string; data: Organization }>(`${this.baseUrl}/${id}`, req).pipe(
      map(res => res.data)
    );
  }

  deleteOrg(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  search(keyword: string, active: boolean | null, page: number, size: number): Observable<OrgPage> {
    // pageNum là 1-based theo PageAndOrderRequest
    let params = new HttpParams().set('pageNum', page + 1).set('pageSize', size);
    if (keyword) params = params.set('keyword', keyword);
    if (active !== null) params = params.set('active', active);
    return this.http.get<OrgPageResponse>(`${this.baseUrl}/search`, { params }).pipe(
      map(res => res.data)
    );
  }

  /** Clear cached data (e.g. on logout) */
  clearCache(): void {
    this.allOrgs$ = null;
  }
}
