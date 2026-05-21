import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Option, Page, ResponseData } from '../../shared/models/common.model';
import {
  SclCategorFilter,
  SclCategory,
  SclCategoryIdsRequest,
  SclHistory,
  SclHistoryFilter,
} from '../model/scl-category.model';

@Injectable({ providedIn: 'root' })
export class SclCategoryService {
  private http = inject(HttpClient);
  private baseUrl = '/excelpro-service/v1/scl-category';

  searchCategories(req: SclCategorFilter): Observable<Page<SclCategory>> {
    let params = new HttpParams()
      .set('pageNum', String(req.pageNum ?? 0))
      .set('pageSize', String(req.pageSize ?? 20));

    if (req.unit) params = params.set('unit', req.unit);
    if (req.categoryCode) params = params.set('categoryCode', req.categoryCode);
    if (req.categoryName) params = params.set('categoryName', req.categoryName);
    if (req.yearPlan) params = params.set('yearPlan', req.yearPlan);
    params = this.appendFilterParams(params, 'progress', req.progress);
    params = this.appendFilterParams(params, 'status', req.status);
    params = this.appendFilterParams(params, 'assetType', req.assetType);
    params = this.appendFilterParams(params, 'planType', req.planType);
    params = this.appendFilterParams(params, 'registerType', req.registerType);

    return this.http.get<Page<SclCategory>>(`${this.baseUrl}/search`, { params });
  }

  getAvailableYears(): Observable<string[]> {
    const params = new HttpParams()
      .set('pageNum', '0')
      .set('pageSize', '1000');

    return this.http.get<Page<SclCategory>>(`${this.baseUrl}/search`, { params }).pipe(
      map((res) => {
        const years = (res.content ?? [])
          .map((item) => item.yearPlan)
          .filter((yearPlan): yearPlan is string => !!yearPlan);
        return [...new Set(years)].sort((a, b) => Number(b) - Number(a));
      }),
    );
  }

  deleteCategories(ids: number[]): Observable<number[]> {
    return this.http.post<number[]>(`${this.baseUrl}/delete`, { ids });
  }

  getById(id: number): Observable<SclCategory> {
    return this.http.get<SclCategory>(`${this.baseUrl}/${id}`);
  }

  createCategories(category: SclCategory): Observable<number> {
    return this.http.post<number>(`${this.baseUrl}/create`, category);
  }

  searchHistory(req: SclHistoryFilter): Observable<Page<SclHistory>> {
    return this.http.post<ResponseData<Page<SclHistory>>>(`${this.baseUrl}/history-search`, {
      ...req,
      pageNum: req.pageNum ?? 0,
      pageSize: req.pageSize ?? 20,
    }).pipe(map(res => res.data));
  }

  updateCategory(category: SclCategory): Observable<number> {
    return this.http
      .post<ResponseData<number>>(`${this.baseUrl}/update`, category)
      .pipe(map(res => res.data));
  }

  sendAssessment(ids: number[], assessmentUnit: Option[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/send-assessment`, {
      ids,
      assessmentUnit
    });
  }

  sendApprove(ids: number[]): Observable<number[]> {
    return this.http.post<number[]>(`${this.baseUrl}/send-approve`, { ids });
  }

  approve(ids: number[]): Observable<number[]> {
    return this.http.post<number[]>(`${this.baseUrl}/approve`, { ids });
  }

  reject(ids: number[], rejectReason?: string): Observable<number[]> {
    const payload: SclCategoryIdsRequest = { ids, rejectReason };
    return this.http.post<number[]>(`${this.baseUrl}/reject`, payload);
  }

  updateStatus(ids: number[], status?: string): Observable<number[]> {
    const payload: SclCategoryIdsRequest = { ids, status };
    return this.http.post<number[]>(`${this.baseUrl}/update-status`, payload);
  }

  exportCategories(req: SclCategorFilter): Observable<HttpResponse<Blob>> {
    return this.http.post(`${this.baseUrl}/export`, req, {
      observe: 'response',
      responseType: 'blob',
    });
  }

  private appendFilterParams(
    params: HttpParams,
    key: string,
    value?: string | string[],
  ): HttpParams {
    if (Array.isArray(value)) {
      return value
        .filter(Boolean)
        .reduce((acc, item) => acc.append(key, item), params);
    }

    return value ? params.set(key, value) : params;
  }

  exportReport(req: SclCategorFilter): Observable<HttpResponse<Blob>> {
    return this.http.post(`${this.baseUrl}/export-report`, req, {
      observe: 'response',
      responseType: 'blob',
    });
  }
}
