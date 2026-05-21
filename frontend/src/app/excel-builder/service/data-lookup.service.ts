import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, map, tap } from 'rxjs';

interface ResponseData<T> {
  code: string;
  message: string;
  data: T;
}

export interface LookupParams {
  templateCode: string;
  year: number;
  month?: number | null;
  orgCode?: string | null;
  rowCode?: string | null;
  columns: string[];
}

export interface LookupResponse {
  templateCode: string;
  year: number;
  month: number | null;
  orgCode: string | null;
  rows: Record<string, any>[];
  /**
   * `false` = template không tồn tại (mã sai trong GETDATA/LOOKUP/MYORG/LOOKUPENTRY) → FE trả `#NOTEMPLATE!`.
   * `true` (hoặc undefined cho backward compat) = template tồn tại; rows empty = `#NODATA!`.
   */
  templateExists?: boolean;
}

interface CacheEntry {
  response: LookupResponse;
  /** Set columns đã fetch — partial cache hit nếu request col mới chưa có. */
  fetchedColumns: Set<string>;
}

@Injectable({ providedIn: 'root' })
export class DataLookupService {
  private http = inject(HttpClient);
  private baseUrl = '/excelpro-service/v1/data-lookup';
  private cache = new Map<string, CacheEntry>();

  lookup(params: LookupParams): Observable<LookupResponse> {
    const key = this.cacheKey(params);
    const cached = this.cache.get(key);
    if (cached && this.hasAllColumns(cached, params.columns)) return of(cached.response);

    let httpParams = new HttpParams()
      .set('templateCode', params.templateCode)
      .set('year', params.year)
      .set('columns', this.unionColumns(cached, params.columns).join(','));
    if (params.month != null) httpParams = httpParams.set('month', params.month);
    if (params.orgCode) httpParams = httpParams.set('orgCode', params.orgCode);
    if (params.rowCode) httpParams = httpParams.set('rowCode', params.rowCode);

    return this.http
      .get<ResponseData<LookupResponse>>(this.baseUrl, { params: httpParams })
      .pipe(
        map((res) => res.data),
        tap((data) => this.storeInCache(key, data, params.columns, cached)),
      );
  }

  batchLookup(requests: LookupParams[]): Observable<LookupResponse[]> {
    // Partial cache: full hit khi tất cả columns đã có; miss/partial → re-fetch với UNION columns.
    // Cache key KHÔNG bao gồm columns — `getCachedLookup` luôn trả super-set hiện có cho
    // template/year/month/orgCode đó (eval chỉ check `column in row`).
    const uncached: LookupParams[] = [];
    const cachedResults = new Map<string, LookupResponse>();

    for (const req of requests) {
      const key = this.cacheKey(req);
      const cached = this.cache.get(key);
      if (cached && this.hasAllColumns(cached, req.columns)) {
        cachedResults.set(key, cached.response);
      } else {
        // Re-fetch với UNION (cached cols + new cols) để giữ cache "growing", không mất col cũ.
        uncached.push({ ...req, columns: this.unionColumns(cached, req.columns) });
      }
    }

    if (uncached.length === 0) {
      return of(requests.map((r) => cachedResults.get(this.cacheKey(r))!));
    }

    return this.http
      .post<ResponseData<LookupResponse[]>>(`${this.baseUrl}/batch`, { requests: uncached })
      .pipe(
        map((res) => res.data),
        tap((results) => {
          for (let i = 0; i < uncached.length; i++) {
            if (!results[i]) continue;
            const key = this.cacheKey(uncached[i]);
            this.storeInCache(key, results[i], uncached[i].columns, this.cache.get(key));
          }
        }),
        map((results) => {
          let freshIdx = 0;
          return requests.map((r) => {
            const key = this.cacheKey(r);
            if (cachedResults.has(key)) return cachedResults.get(key)!;
            const stored = this.cache.get(key);
            // Sau tap đã store, ưu tiên đọc lại từ cache để đảm bảo merged columns; fallback raw.
            return stored?.response ?? results[freshIdx++];
          });
        }),
      );
  }

  /**
   * Get cached lookup data for a specific templateCode + year + month.
   * Used by FormulaService during cell evaluation (synchronous).
   */
  getCachedLookup(
    templateCode: string,
    year: number,
    month?: number | null,
    orgCode?: string | null,
  ): LookupResponse | undefined {
    const key = `${templateCode}_${year}_${month ?? ''}_${orgCode ?? ''}`;
    return this.cache.get(key)?.response;
  }

  invalidateCache(): void {
    this.cache.clear();
  }

  private cacheKey(p: LookupParams): string {
    return `${p.templateCode}_${p.year}_${p.month ?? ''}_${p.orgCode ?? ''}`;
  }

  private hasAllColumns(entry: CacheEntry, columns: string[]): boolean {
    for (const c of columns) if (!entry.fetchedColumns.has(c)) return false;
    return true;
  }

  /** Trả union của (cached fetched columns) ∪ (new request columns) — refetch sẽ phủ hết. */
  private unionColumns(cached: CacheEntry | undefined, columns: string[]): string[] {
    if (!cached) return columns.slice();
    const set = new Set<string>(cached.fetchedColumns);
    for (const c of columns) set.add(c);
    return Array.from(set);
  }

  private storeInCache(
    key: string,
    response: LookupResponse,
    requestedColumns: string[],
    previous: CacheEntry | undefined,
  ): void {
    const fetched = new Set<string>(previous?.fetchedColumns ?? []);
    for (const c of requestedColumns) fetched.add(c);
    this.cache.set(key, { response, fetchedColumns: fetched });
  }
}
