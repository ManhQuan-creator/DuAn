import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Page } from '../../shared/models/common.model';
import { SuggestedCategory, SuggestedCategoryFilter } from '../model/suggested-category.model';

@Injectable({ providedIn: 'root' })
export class SuggestedCategoryService {
  private http = inject(HttpClient);
  private baseUrl = '/excelpro-service/v1/suggested-category';

  searchCategories(req: SuggestedCategoryFilter): Observable<Page<SuggestedCategory>> {
    let params = new HttpParams()
      .set('pageNum', String(req.pageNum ?? 0))
      .set('pageSize', String(req.pageSize ?? 20));

    if (req.unitName) params = params.set('unitName', req.unitName);
    if (req.categoryCode) params = params.set('categoryCode', req.categoryCode);
    if (req.categoryName) params = params.set('categoryName', req.categoryName);
    if (req.yearPlan) params = params.set('yearPlan', req.yearPlan);
    if (req.status) params = params.set('status', req.status);

    return this.http.get<Page<SuggestedCategory>>(`${this.baseUrl}/search`, { params });
  }

  getAvailableYears(): Observable<string[]> {
    return this.searchCategories({ pageNum: 0, pageSize: 1000 }).pipe(
      map((res) => {
        const years = (res.content ?? [])
          .map((item) => item.yearPlan)
          .filter((yearPlan): yearPlan is string => !!yearPlan);

        return [...new Set(years)].sort((a, b) => Number(b) - Number(a));
      }),
    );
  }

  exportCategories(req: SuggestedCategoryFilter): Observable<HttpResponse<Blob>> {
    return this.http.post(`${this.baseUrl}/export`, req, {
      observe: 'response',
      responseType: 'blob',
    });
  }
}
